import * as THREE from 'three';
import { LEVELS, STEP, loadSave, storeSave, formatTime } from './config.js';
import { TrialPhysics } from './physics.js';
import { TrialWorld } from './world.js';
import { AudioSystem } from './audio.js';

const app=document.getElementById('app');
const overlay=document.getElementById('overlay');
const hud=document.getElementById('hud');
const touch=document.getElementById('touch');
const countdownEl=document.getElementById('countdown');
const toastEl=document.getElementById('toast');
const timeEl=document.getElementById('time');
const faultsEl=document.getElementById('faults');
const progressEl=document.getElementById('progress-fill');
const checkpointDot=document.getElementById('checkpoint-dot');
const hudLevel=document.getElementById('hud-level');
const muteBtn=document.getElementById('mute');

const save=loadSave();
const audio=new AudioSystem(save.muted);
const input={gas:false,brake:false,left:false,right:false};
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
const gl=renderer.getContext(),gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');
const gpuName=gpuInfo?gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL):'unknown';
const softwareGPU=/swiftshader|llvmpipe|software/i.test(gpuName);
renderer.setPixelRatio(softwareGPU?1:Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=!softwareGPU;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.outputColorSpace=THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color('#8fa9aa');
const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,100);
camera.position.set(6,3,20);camera.lookAt(6,3,0);
scene.add(new THREE.HemisphereLight(0xd8e6e4,0x514335,2.15));
const sun=new THREE.DirectionalLight(0xffe0ac,3.1);sun.position.set(-7,12,16);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=.5;sun.shadow.camera.far=55;sun.shadow.bias=-.0007;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9eb9c2,.6);fill.position.set(8,2,10);scene.add(fill);

let selectedLevel=0,level=null,physics=null,world=null;
let state='title',elapsed=0,faults=0,checkpointReached=false,countdown=0;
let accumulator=0,simTime=0,cameraX=6,cameraY=3,shake=0,toastTimer=0,capturePaused=false;
let fps=60,fpsFrames=0,fpsElapsed=0;
const clock=new THREE.Clock();
const cameraTarget=new THREE.Vector3();

function medalFor(time,errors){
  if(time<=level.gold&&errors===0)return {name:'ЗОЛОТО',color:'#f2b544'};
  if(time<=level.silver&&errors<=2)return {name:'СЕРЕБРО',color:'#c5cecb'};
  return {name:'БРОНЗА',color:'#c78356'};
}

function setupLevel(index){
  selectedLevel=index;level=LEVELS[index];
  if(world)world.dispose();
  physics=new TrialPhysics(level,(reason)=>crash(reason));
  world=new TrialWorld(scene,level);
  scene.background.set(level.palette.skyTop);
  cameraX=level.spawn.x+3;cameraY=level.spawn.y+2.6;
  hudLevel.textContent=`${level.number} / ${level.name} — ${level.subtitle}`;
  checkpointDot.style.left=`${(level.checkpoint.x-level.spawn.x)/(level.finish-level.spawn.x)*100}%`;
  world.sync(physics,input,0,0);
}

function bestText(id){
  const best=save.bests[id];return best&&Number.isFinite(best.time)?formatTime(best.time):'—';
}

function showTitle(){
  state='title';hud.classList.add('hidden');touch.classList.add('hidden');countdownEl.classList.add('hidden');
  physics.reset(level.spawn);world.setCheckpoint(false);checkpointReached=false;accumulator=0;
  renderTitle();
}

