import type {Game} from './game';
export function bindInput(root:HTMLElement,game:Game,onTap:()=>void){
 const starts=new Map<number,{x:number;y:number;time:number}>();
 const point=(e:PointerEvent)=>{const r=root.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 root.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||(e.target instanceof Element&&e.target.closest('#result')))return;const p=point(e);starts.set(e.pointerId,{...p,time:performance.now()});game.add(e.pointerId,p.x,p.y);
  try{root.setPointerCapture(e.pointerId);}catch{/* Synthetic events have no native capture. */}
 });
 root.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')return;const p=point(e);game.move(e.pointerId,p.x,p.y);});
 const end=(e:PointerEvent)=>{if(e.pointerType!=='touch')return;game.remove(e.pointerId);starts.delete(e.pointerId);};
 root.addEventListener('pointerup',e=>{
  const start=starts.get(e.pointerId),p=point(e);
  if(e.isTrusted&&e.pointerType==='touch'&&start&&performance.now()-start.time<500&&Math.hypot(p.x-start.x,p.y-start.y)<20)onTap();
  end(e);
 });
 root.addEventListener('pointercancel',end);
 root.addEventListener('lostpointercapture',e=>{if(game.state.touches.has(e.pointerId))end(e);});
 root.addEventListener('click',e=>{if(e.isTrusted&&!(e.target instanceof Element&&e.target.closest('#result')))onTap();});
 root.addEventListener('contextmenu',e=>e.preventDefault());
 const clearCaptures=()=>{
  const ids=[...starts.keys()];starts.clear();
  for(const id of ids)try{if(root.hasPointerCapture(id))root.releasePointerCapture(id);}catch{/* Pointer may already have ended. */}
 };
 return {
  interrupt:()=>{game.interrupt();clearCaptures();},
  retry:()=>{game.retry();clearCaptures();},
 };
}
