import {describe,it,expect} from 'vitest';
import {placeFaces,resultSpace} from '../src/layout';
describe('safe portrait layout',()=>{
 for(const [w,h] of [[360,640],[390,844],[844,390]])for(const count of [2,3,5,12])it(`${w}×${h} ${count} clustered pointers remain inside`,()=>{
  const bounds={left:12,top:68,right:w-12,bottom:h-48};
  const points=Array.from({length:count},(_,i)=>({x:w/2+i,y:h/2+i}));
  const faces=placeFaces(points,bounds);expect(faces).toHaveLength(count);
  for(const p of faces){expect(p.x-p.size/2).toBeGreaterThanOrEqual(bounds.left);expect(p.x+p.size/2).toBeLessThanOrEqual(bounds.right);expect(p.y-p.size/2).toBeGreaterThanOrEqual(bounds.top);expect(p.y+p.size/2).toBeLessThanOrEqual(bounds.bottom);}
  if(count<=5)for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)expect(Math.hypot(faces[i].x-faces[j].x,faces[i].y-faces[j].y)).toBeGreaterThanOrEqual((faces[i].size+faces[j].size)/2);
 });
 it('result rectangle inside safe area',()=>{const b={left:24,top:68,right:336,bottom:592};const p=resultSpace([{x:180,y:350}],b,240,270);expect(p.x-120).toBeGreaterThanOrEqual(b.left);expect(p.y-135).toBeGreaterThanOrEqual(b.top);expect(p.x+120).toBeLessThanOrEqual(b.right);expect(p.y+135).toBeLessThanOrEqual(b.bottom);});
});
