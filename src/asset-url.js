export function versionedAsset(path,version=''){return version?`${path}?v=${encodeURIComponent(version)}`:path;}
