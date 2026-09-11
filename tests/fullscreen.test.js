import test from 'node:test';
import assert from 'node:assert/strict';
import {createFullscreenController} from '../src/fullscreen.js';

function platform({native=true}={}){
 const listeners=new Map();
 const classes=new Set();
 const html={classList:{toggle(name,force){if(force===undefined?!classes.has(name):force)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)}};
 const orientation={lockCalls:[],unlockCalls:0,async lock(type){this.lockCalls.push(type);},unlock(){this.unlockCalls++;}};
 const documentRef={documentElement:html,fullscreenElement:null,addEventListener(type,listener){listeners.set(type,listener);},removeEventListener(type,listener){if(listeners.get(type)===listener)listeners.delete(type);},async exitFullscreen(){documentRef.fullscreenElement=null;listeners.get('fullscreenchange')?.();}};
 const root=native?{async requestFullscreen(){documentRef.fullscreenElement=root;listeners.get('fullscreenchange')?.();}}:{};
 return {documentRef,root,classes,screenRef:{orientation},orientation};
}

test('native fullscreen toggles and reports browser fullscreen state',async()=>{
 const {documentRef,root}=platform(),states=[];
 const controller=createFullscreenController({documentRef,element:root,onChange:active=>states.push(active)});
 assert.equal(controller.isActive(),false);
 await controller.toggle();
 assert.equal(controller.isActive(),true);
 assert.equal(documentRef.fullscreenElement,root);
 await controller.toggle();
 assert.equal(controller.isActive(),false);
 assert.deepEqual(states,[true,false]);
});

test('mobile native fullscreen locks to landscape and unlocks on exit',async()=>{
 const {documentRef,root,screenRef,orientation}=platform();
 const controller=createFullscreenController({documentRef,element:root,screenRef,shouldLockOrientation:()=>true});
 await controller.toggle();
 assert.deepEqual(orientation.lockCalls,['landscape']);
 await controller.toggle();
 assert.equal(orientation.unlockCalls,1);
});

test('unsupported browsers use the app fullscreen mode',async()=>{
 const {documentRef,root,classes}=platform({native:false});
 const controller=createFullscreenController({documentRef,element:root});
 await controller.toggle();
 assert.equal(controller.isActive(),true);
 assert.equal(classes.has('app-fullscreen'),true);
 await controller.toggle();
 assert.equal(controller.isActive(),false);
 assert.equal(classes.has('app-fullscreen'),false);
});
