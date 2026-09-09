#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
id=$1 hash=$2 domain=$3 public=$4 backend=$5 seed=$6
base=/opt/myalienlife
conf=/etc/nginx/conf.d/myalienlife.conf
hook=/etc/letsencrypt/renewal-hooks/deploy/40-myalienlife-nginx
origin="https://$domain:$public"
[[ "$id" =~ ^[0-9]{17}$ && "$hash" =~ ^[a-f0-9]{64}$ && "$domain" =~ ^[a-zA-Z0-9.-]+$ && "$public" =~ ^[0-9]+$ && "$backend" =~ ^[0-9]+$ ]]
[[ $EUID == 0 ]] || { echo 'Deployment requires root SSH or a separately configured deploy account.'; exit 1; }
mkdir -p "$base"/releases "$base"/backups "$base"/secrets "$base"/data
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another deployment is active.'; exit 1; }
printf '%s  %s\n' "$hash" "$base/incoming/$id.tgz" | sha256sum -c -
test -f "/etc/letsencrypt/live/$domain/fullchain.pem" && test -f "/etc/letsencrypt/live/$domain/privkey.pem"
nginx -t
if [[ -f "$hook" ]]; then grep -Fx '# Managed by myalienlife deploy' "$hook" >/dev/null || exit 1; fi
if [[ -f "$conf" ]]; then
 head -1 "$conf" | grep -Fx '# Managed by myalienlife deploy' >/dev/null || exit 1
 grep -Fx "# $origin backend=$backend" "$conf" >/dev/null || { echo 'Existing deployment uses different ports; refusing automatic changes.'; exit 1; }
else
 ! ss -ltnH | awk '{print $4}' | grep -E ":($public|$backend)$" || { echo 'Requested application port is occupied.'; exit 1; }
fi
if docker inspect myalienlife >/dev/null 2>&1; then
 [[ $(docker inspect -f '{{index .Config.Labels "app"}}' myalienlife) == myalienlife ]] || exit 1
fi
test $(df --output=avail -k "$base" | tail -1) -gt 524288 || { echo 'Need at least 512 MiB free disk.'; exit 1; }
docker pull node:24-alpine
image=$(docker image inspect node:24-alpine -f '{{index .RepoDigests 0}}')
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --memory 128m --pids-limit 32 "$image" node -e 'console.log(process.version)'
release="$base/releases/$id"
mkdir "$release"
tar -xzf "$base/incoming/$id.tgz" --no-same-owner -C "$release"
chmod -R a+rX "$release"
printf '%s\n' "$image" >"$release/image"
if [[ ! -f "$base/data/orbit-life.json" ]]; then
 [[ "$seed" == seed && -f "$base/incoming/$id.seed.json" ]] || { echo 'First deployment requires --seed-local; no world will be silently created.'; exit 1; }
 cp "$base/incoming/$id.seed.json" "$base/data/orbit-life.json"
 cp "$release/project-config.json" "$base/data/project-config.json"
fi
chown -R 1000:1000 "$base/data"
chmod 700 "$base/data"
if [[ ! -f "$base/secrets/operator-token" ]]; then
 openssl rand -hex 32 >"$base/secrets/operator-token"
 chown 1000:1000 "$base/secrets/operator-token"
 chmod 400 "$base/secrets/operator-token"
