export function parseAssetVersions(value=''){try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return{};}}
export function versionedAsset(path,versions={}){const version=typeof versions==='string'?versions:versions?.[path]??'';return version?`${path}?v=${encodeURIComponent(version)}`:path;}
