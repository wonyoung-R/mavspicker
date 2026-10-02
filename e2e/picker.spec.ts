import {test,expect,type Page} from '@playwright/test';

async function pointer(page:Page,type:string,id:number,x=120,y=400){
  await page.locator('#app').evaluate((root,p)=>root.dispatchEvent(new PointerEvent(p.type,{pointerId:p.id,pointerType:'touch',clientX:p.x,clientY:p.y,bubbles:true})),{type,id,x,y});
  await page.clock.runFor(20);
}
async function open(page:Page,supported=true){if(supported)await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>5}));await page.clock.install();await page.goto('/');await page.clock.runFor(40);}
async function participants(page:Page,n=2){for(let id=1;id<=n;id++)await pointer(page,'pointerdown',id,60+id*42,440);}
async function retry(page:Page){await page.getByRole('button',{name:'다시하기',exact:true}).tap();await page.clock.runFor(40);await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');await expect(page.locator('#result')).toBeHidden();await expect(page.locator('.touch')).toHaveCount(0);}
async function winner(page:Page){await page.clock.runFor(5500);await expect(page.locator('#app')).toHaveAttribute('data-phase','result');await expect(page.locator('.chosen')).toHaveCount(1);}

test('0/1 touch and mouse input never draw; 5/4/3/2/1 produces one result',async({page})=>{
 await open(page);await page.clock.runFor(5000);await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');
 await page.locator('#app').dispatchEvent('pointerdown',{pointerId:88,pointerType:'mouse'});await expect(page.locator('.touch')).toHaveCount(0);
 await pointer(page,'pointerdown',1);await page.clock.runFor(5000);await expect(page.locator('#result')).toBeHidden();
 await pointer(page,'pointerdown',2,260);await page.clock.runFor(400);await expect(page.locator('#center')).toHaveText('5');
 await page.clock.runFor(1000);await expect(page.locator('#center')).toHaveText('4');
 await pointer(page,'pointermove',1,140,430);await page.clock.runFor(980);await expect(page.locator('#center')).toHaveText('3');
 await page.clock.runFor(1000);await expect(page.locator('#center')).toHaveText('2');
 await page.clock.runFor(1000);await expect(page.locator('#center')).toHaveText('1');
 await page.clock.runFor(1000);await expect(page.locator('.chosen')).toHaveCount(1);
});

for(const event of ['pointerup','pointercancel','lostpointercapture'])test(`${event} discards countdown; stale moves cannot revive touch`,async({page})=>{
 await open(page);await participants(page,3);await page.clock.runFor(3000);await pointer(page,event,3);
 await pointer(page,'pointermove',3);await expect(page.locator('.touch')).toHaveCount(2);
 await page.clock.runFor(500);await expect(page.locator('#center')).toHaveText('5');
 await page.clock.runFor(400);await expect(page.locator('#result')).toBeHidden();await winner(page);
});

test('added participant restarts countdown; winner stays fixed after release and new touch',async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(2800);await pointer(page,'pointerdown',3,280,500);
 await page.clock.runFor(450);await expect(page.locator('#center')).toHaveText('5');await winner(page);
 const id=Number(await page.locator('.chosen').getAttribute('data-pointer-id'));const result=await page.locator('#result').getAttribute('aria-label');
 await pointer(page,'pointerup',id);await pointer(page,'pointerdown',4);await page.clock.runFor(6000);
 await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);await expect(page.locator('.touch[data-pointer-id="4"]')).toHaveCount(0);
 for(const old of [1,2,3,4])await pointer(page,'pointerup',old);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','result');await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
 await participants(page);await page.clock.runFor(6000);await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
 await retry(page);await participants(page);await winner(page);
});

for(const event of ['pagehide','blur','orientationchange'])test(`${event} clears interrupted pointers and preserves committed result`,async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(3000);await page.evaluate(e=>window.dispatchEvent(new Event(e)),event);await page.clock.runFor(5000);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');await expect(page.locator('.touch')).toHaveCount(0);
 await pointer(page,'pointermove',1);await expect(page.locator('.touch')).toHaveCount(0);
 await participants(page);await winner(page);const result=await page.locator('#result').getAttribute('aria-label');
 await page.evaluate(e=>window.dispatchEvent(new Event(e)),event);await page.clock.runFor(5000);
 await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
 await participants(page);await page.clock.runFor(6000);await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);await retry(page);await participants(page);await winner(page);
});

test('hidden document aborts countdown and does not catch up on return',async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(3000);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(5000);await expect(page.locator('.touch')).toHaveCount(0);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(5000);await expect(page.locator('#result')).toBeHidden();await participants(page);await winner(page);
});