function renderTitle(){
  overlay.classList.remove('hidden');
  overlay.innerHTML=`<section class="panel">
    <div class="eyebrow">Физический мототриал / HTML + JS</div>
    <h1 class="title">GRAVEL <span>TRIAL</span></h1>
    <p class="lead">Дорога заканчивается там, где начинается баланс. Проходи рельеф без падений, контролируй вес гонщика и не дай раме коснуться земли.</p>
    <div class="menu-grid">
      <div><p class="section-label">Выбери трассу</p><div class="level-list">
        ${LEVELS.map((item,i)=>`<button class="level-card ${i===selectedLevel?'selected':''}" data-level="${i}" ${i>=save.unlocked?'disabled':''}>
          <span class="num">${i>=save.unlocked?'ЗАКРЫТО':item.number}</span><strong>${item.name}</strong><small>${item.subtitle}</small><span class="best">${i<save.unlocked?bestText(item.id):''}</span>
        </button>`).join('')}
      </div></div>
      <div><p class="section-label">Управление</p><div class="controls-grid">
        <div class="control-row"><span class="keys"><i class="key">W</i><i class="key">↑</i></span><span>Газ</span></div>
        <div class="control-row"><span class="keys"><i class="key">S</i><i class="key">↓</i></span><span>Тормоз / назад</span></div>
        <div class="control-row"><span class="keys"><i class="key">A</i><i class="key">←</i></span><span>Наклон назад</span></div>
        <div class="control-row"><span class="keys"><i class="key">D</i><i class="key">→</i></span><span>Наклон вперёд</span></div>
        <div class="control-row"><span class="keys"><i class="key">R</i></span><span>К контрольной точке</span></div>
        <div class="control-row"><span class="keys"><i class="key">P</i></span><span>Пауза</span></div>
      </div></div>
    </div>
    <div class="actions"><button id="start" class="primary">Поехали<span class="desktop-only"> / Space</span></button><button id="title-mute" class="secondary">${save.muted?'Включить звук':'Выключить звук'}</button></div>
    <p class="fineprint">${level.description} Рекорды сохраняются только в этом браузере.</p>
  </section>`;
  overlay.querySelectorAll('[data-level]').forEach(btn=>btn.addEventListener('click',()=>{
    audio.ensure();audio.click();setupLevel(Number(btn.dataset.level));renderTitle();
  }));
  document.getElementById('start').addEventListener('click',()=>startRun());
  document.getElementById('title-mute').addEventListener('click',()=>{audio.ensure();toggleMute();renderTitle();});
}

function startRun(){
  audio.ensure();audio.click();elapsed=0;faults=0;checkpointReached=false;
  physics.reset(level.spawn);world.setCheckpoint(false);accumulator=0;
  state='countdown';countdown=2.75;overlay.classList.add('hidden');hud.classList.remove('hidden');touch.classList.remove('hidden');
  countdownEl.classList.remove('hidden');updateHUD();
}

function retryCheckpoint(manual=false){
  audio.ensure();audio.click();if(manual)faults++;
  physics.reset(checkpointReached?level.checkpoint:level.spawn);accumulator=0;
  state='countdown';countdown=1.75;overlay.classList.add('hidden');hud.classList.remove('hidden');touch.classList.remove('hidden');
  countdownEl.classList.remove('hidden');updateHUD();
}

function pauseGame(){
  if(state!=='playing'&&state!=='countdown')return;
  state='paused';touch.classList.add('hidden');countdownEl.classList.add('hidden');audio.click();
  overlay.classList.remove('hidden');
  overlay.innerHTML=`<section class="panel compact"><div class="eyebrow">Двигатель заглушен</div><h2 class="result-title">Пауза</h2><p class="result-sub">Трасса подождёт. Таймер остановлен.</p><div class="actions"><button id="resume" class="primary">Продолжить</button><button id="restart" class="secondary">С начала</button><button id="menu" class="secondary">В меню</button></div></section>`;
  document.getElementById('resume').addEventListener('click',resumeGame);
  document.getElementById('restart').addEventListener('click',startRun);
  document.getElementById('menu').addEventListener('click',showTitle);
}

function resumeGame(){
  audio.ensure();audio.click();state='playing';overlay.classList.add('hidden');touch.classList.remove('hidden');clock.getDelta();
}

function crash(reason){
  if(state!=='playing')return;
  state='crashed';faults++;shake=.65;audio.crash();world.burst(physics.position.x,physics.position.y,false);touch.classList.add('hidden');
  updateHUD();overlay.classList.remove('hidden');
  overlay.innerHTML=`<section class="panel compact"><div class="eyebrow">Ошибка ${faults}</div><h2 class="result-title crash">Падение</h2><p class="result-sub">${reason}. Вернись на трассу с последней контрольной точки.</p><div class="stats"><div class="stat"><b>${formatTime(elapsed)}</b><small>ВРЕМЯ</small></div><div class="stat"><b>${faults}</b><small>ОШИБКИ</small></div><div class="stat"><b>${Math.round(Math.max(0,Math.min(1,(physics.position.x-level.spawn.x)/(level.finish-level.spawn.x)))*100)}%</b><small>ПРОЙДЕНО</small></div></div><div class="actions"><button id="retry" class="primary">Ещё раз / R</button><button id="restart" class="secondary">С начала</button><button id="menu" class="secondary">В меню</button></div></section>`;
  document.getElementById('retry').addEventListener('click',()=>retryCheckpoint());
  document.getElementById('restart').addEventListener('click',startRun);
  document.getElementById('menu').addEventListener('click',showTitle);
}

