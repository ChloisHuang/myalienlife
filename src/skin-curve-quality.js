export function skinCurveArcDivisions(boneCount){
 const segments=Math.max(1,(Number(boneCount)||1)-1);
 return Math.min(64,Math.max(24,segments*4));
}

export function updateSkinBoneMatrix(bone){
 bone.updateWorldMatrix(false,false);
}
