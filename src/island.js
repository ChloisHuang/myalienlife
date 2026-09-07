export const SIDES={front:'晴昼面',back:'幽星面'};
// A missing side is the original, front-face coordinate space.
export const sideOf=entity=>entity.side??'front';
export const sameSide=(a,b)=>sideOf(a)===sideOf(b);
export const createGates=()=>['front','back'].map(side=>({id:`island-gate-${side}`,type:'gate',side,x:-10,z:0,rotation:0,fixed:true}));