for(const [width,height,n] of [[360,640,2],[390,844,3],[844,390,5]])test(`${width}x${height}: ${n} close/corner touches stay inside viewport, images decode, result visible`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.setViewportSize({width,height});await open(page);
 const decoded=await page.evaluate(async()=>{const {players}=await import('/src/players.ts');return Promise.all(players.map(async(p:{localAssetPath:string})=>{const i=new Image();i.src=p.localAssetPath;await i.decode();return i.naturalWidth>100&&i.naturalHeight>100;}));});
 expect(decoded).toHaveLength(9);expect(decoded.every(Boolean)).toBe(true);
 const points=[[2,2],[width-2,height-2],[width/2,height/2],[width/2+2,height/2],[width/2+4,height/2]];
 for(let i=0;i<n;i++)await pointer(page,'pointerdown',i+1,...points[i] as [number,number]);
 await page.clock.runFor(200);
 for(const face of await page.locator('.face').all()){const b=await face.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);}
 await page.screenshot({path:testInfo.outputPath('participants.png')});await winner(page);await expect(page.locator('#result h1')).not.toHaveText('');await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal','true');await expect(page.getByRole('button',{name:'다시하기',exact:true})).toBeVisible();
 for(const child of ['#result .portrait','#result h1','#result button']){const c=await page.locator(child).boundingBox();expect(c!.x).toBeGreaterThanOrEqual(0);expect(c!.y).toBeGreaterThanOrEqual(0);expect(c!.x+c!.width).toBeLessThanOrEqual(width);expect(c!.y+c!.height).toBeLessThanOrEqual(height);}
 const b=await page.locator('#result').boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('result.png')});expect(errors).toEqual([]);
});

test('missing portrait uses named fallback; crypto exception stops draw',async({page})=>{
 await page.route('**/players/*.png',route=>route.abort());await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,'getRandomValues',{value:()=>{throw Error('unavailable');}});});
 await open(page);await participants(page);await page.clock.runFor(5500);await expect(page.locator('#app')).toHaveAttribute('data-phase','error');
 await expect(page.locator('.fallback').first()).toHaveAttribute('aria-label',/.+/);await expect(page.locator('#result')).toBeHidden();
});

test('fullscreen rejects once; vibrate false leaves visual winner intact',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const calls={fullscreen:0,vibration:[] as number[]};Object.assign(window,{testCalls:calls});
  Object.defineProperty(document,'fullscreenEnabled',{get:()=>true});
  HTMLElement.prototype.requestFullscreen=()=>{calls.fullscreen++;return Promise.reject(Error('denied'));};
  Object.defineProperty(navigator,'vibrate',{value:(ms:number)=>{calls.vibration.push(ms);return false;}});
 });
 await open(page);await page.locator('#app').tap({position:{x:100,y:200}});await page.locator('#app').tap({position:{x:100,y:200}});
 expect(await page.evaluate(()=>(window as unknown as {testCalls:{fullscreen:number}}).testCalls.fullscreen)).toBe(1);
 await participants(page);await winner(page);await page.clock.runFor(5000);
 expect(await page.evaluate(()=>(window as unknown as {testCalls:{vibration:number[]}}).testCalls.vibration.filter(ms=>ms===80))).toEqual([80]);expect(errors).toEqual([]);
});

test('no multi-touch capability gives brief unsupported status',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0}));await open(page,false);await expect(page.locator('#center')).toHaveText('멀티터치 기기에서 열어 주세요');
 await participants(page);await page.clock.runFor(5000);await expect(page.locator('.touch')).toHaveCount(0);
});

test('Chromium CDP simultaneous touch input chooses one participant',async({page,context})=>{
 await open(page);const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:110,y:410,id:1},{x:260,y:410,id:2}]});await page.clock.runFor(40);await expect(page.locator('.touch')).toHaveCount(2);await winner(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(40);await expect(page.locator('#app')).toHaveAttribute('data-phase','result');await retry(page);
});

test('viewport height and fullscreen changes preserve running countdown',async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(1450);await expect(page.locator('#center')).toHaveText('4');
 await page.setViewportSize({width:390,height:760});await page.evaluate(()=>document.dispatchEvent(new Event('fullscreenchange')));await page.clock.runFor(100);
 await expect(page.locator('#center')).toHaveText('4');await page.clock.runFor(950);await expect(page.locator('#center')).toHaveText('3');await page.clock.runFor(3000);await expect(page.locator('.chosen')).toHaveCount(1);
});

test('absent fullscreen and vibration APIs preserve core game',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{value:undefined});Object.defineProperty(navigator,'vibrate',{value:undefined});});
 await open(page);await page.locator('#app').tap({position:{x:100,y:200}});await participants(page);await winner(page);expect(errors).toEqual([]);
});

test('committed result survives hidden and visible without new input',async({page})=>{
 await open(page);await participants(page);await winner(page);const result=await page.locator('#result').getAttribute('aria-label');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(5000);await expect(page.locator('.touch')).toHaveCount(0);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(5000);await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
});

