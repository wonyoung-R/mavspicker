export type Point = {x:number;y:number};
export type Bounds = {left:number;top:number;right:number;bottom:number};
export type Placement = Point & {size:number};
const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(v,min),max);
// Stable input order keeps each face attached to its pointer. Search nearby positions,
// scoring overlap and distance; dense groups progressively use smaller portraits.
export function placeFaces(points:Point[], bounds:Bounds):Placement[] {
 const area=(bounds.right-bounds.left)*(bounds.bottom-bounds.top);
 const size=Math.max(44,Math.min(88,Math.sqrt(area/Math.max(points.length,1))*.43));
 const placed:Placement[]=[];
 for (const p of points) {
  let best={x:0,y:0,size}, score=Infinity;
  for (const scale of [1,.82,.65]) for (const radius of [size*.95,size*1.7,size*2.5,size*3.3]) for (let i=0;i<16;i++) {
   const s=Math.max(38,size*scale),angle=-Math.PI/2+i*Math.PI/8;
   const x=clamp(p.x+Math.cos(angle)*radius,bounds.left+s/2,bounds.right-s/2);
   const y=clamp(p.y+Math.sin(angle)*radius,bounds.top+s/2,bounds.bottom-s/2);
   const overlaps=placed.reduce((sum,q)=>sum+Math.max(0,(s+q.size)/2+8-Math.hypot(x-q.x,y-q.y))**2,0);
   const finger=points.reduce((sum,q)=>sum+Math.max(0,s/2+24-Math.hypot(x-q.x,y-q.y))**2,0);
   const value=overlaps*80+finger*15+Math.hypot(x-p.x,y-p.y)+(1-scale)*120+i*.2;
   if(value<score){score=value;best={x,y,size:s};}
  }
  placed.push(best);
 }
 return placed;
}
export function resultSpace(points:Point[],bounds:Bounds,width:number,height:number):Point {
 let best={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2},score=-Infinity;
 for(let ix=0;ix<5;ix++) for(let iy=0;iy<7;iy++) {
  const x=bounds.left+width/2+(bounds.right-bounds.left-width)*ix/4;
  const y=bounds.top+height/2+(bounds.bottom-bounds.top-height)*iy/6;
  const dist=points.length?Math.min(...points.map(p=>Math.hypot((x-p.x)*.8,y-p.y))):1000;
  if(dist>score){score=dist;best={x,y};}
 }
 return best;
}