function completeLevel(){
  if(state!=='playing')return;
  state='victory';touch.classList.add('hidden');audio.finish();world.burst(physics.position.x,physics.position.y+1,true);
  const medal=medalFor(elapsed,faults),old=save.bests[level.id];
  const isRecord=!old||!Number.isFinite(old.time)||elapsed<old.time;
  if(isRecord)save.bests[level.id]={time:elapsed,faults,medal:medal.name};
  save.unlocked=Math.max(save.unlocked,Math.min(LEVELS.length,selectedLevel+2));storeSave(save);
  overlay.classList.remove('hidden');
  overlay.innerHTML=`<section class="panel compact"><div class="eyebrow">Трасса ${level.number} пройдена</div><h2 class="result-title">Финиш!</h2><div class="medal" style="color:${medal.color}">●</div><div class="eyebrow" style="color:${medal.color}">${medal.name}</div><div class="stats"><div class="stat"><b>${formatTime(elapsed)}</b><small>ВРЕМЯ</small></div><div class="stat"><b>${faults}</b><small>ОШИБКИ</small></div><div class="stat"><b>${bestText(level.id)}</b><small>РЕКОРД</small></div></div>${isRecord?'<div class="record">НОВЫЙ ЛИЧНЫЙ РЕКОРД</div>':''}<div class="actions">${selectedLevel<LEVELS.length-1?'<button id="next" class="primary">Следующая трасса</button>':''}<button id="restart" class="secondary">Улучшить время</button><button id="menu" class="secondary">В меню</button></div></section>`;
  const next=document.getElementById('next');if(next)next.addEventListener('click',()=>{setupLevel(selectedLevel+1);startRun();});
  document.getElementById('restart').addEventListener('click',startRun);
  document.getElementById('menu').addEventListener('click',showTitle);
}

function reachCheckpoint(){
  checkpointReached=true;world.setCheckpoint(true);audio.checkpoint();world.burst(level.checkpoint.x,level.checkpoint.y+1,false);
  toastEl.classList.add('show');toastTimer=2.1;
}

function toggleMute(){
  save.muted=!save.muted;audio.setMuted(save.muted);storeSave(save);updateMute();
}
function updateMute(){muteBtn.textContent=save.muted?'×':'♪';muteBtn.setAttribute('aria-label',save.muted?'Включить звук':'Выключить звук');}
muteBtn.addEventListener('click',()=>{audio.ensure();toggleMute();});
document.getElementById('pause').addEventListener('click',pauseGame);

function updateHUD(){
  timeEl.textContent=formatTime(elapsed);faultsEl.textContent=String(faults);
  const progress=Math.max(0,Math.min(1,(physics.position.x-level.spawn.x)/(level.finish-level.spawn.x)));
  progressEl.style.width=`${progress*100}%`;checkpointDot.classList.toggle('active',checkpointReached);
}

const keyMap={KeyW:'gas',ArrowUp:'gas',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
addEventListener('keydown',event=>{
  if(keyMap[event.code]){input[keyMap[event.code]]=true;event.preventDefault();}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Space'&&state==='title')startRun();
  else if(event.code==='Space'&&state==='victory'){
    if(selectedLevel<LEVELS.length-1){setupLevel(selectedLevel+1);startRun();}else startRun();
  }
  else if(event.code==='KeyR'&&(state==='playing'||state==='countdown'))retryCheckpoint(true);
  else if(event.code==='KeyR'&&state==='crashed')retryCheckpoint();
  else if((event.code==='KeyP'||event.code==='Escape')&&(state==='playing'||state==='countdown'))pauseGame();
  else if((event.code==='KeyP'||event.code==='Escape')&&state==='paused')resumeGame();
  else if(event.code==='KeyM'){audio.ensure();toggleMute();}
});
addEventListener('keyup',event=>{if(keyMap[event.code]){input[keyMap[event.code]]=false;event.preventDefault();}});
addEventListener('blur',()=>{Object.keys(input).forEach(k=>input[k]=false);if(state==='playing')pauseGame();});

document.querySelectorAll('[data-control]').forEach(btn=>{
  const control=btn.dataset.control;
  const release=event=>{input[control]=false;btn.classList.remove('active');if(event)event.preventDefault();};
  btn.addEventListener('pointerdown',event=>{event.preventDefault();btn.setPointerCapture(event.pointerId);input[control]=true;btn.classList.add('active');audio.ensure();});
  btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);btn.addEventListener('lostpointercapture',release);
});

