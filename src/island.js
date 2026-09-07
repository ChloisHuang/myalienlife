export const SIDES={front:'晴昼面',back:'幽星面'};
export const DEFAULT_GATE_POSITION={x:-7,z:3};
// A missing side is the original, front-face coordinate space.
export const sideOf=entity=>entity.side??'front';
export const sameSide=(a,b)=>sideOf(a)===sideOf(b);
export const createGates=()=>['front','back'].map(side=>({id:`island-gate-${side}`,type:'gate',side,...DEFAULT_GATE_POSITION,rotation:0,fixed:true}));
