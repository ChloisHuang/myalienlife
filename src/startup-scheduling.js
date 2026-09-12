export function afterPaint(raf=globalThis.requestAnimationFrame){
 if(typeof raf!=='function')return Promise.resolve();
 return new Promise(resolve=>raf(()=>raf(resolve)));
}

export async function deferAfterPaint(task,raf=globalThis.requestAnimationFrame){
 await afterPaint(raf);
 return task();
}