function resize(){
  const aspect=innerWidth/innerHeight,viewHeight=innerWidth<700?10.5:9.2;
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(softwareGPU?1:Math.min(devicePixelRatio,2));
}
addEventListener('resize',resize);resize();

function updateCamera(dt){
  const p=physics.position;
  if(state==='title'){
    cameraTarget.set(level.spawn.x+4.2+Math.sin(simTime*.16)*.8,level.spawn.y+2.4,20);
  }else{
    const portrait=innerWidth<700,lead=portrait?.55:2.25,speedLead=portrait?.05:.12;
    cameraTarget.set(Math.max(4.5,Math.min(level.length-2,p.x+lead+Math.max(-.6,Math.min(1.4,physics.speed*speedLead)))),p.y+1.05,20);
  }
  const blend=1-Math.exp(-dt*4.2);cameraX+=(cameraTarget.x-cameraX)*blend;cameraY+=(cameraTarget.y-cameraY)*blend;
  shake=Math.max(0,shake-dt*1.5);
  const sx=shake*Math.sin(simTime*83)*.16,sy=shake*Math.cos(simTime*71)*.12;
  camera.position.set(cameraX+sx,cameraY+sy,20);camera.lookAt(cameraX+sx,cameraY+sy,0);
  sun.position.set(cameraX-7,cameraY+10,16);sun.target.position.set(cameraX,cameraY,0);sun.target.updateMatrixWorld();
  world.updateCameraLayers(cameraX);
}

function fixedUpdate(){
  if(state!=='playing')return;
  physics.step(input);elapsed+=STEP;simTime+=STEP;
  if(!checkpointReached&&physics.position.x>=level.checkpoint.x)reachCheckpoint();
  if(physics.position.x>=level.finish)completeLevel();
}

function animate(){
  const rawDt=clock.getDelta(),dt=Math.min(rawDt,.075);
  if(!capturePaused){
    if(state==='countdown'){
      countdown-=Math.min(rawDt,.35);const n=Math.ceil(countdown);countdownEl.textContent=countdown<.55?'ГАЗ!':String(Math.max(1,n));
      if(countdown<=0){state='playing';countdownEl.classList.add('hidden');}
    }
    if(state==='playing'){
      accumulator+=dt;let safety=0;while(accumulator>=STEP&&safety++<5){fixedUpdate();accumulator-=STEP;}
    }else simTime+=dt*.25;
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastEl.classList.remove('show');}
    world.sync(physics,input,dt,simTime);updateCamera(dt);updateHUD();
    audio.update(physics.speed,input.gas?1:0,state==='playing'||state==='countdown');
    fpsFrames++;fpsElapsed+=rawDt;if(fpsElapsed>=1){fps=fpsFrames/fpsElapsed;fpsFrames=0;fpsElapsed=0;}
  }
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

setupLevel(0);showTitle();updateMute();
scene.add(sun.target);

window.__gameProbe=()=>({
  state,level:level.id,x:physics.position.x,y:physics.position.y,speed:physics.speed,angle:-physics.bike.chassis.angle,grounded:physics.grounded,
  faults,elapsed,checkpointReached,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(fps),
  muted:save.muted,unlocked:save.unlocked,gpu:gpuName,quality:softwareGPU?'reduced':'full'
});
window.__trialTest={
  startLevel:(i=0)=>{setupLevel(Math.max(0,Math.min(LEVELS.length-1,i)));startRun();},
  skipCountdown:()=>{if(state==='countdown'){countdown=0;state='playing';countdownEl.classList.add('hidden');}},
  crash:()=>crash('Тестовое падение'),finish:()=>completeLevel(),checkpoint:()=>reachCheckpoint(),
  pause:pauseGame,resume:resumeGame,retry:()=>retryCheckpoint(),menu:showTitle,
  drive:(frames=60,controls={gas:true})=>{
    if(controls)Object.assign(input,{gas:false,brake:false,left:false,right:false},controls);
    for(let i=0;i<frames;i++)fixedUpdate();
    Object.keys(input).forEach(key=>input[key]=false);world.sync(physics,input,0,simTime);updateHUD();
  }
};
window.__seek=(t)=>{capturePaused=true;simTime=Number(t)||0;world.sync(physics,input,0,simTime);updateCamera(1);renderer.render(scene,camera);};
window.__play=()=>{capturePaused=false;clock.getDelta();};
const timeParam=new URLSearchParams(location.search).get('t');if(timeParam!==null)window.__seek(timeParam);
window.__SCENE_READY__=true;
