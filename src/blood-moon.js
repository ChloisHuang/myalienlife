import * as THREE from 'three';

export function createMoonBats(){
 const root=new THREE.Group();root.name='血月蝙蝠剪影';
 const wing=new THREE.Shape();wing.moveTo(0,0);wing.lineTo(-.12,.24);wing.lineTo(-.18,.08);
 wing.quadraticCurveTo(-.55,.5,-1,.52);wing.quadraticCurveTo(-.66,.26,-.82,-.04);wing.quadraticCurveTo(-.5,.17,-.48,-.2);wing.quadraticCurveTo(-.26,0,0,-.35);
 wing.quadraticCurveTo(.26,0,.48,-.2);wing.quadraticCurveTo(.5,.17,.82,-.04);wing.quadraticCurveTo(.66,.26,1,.52);wing.quadraticCurveTo(.55,.5,.18,.08);wing.lineTo(.12,.24);wing.lineTo(0,0);
 const geometry=new THREE.ShapeGeometry(wing),material=new THREE.MeshBasicMaterial({color:0x080b12,side:THREE.DoubleSide,fog:false});
 for(let i=0;i<7;i++){const mesh=new THREE.Mesh(geometry,material);mesh.name=`月前蝙蝠-${i}`;root.add(mesh);}
 const right=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();
 return {root,
  update(time,camera){
   right.set(1,0,0).applyQuaternion(camera.quaternion);up.set(0,1,0).applyQuaternion(camera.quaternion);forward.set(0,0,1).applyQuaternion(camera.quaternion);
   for(const [i,bat]of root.children.entries()){
    const phase=time*(.13+i*.008)+i*1.7,x=Math.sin(phase)*(2.3+i*.16),y=Math.cos(phase*.73+i)*1.65+i*.17-.5;
    bat.position.copy(forward).multiplyScalar(2.65+i*.04).addScaledVector(right,x).addScaledVector(up,y);
    bat.quaternion.copy(camera.quaternion);bat.rotateZ(Math.sin(phase)*.18);
    const size=.32+(i%3)*.08;bat.scale.set(size,size*(.6+.4*Math.sin(time*5+i)),size);
   }
  },dispose(){root.removeFromParent();geometry.dispose();material.dispose();}
 };
}
