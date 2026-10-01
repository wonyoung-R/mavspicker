import {test,expect,type Page} from '@playwright/test';

async function pointer(page:Page,type:string,id:number,x=120,y=400){
  await page.locator('#app').evaluate((root,p)=>root.dispatchEvent(new PointerEvent(p.type,{pointerId:p.id,pointerType:'touch',clientX:p.x,clientY:p.y,bubbles:true})),{type,id,x,y});
  await page.clock.runFor(20);
}
async function open(page:Page,supported=true){if(supported)await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>5}));await page.clock.install();await page.goto('/');await page.clock.runFor(40);}
async function participants(page:Page,n=2){for(let id=1;id<=n;id++)await pointer(page,'pointerdown',id,60+id*42,440);}
async function winner(page:Page){await page.clock.runFor(3500);await expect(page.locator('#app')).toHaveAttribute('data-phase','result');await expect(page.locator('.chosen')).toHaveCount(1);}

test('0/1 touch and mouse input never draw; 3/2/1 produces one result',async({page})=>{
 await open(page);await page.clock.runFor(5000);await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');
 await page.locator('#app').dispatchEvent('pointerdown',{pointerId:88,pointerType:'mouse'});await expect(page.locator('.touch')).toHaveCount(0);
 await pointer(page,'pointerdown',1);await page.clock.runFor(5000);await expect(page.locator('#result')).toBeHidden();
 await pointer(page,'pointerdown',2,260);await page.clock.runFor(400);await expect(page.locator('#center')).toHaveText('3');
 await page.clock.runFor(1000);await expect(page.locator('#center')).toHaveText('2');
 await pointer(page,'pointermove',1,140,430);await page.clock.runFor(980);await expect(page.locator('#center')).toHaveText('1');
 await page.clock.runFor(1000);await expect(page.locator('.chosen')).toHaveCount(1);
});

for(const event of ['pointerup','pointercancel','lostpointercapture'])test(`${event} discards countdown; stale moves cannot revive touch`,async({page})=>{
 await open(page);await participants(page,3);await page.clock.runFor(3000);await pointer(page,event,3);
 await pointer(page,'pointermove',3);await expect(page.locator('.touch')).toHaveCount(2);
 await page.clock.runFor(500);await expect(page.locator('#center')).toHaveText('3');
 await page.clock.runFor(400);await expect(page.locator('#result')).toBeHidden();await winner(page);
});

test('added participant restarts countdown; winner stays fixed after release and new touch',async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(2800);await pointer(page,'pointerdown',3,280,500);
 await page.clock.runFor(450);await expect(page.locator('#center')).toHaveText('3');await winner(page);
 const id=Number(await page.locator('.chosen').getAttribute('data-pointer-id'));const result=await page.locator('#result').getAttribute('aria-label');
 await pointer(page,'pointerup',id);await pointer(page,'pointerdown',4);await page.clock.runFor(6000);
 await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);await expect(page.locator('.touch[data-pointer-id="4"]')).toHaveCount(0);
 for(const old of [1,2,3,4])await pointer(page,'pointerup',old);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');await expect(page.locator('#result')).toBeHidden();
 await participants(page);await winner(page);
});

for(const event of ['pagehide','blur','orientationchange'])test(`${event} clears interrupted pointers and preserves committed result`,async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(3000);await page.evaluate(e=>window.dispatchEvent(new Event(e)),event);await page.clock.runFor(5000);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');await expect(page.locator('.touch')).toHaveCount(0);
 await pointer(page,'pointermove',1);await expect(page.locator('.touch')).toHaveCount(0);
 await participants(page);await winner(page);const result=await page.locator('#result').getAttribute('aria-label');
 await page.evaluate(e=>window.dispatchEvent(new Event(e)),event);await page.clock.runFor(5000);
 await expect(page.locator('#result')).toHaveAttribute('aria-label',result!);
 await participants(page);await expect(page.locator('#result')).toBeHidden();await winner(page);
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
 expect(decoded).toHaveLength(5);expect(decoded.every(Boolean)).toBe(true);
 const points=[[2,2],[width-2,height-2],[width/2,height/2],[width/2+2,height/2],[width/2+4,height/2]];
 for(let i=0;i<n;i++)await pointer(page,'pointerdown',i+1,...points[i] as [number,number]);
 await page.clock.runFor(200);
 for(const face of await page.locator('.face').all()){const b=await face.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);}
 await page.screenshot({path:testInfo.outputPath('participants.png')});await winner(page);await expect(page.locator('#result h1')).not.toHaveText('');
 const b=await page.locator('#result').boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('result.png')});expect(errors).toEqual([]);
});

test('missing portrait uses named fallback; crypto exception stops draw',async({page})=>{
 await page.route('**/players/*.png',route=>route.abort());await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,'getRandomValues',{value:()=>{throw Error('unavailable');}});});
 await open(page);await participants(page);await page.clock.runFor(3500);await expect(page.locator('#app')).toHaveAttribute('data-phase','error');
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
 expect(await page.evaluate(()=>(window as unknown as {testCalls:{vibration:number[]}}).testCalls.vibration.filter(ms=>ms===40))).toEqual([40]);expect(errors).toEqual([]);
});

test('no multi-touch capability gives brief unsupported status',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0}));await open(page,false);await expect(page.locator('#center')).toHaveText('멀티터치 기기에서 열어 주세요');
 await participants(page);await page.clock.runFor(5000);await expect(page.locator('.touch')).toHaveCount(0);
});

test('Chromium CDP simultaneous touch input chooses one participant',async({page,context})=>{
 await open(page);const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:110,y:410,id:1},{x:260,y:410,id:2}]});await page.clock.runFor(40);await expect(page.locator('.touch')).toHaveCount(2);await winner(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(40);await expect(page.locator('#app')).toHaveAttribute('data-phase','idle');
});

test('viewport height and fullscreen changes preserve running countdown',async({page})=>{
 await open(page);await participants(page);await page.clock.runFor(1450);await expect(page.locator('#center')).toHaveText('2');
 await page.setViewportSize({width:390,height:760});await page.evaluate(()=>document.dispatchEvent(new Event('fullscreenchange')));await page.clock.runFor(100);
 await expect(page.locator('#center')).toHaveText('2');await page.clock.runFor(950);await expect(page.locator('#center')).toHaveText('1');await page.clock.runFor(1000);await expect(page.locator('.chosen')).toHaveCount(1);
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
