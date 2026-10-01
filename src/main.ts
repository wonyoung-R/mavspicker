import './style.css';
import {Game} from './game';
import {bindInput} from './input';
import {Renderer} from './render';
import {preloadPlayers} from './players';
const root=document.querySelector<HTMLElement>('#app')!;
const center=document.querySelector<HTMLElement>('#center')!;
let retry=()=>{};
const renderer=new Renderer(root,center,document.querySelector('#faces')!,document.querySelector('#result')!,()=>retry());
const vibrate=(ms:number)=>{try{navigator.vibrate?.(ms);}catch{/* Optional hardware capability. */}};
let fullscreenAttempted=false;
function fullscreen(){
 if(fullscreenAttempted||document.fullscreenElement||!document.fullscreenEnabled||!root.requestFullscreen||!navigator.userActivation?.isActive)return;
 fullscreenAttempted=true;
 try{void root.requestFullscreen().catch(()=>{});}catch{/* Continue in browser. */}
}
const game=new Game({active:()=>document.visibilityState==='visible',onChange:s=>renderer.update(s),onWin:()=>vibrate(80)});
const supported='PointerEvent' in window&&navigator.maxTouchPoints>=2;
if(supported){
 const input=bindInput(root,game,fullscreen);
 retry=input.retry;
 const suspend=()=>{renderer.cancel();input.interrupt();vibrate(0);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
 window.addEventListener('pagehide',suspend);
 window.addEventListener('blur',suspend);
 let orientation=screen.orientation?.angle ?? window.orientation;
 const rotate=()=>{const next=screen.orientation?.angle ?? window.orientation;if(next!==orientation){orientation=next;suspend();}renderer.update(game.state);};
 screen.orientation?.addEventListener('change',rotate);window.addEventListener('orientationchange',()=>{suspend();renderer.update(game.state);});
 window.addEventListener('resize',()=>{rotate();renderer.update(game.state);});
 window.visualViewport?.addEventListener('resize',()=>renderer.update(game.state));
 document.addEventListener('fullscreenchange',()=>renderer.update(game.state));
 document.addEventListener('fullscreenerror',()=>{fullscreenAttempted=true;});
 renderer.update(game.state);
 void preloadPlayers().then(()=>renderer.update(game.state));
}else{center.textContent='멀티터치 기기에서 열어 주세요';center.setAttribute('aria-label','멀티터치 미지원');}