fi
# Preflight uses a read-only mount and the exact new save migration code.
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --memory 192m --pids-limit 32 -v "$base/data:/data:ro" -v "$release:/app:ro" "$image" node /app/preflight.mjs
old=$(readlink -f "$base/current" || true)
if [[ -f "$conf" ]]; then cp "$conf" "$base/backups/nginx-before.conf"; else rm -f "$base/backups/nginx-before.conf"; fi
start_world(){
 local dir=$1
 docker run -d --name myalienlife --label app=myalienlife --restart unless-stopped --stop-timeout 30 --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --memory 256m --memory-swap 384m --cpus 0.5 --pids-limit 64 --log-driver json-file --log-opt max-size=5m --log-opt max-file=2 -p "127.0.0.1:$backend:18080" -v "$dir:/app:ro" -v "$base/data:/data" -v "$base/secrets/operator-token:/run/operator-token:ro" -e HOST=0.0.0.0 -e PORT=18080 -e ORBIT_DATA_DIR=/data -e ORBIT_DIST_DIR=/app/dist -e ORBIT_TOKEN_FILE=/run/operator-token -e "ORBIT_ORIGIN=$origin" -e "ORBIT_RELEASE=$(basename "$dir")" "$(cat "$dir/image")" node /app/production.mjs >/dev/null
}
rollback(){
 trap - ERR
 echo 'Deployment failed; restoring previous release and preserving failed state.' >&2
 docker stop -t 30 myalienlife >/dev/null 2>&1 || true
 docker rm myalienlife >/dev/null 2>&1 || true
 cp -a "$base/data" "$base/backups/failed-$id"
 cp -a "$base/backups/before-$id/." "$base/data/"
 if [[ -n "$old" && -f "$old/production.mjs" ]]; then start_world "$old"; fi
 if [[ -f "$base/backups/nginx-before.conf" ]]; then cp "$base/backups/nginx-before.conf" "$conf"; else rm -f "$conf"; fi
 nginx -t && nginx -s reload
 exit 1
}
if docker inspect myalienlife >/dev/null 2>&1; then docker stop -t 30 myalienlife >/dev/null; docker rm myalienlife >/dev/null; fi
cp -a "$base/data" "$base/backups/before-$id"
trap rollback ERR
start_world "$release"
healthy=false
for i in $(seq 1 30); do if curl --max-time 3 -fsS "http://127.0.0.1:$backend/healthz" >"$base/health.json"; then healthy=true; break; fi; sleep 1; done
[[ $healthy == true ]]
cat >"$conf" <<EOF
# Managed by myalienlife deploy
# $origin backend=$backend
limit_req_zone \$binary_remote_addr zone=orbit_api:1m rate=20r/s;
server {
    listen $public ssl;
    server_name $domain;
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_protocols TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    server_tokens off;
    client_max_body_size 64k;
    client_body_timeout 10s;
    access_log off;
    error_log /var/log/nginx/myalienlife-error.log warn;
    gzip on;
    gzip_types application/json text/javascript text/css;
    location / {
        limit_req zone=orbit_api burst=40 nodelay;
        proxy_pass http://127.0.0.1:$backend;
        proxy_set_header Host \$host;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        proxy_connect_timeout 5s;
        proxy_read_timeout 15s;
    }
}
EOF
chmod 644 "$conf"
nginx -t
nginx -s reload
healthy=false
# nginx reload only sends a signal; wait until the new listener is actually ready.
for i in $(seq 1 30); do
 if curl --noproxy '*' --max-time 3 -fsS --resolve "$domain:$public:127.0.0.1" "$origin/healthz"; then healthy=true; break; fi
 sleep 1
done
[[ $healthy == true ]]
ln -sfn "$release" "$base/current"
trap - ERR
mkdir -p "$(dirname "$hook")"
cat >"$hook" <<'EOF'
#!/bin/sh
# Managed by myalienlife deploy
nginx -t && nginx -s reload
EOF
chmod 700 "$hook"
# Keep two code releases and two pre-deployment backups, never prune other apps.
for dir in "$base"/releases/*; do
 if [[ "$dir" != "$release" && "$dir" != "$old" ]]; then
  obsolete=$(cat "$dir/image" 2>/dev/null || true)
  rm -rf "$dir"
  if [[ "$obsolete" == *@sha256:* && "$obsolete" != "$image" && ( -z "$old" || "$obsolete" != "$(cat "$old/image" 2>/dev/null || true)" ) ]]; then docker image rm "$obsolete" >/dev/null 2>&1 || true; fi
 fi
done
find "$base/backups" -maxdepth 1 -type d -name 'before-*' | sort -r | tail -n +3 | while read -r dir; do rm -rf "$dir"; done
rm -f "$base/incoming/$id.tgz" "$base/incoming/$id.seed.json"
echo "Ready: $origin"