test('retry tap and keyboard activation never become game participants',async({page})=>{
 await open(page);await participants(page);await winner(page);
 await retry(page);await page.clock.runFor(6000);await expect(page.locator('.touch')).toHaveCount(0);await expect(page.locator('#result')).toBeHidden();
 // An old pointer's late move/up after restart must not join the new round.
 await pointer(page,'pointermove',1);await pointer(page,'pointerup',2);await expect(page.locator('.touch')).toHaveCount(0);
 await pointer(page,'pointerdown',11);await page.clock.runFor(6000);await expect(page.locator('#result')).toBeHidden();
 await pointer(page,'pointerdown',12,260);await winner(page);const result=await page.locator('#result').getAttribute('aria-label');
 await pointer(page,'pointerup',11);await pointer(page,'pointerup',12);await page.clock.runFor(6000);await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
 const button=page.getByRole('button',{name:'다시하기',exact:true});await expect(button).toBeFocused();await page.keyboard.press('Enter');await page.clock.runFor(40);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');await expect(page.locator('.touch')).toHaveCount(0);await expect(page.locator('#result')).toBeHidden();
});

test('nine touches receive unique requested photos; existing mapping and winner portrait stay consistent',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 const expected=await page.evaluate(async()=>{const {players}=await import('/src/players.ts');return players.map((p:{playerId:number;localAssetPath:string})=>({id:p.playerId,path:p.localAssetPath}));});
 expect(expected).toHaveLength(9);
 expect(expected.map(p=>p.id).sort((a,b)=>a-b)).toEqual([1642843,202681,1641726,1629023,1630230,1629655,1643516,1630583,1631108].sort((a,b)=>a-b));
 for(let id=1;id<=9;id++)await pointer(page,'pointerdown',id,70+((id-1)%3)*120,180+Math.floor((id-1)/3)*230);
 await expect(page.locator('.touch')).toHaveCount(9);
 const mapping=await page.locator('.touch').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.getAttribute('data-pointer-id'),n.querySelector('img')?.getAttribute('src')])));
 const paths=Object.values(mapping);expect(new Set(paths).size).toBe(9);expect([...paths].sort()).toEqual(expected.map(p=>p.path).sort());
 const colors=await page.locator('.touch').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.getAttribute('data-pointer-id'),getComputedStyle(n.querySelector('.face')!).borderTopColor])));
 expect(new Set(Object.values(colors)).size).toBe(9);
 for(const node of await page.locator('.touch').all()){
  const values=await node.evaluate(n=>({face:getComputedStyle(n.querySelector('.face')!).borderTopColor,ring:getComputedStyle(n.querySelector('.ring')!).borderTopColor,line:getComputedStyle(n.querySelector('.connector')!).backgroundColor,badge:getComputedStyle(n.querySelector('.participant')!).backgroundColor}));
  expect(values.ring).toBe(values.face);expect(values.line).toBe(values.face);expect(values.badge).toBe(values.face);
 }
 await pointer(page,'pointermove',1,140,190);await pointer(page,'pointerup',9);await pointer(page,'pointerdown',10,310,640);
 for(let id=1;id<=8;id++){
  await expect(page.locator(`.touch[data-pointer-id="${id}"] img`)).toHaveAttribute('src',mapping[String(id)]!);
  expect(await page.locator(`.touch[data-pointer-id="${id}"] .face`).evaluate(n=>getComputedStyle(n).borderTopColor)).toBe(colors[String(id)]);
 }
 await page.screenshot({path:testInfo.outputPath('nine-participants.png')});await winner(page);
 const chosen=await page.locator('.chosen img').getAttribute('src');await expect(page.locator('#result img')).toHaveAttribute('src',chosen!);
 const chosenId=await page.locator('.chosen').getAttribute('data-pointer-id');
 const winnerColor=await page.locator('.chosen .face').evaluate(n=>getComputedStyle(n).borderTopColor);
 if(chosenId!=='10')expect(winnerColor).toBe(colors[chosenId!]);
 expect(await page.locator('.chosen .ring').evaluate(n=>getComputedStyle(n).borderTopColor)).toBe(winnerColor);
 expect(await page.locator('#result .portrait').evaluate(n=>getComputedStyle(n).borderTopColor)).toBe(winnerColor);expect(errors).toEqual([]);
});

test('retry creates fresh randomized photo permutation with deterministic crypto inputs',async({page})=>{
 await page.addInitScript(()=>{
  let calls=0;
  Object.defineProperty(Crypto.prototype,'getRandomValues',{value:<T extends ArrayBufferView>(array:T):T=>{const values=array as unknown as Uint32Array;for(let i=0;i<values.length;i++)values[i]=calls++<9?0:1;return array;}});
 });
 await open(page);await participants(page);
 const first=await page.locator('.touch[data-pointer-id="1"] img').getAttribute('src');await winner(page);await retry(page);await participants(page);
 const second=await page.locator('.touch[data-pointer-id="1"] img').getAttribute('src');expect(second).not.toBe(first);
 await winner(page);await expect(page.locator('#result img')).toHaveAttribute('src',(await page.locator('.chosen img').getAttribute('src'))!);
});
