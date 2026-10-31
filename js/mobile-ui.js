"use strict";
// v0.2.4: joystick is an overlay; legacy keyboard/D-pad, battle and save remain intact.
(function(){
 const stick=document.getElementById('joystick'),knob=document.getElementById('stickKnob');
 const menu=document.getElementById('utilityMenu');
 let activeId=null,vector={dx:0,dy:0},frame=null,lastTime=0;
 // Continuous movement: measured in percentage points per second, not grid jumps.
 const SPEED_X=16,SPEED_Y=28;
 const EXPLORATION_SPEED={kingmaker:1.25,leviathan:.90};
 function stop(){
  activeId=null;vector={dx:0,dy:0};lastTime=0;
  knob.style.left='50%';knob.style.top='50%';
  if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  if(window.BSPhaserStep)window.BSPhaserStep(false);
 }
 function update(e){
  const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const dx=e.clientX-cx,dy=e.clientY-cy,limit=r.width*.29,length=Math.hypot(dx,dy);
  const ratio=length?Math.min(1,limit/length):0;
  knob.style.left=`calc(50% + ${dx*ratio}px)`;
  knob.style.top=`calc(50% + ${dy*ratio}px)`;
  vector=length>limit*.24?{dx:dx/length,dy:dy/length}:{dx:0,dy:0};
 }
 function tick(now){
  if(activeId===null){frame=null;return;}
  const dt=lastTime?Math.min((now-lastTime)/1000,.05):0;lastTime=now;
  if((vector.dx||vector.dy)&&!fighting&&dialog.style.display!=="block"){
   BSTryMove(vector.dx*SPEED_X*dt*(EXPLORATION_SPEED[document.getElementById('characterSelect').value]||1),vector.dy*SPEED_Y*dt*(EXPLORATION_SPEED[document.getElementById('characterSelect').value]||1));
   if(Math.abs(vector.dx)>=Math.abs(vector.dy))facing=vector.dx<0?'left':'right';
   else facing=vector.dy<0?'back':'front';
   place();
   if(window.BSPhaserStep)window.BSPhaserStep(true);
  }else if(window.BSPhaserStep)window.BSPhaserStep(false);
  frame=requestAnimationFrame(tick);
 }
 stick.addEventListener('pointerdown',e=>{
  if(activeId!==null||fighting)return;
  activeId=e.pointerId;stick.setPointerCapture(e.pointerId);update(e);
  lastTime=0;frame=requestAnimationFrame(tick);e.preventDefault();
 });
 stick.addEventListener('pointermove',e=>{if(e.pointerId===activeId){update(e);e.preventDefault();}});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,e=>{if(e.pointerId===activeId)stop();});
 window.addEventListener('blur',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.toggleUtilityMenu=()=>{menu.classList.toggle('open');};
 window.switchCharacter=()=>{const sel=document.getElementById('characterSelect');const next=sel.value==='kingmaker'?'leviathan':'kingmaker';sel.value=next;if(window.BSSetExplorationCharacter)window.BSSetExplorationCharacter(next);document.getElementById('hudName').textContent=next.toUpperCase();};
 document.getElementById('characterSelect').addEventListener('change',e=>{document.getElementById('hudName').textContent=e.target.value.toUpperCase();});
 // Avoid accidental joystick input while battle overlay is shown.
 const observer=new MutationObserver(()=>{if(document.body.classList.contains('in-battle'))stop();});observer.observe(document.body,{attributes:true,attributeFilter:['class']});
})();
