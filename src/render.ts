import type {GameState} from './game';
import {placeFaces, type Bounds} from './layout';
import {playerFor,players,portrait, type Player} from './players';
import {PhotoAssignments} from './assignment';
const participantColors=['#66b8ff','#63e2b4','#ffd166','#ff8e84','#bd9aff','#f18dcc','#66e3ef','#bcdf6b','#d1dbe6'];
const colorFor=(slot:number)=>participantColors[slot%participantColors.length];
export class Renderer {
 private assignments=new PhotoAssignments(players.length);
 private photoError=false;
 private player(slot:number):Player {
  if(!this.photoError)try{return playerFor(this.assignments.get(slot));}catch{this.photoError=true;}
  // A verified portrait can still render; the game itself stops if Crypto fails.
  return playerFor(slot);
 }
 private nodes=new Map<number,HTMLElement>(); private frame:number|null=null;
 private state:GameState|null=null; private lastWinner:number|null=null;
 constructor(private root:HTMLElement,private center:HTMLElement,private faces:HTMLElement,private result:HTMLElement,private onRetry:()=>void){}
 update(state:GameState){if(state.phase==='idle'&&state.touches.size===0&&!state.winner){this.assignments.reset();this.photoError=false;for(const node of this.nodes.values())node.remove();this.nodes.clear();}this.state=state;if(this.frame===null)this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
 cancel(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;}
 private draw(){
  const state=this.state;if(!state)return;
  this.root.dataset.phase=state.phase;
  const style=getComputedStyle(this.root);
  const bounds:Bounds={left:parseFloat(style.paddingLeft)+12,top:parseFloat(style.paddingTop)+68,right:this.root.clientWidth-parseFloat(style.paddingRight)-12,bottom:this.root.clientHeight-parseFloat(style.paddingBottom)-48};
  const touches=[...state.touches.values()].filter(t=>t.slot>=0);
  const placements=placeFaces(touches,bounds);
  const present=new Set(touches.map(t=>t.id));
  for(const [id,node] of this.nodes)if(!present.has(id)){node.remove();this.nodes.delete(id);}
  touches.forEach((touch,i)=>{
   let node=this.nodes.get(touch.id);
   if(!node){node=document.createElement('div');node.className='touch';node.dataset.pointerId=String(touch.id);node.style.setProperty('--participant-color',colorFor(touch.slot));
    const ring=document.createElement('div');ring.className='ring';
    const line=document.createElement('div');line.className='connector';
    const face=document.createElement('div');face.className='face';face.append(portrait(this.player(touch.slot)));
    const number=document.createElement('span');number.className='participant';number.textContent=String(touch.slot+1);face.append(number);
    node.append(ring,line,face);this.faces.append(node);this.nodes.set(touch.id,node);
   }
   const p=placements[i],dx=p.x-touch.x,dy=p.y-touch.y;
   node.classList.toggle('chosen',state.winner?.id===touch.id);node.classList.toggle('dimmed',state.phase==='result'&&state.winner?.id!==touch.id);
   const ring=node.querySelector<HTMLElement>('.ring')!,line=node.querySelector<HTMLElement>('.connector')!,face=node.querySelector<HTMLElement>('.face')!;
   ring.style.transform=`translate(${touch.x}px,${touch.y}px)`;
   line.style.cssText=`left:${touch.x}px;top:${touch.y}px;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)}rad)`;
   face.style.cssText=`width:${p.size}px;height:${p.size}px;transform:translate(${p.x-p.size/2}px,${p.y-p.size/2}px)`;
  });
  this.center.className=state.phase==='countdown'?'countdown':'';
  const message=state.phase==='countdown'?String(state.count):state.phase==='error'?'추첨을 사용할 수 없습니다':'';
  if(this.center.textContent!==message)this.center.textContent=message;
  this.center.setAttribute('aria-label',state.phase==='countdown'?`추첨까지 ${state.count}초`:state.phase==='stabilizing'?'참가 터치 확인 중':state.phase==='idle'?'터치 대기':message);
  if(state.winner){
   this.result.style.display='flex';
   this.result.style.setProperty('--participant-color',colorFor(state.winner.slot));
   if(this.lastWinner!==state.winner.id){this.result.replaceChildren();const player=this.player(state.winner.slot);
    const card=document.createElement('div');card.className='result-card';
    const caption=document.createElement('span');caption.className='result-label';caption.textContent='SELECTED';
    const name=document.createElement('h1');name.id='winner-name';name.textContent=player.name;
    const retry=document.createElement('button');retry.type='button';retry.className='retry';retry.textContent='다시하기';
    retry.addEventListener('click',event=>{event.stopPropagation();this.onRetry();});
    card.append(caption,portrait(player),name,retry);this.result.append(card);
    this.result.setAttribute('aria-label',`당첨: ${player.name}, 참가 ${state.winner.slot+1}`);this.lastWinner=state.winner.id;
    retry.focus({preventScroll:true});
   }
  }else{this.result.replaceChildren();this.result.style.display='none';this.result.removeAttribute('aria-label');this.lastWinner=null;}
 }
}
