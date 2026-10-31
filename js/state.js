"use strict";
// v0.1.0 save key and game-state defaults are intentionally preserved.
const hero=document.getElementById("hero"),npc=document.getElementById("npc"),enemy=document.getElementById("enemy");
const dialog=document.getElementById("dialog"),battle=document.getElementById("battle"),statusEl=document.getElementById("status");
const fill=document.getElementById("atbFill"),attackBtn=document.getElementById("attack"),guardBtn=document.getElementById("guard"),log=document.getElementById("battleLog");
let x=20,y=50,hp=100,sp=30,enemyHp=60,atb=0;
let fighting=false,ready=false,guarding=false,enemyTimer=0;
let facing="right";
function place(){
  hero.style.left=x+"%";hero.style.top=y+"%";
  npc.style.left="55%";npc.style.top="30%";
  enemy.style.left="80%";enemy.style.top="65%";
  statusEl.textContent="KINGMAKER  HP "+hp+"/100  SP "+sp+"/30";
  const hud=document.getElementById("hudStatus");if(hud)hud.textContent="HP "+hp+"/100　SP "+sp+"/30";
  if(window.BSPhaserRefresh)window.BSPhaserRefresh();
}
// Shared dialogue controller. All text is temporary test content, not official canon.
const BSDialogue={lines:[],index:0,active:false};
function BSShowLine(){
 const line=BSDialogue.lines[BSDialogue.index];
 document.getElementById("dialogSpeaker").textContent=line.speaker||"";
 document.getElementById("dialogText").textContent=line.text;
 document.getElementById("dialogHint").textContent=BSDialogue.index+1<BSDialogue.lines.length?"タップ・調べるで次へ ▸":"タップ・調べるで閉じる ×";
}
function BSStartDialogue(lines){
 if(fighting||!lines||!lines.length)return;
 BSDialogue.lines=lines.map(l=>typeof l==="string"?{speaker:"",text:l}:l);
 BSDialogue.index=0;BSDialogue.active=true;dialog.style.display="block";
 if(window.BSPhaserStep)window.BSPhaserStep(false);
 BSShowLine();
}
function BSAdvanceDialogue(){
 if(!BSDialogue.active)return false;
 BSDialogue.index++;
 if(BSDialogue.index>=BSDialogue.lines.length){BSDialogue.active=false;dialog.style.display="none";}
 else BSShowLine();
 return true;
}
function say(t){BSStartDialogue([{speaker:"",text:t}]);}
dialog.addEventListener("click",BSAdvanceDialogue);

