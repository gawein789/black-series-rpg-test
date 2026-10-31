"use strict";
// Test-only solid obstacles in the 900x506 field; positions are field pixels.
// Collision uses the character's foot position and a small body radius.
const BS_OBSTACLES=[{x:320,y:85,w:75,h:170},{x:545,y:245,w:105,h:65},{x:695,y:70,w:60,h:105}];
function BSCanStand(px,py){
 const radius=11;
 return !BS_OBSTACLES.some(o=>px>o.x-radius&&px<o.x+o.w+radius&&py>o.y-radius&&py<o.y+o.h+radius);
}
function BSTryMove(dx,dy){
 const nx=Math.max(5,Math.min(95,x+dx)),ny=Math.max(8,Math.min(92,y+dy));
 // Slide along a wall rather than freezing diagonal movement.
 if(BSCanStand(900*nx/100,506*ny/100)){x=nx;y=ny;return true;}
 let moved=false;
 if(BSCanStand(900*nx/100,506*y/100)){x=nx;moved=true;}
 if(BSCanStand(900*x/100,506*ny/100)){y=ny;moved=true;}
 return moved;
}
function move(dx,dy){
 if(fighting||dialog.style.display==="block")return;
 BSTryMove(dx*5,dy*8);
 if(dx<0)facing="left";else if(dx>0)facing="right";else if(dy<0)facing="back";else if(dy>0)facing="front";
 place();
 if(window.BSPhaserStep)window.BSPhaserStep(true);
 if(window.BSStopTimer)clearTimeout(window.BSStopTimer);
 window.BSStopTimer=setTimeout(()=>{if(window.BSPhaserStep)window.BSPhaserStep(false);},220);
}
function near(a,b){return Math.abs(x-a)<13&&Math.abs(y-b)<17;}
// Test interactions use the same positions as the Phaser field markers.
// A small collision-safe radius keeps nearby objects easy to activate on phones.
const BS_INTERACTION_RANGE=90;
const BS_TEST_TARGETS=[
 {id:"npc",x:55,y:30,lines:[
  {speaker:"仮NPC",text:"こんにちは。ここは会話システムのテストエリアです。"},
  {speaker:"仮NPC",text:"会話中は移動できません。画面か『調べる』を押すと次に進みます。"},
  {speaker:"仮NPC",text:"KINGMAKERとLEVIATHAN、どちらでも話しかけられます。"}
 ]},
 {id:"object",x:55,y:30,offsetX:0,offsetY:0,disabled:true},
 {id:"enemy",x:80,y:65,battle:true}
];
function BSDistanceTo(tx,ty){return Math.hypot((x-tx)*9,(y-ty)*5.06);}
function interact(){
 if(fighting)return;
 if(BSDialogue.active){BSAdvanceDialogue();return;}
 const targets=[
  {x:55,y:30,run:()=>BSStartDialogue(BS_TEST_TARGETS[0].lines)},
  {x:80,y:65,run:()=>startBattle()}
 ];
 // Inspection point: the middle obstacle's top edge, separate from NPC and enemy.
 // Obstacle has a collision boundary, so the marker is reachable from below.
 targets.push({x:60,y:62,run:()=>BSStartDialogue([
  {speaker:"調査対象（仮）",text:"頑丈な設備が置かれている。"},
  {speaker:"調査対象（仮）",text:"これは開発用の調査テストです。アイテムの取得はまだありません。"}
 ])});
 let chosen=null,dist=Infinity;
 for(const t of targets){const d=BSDistanceTo(t.x,t.y);if(d<BS_INTERACTION_RANGE&&d<dist){chosen=t;dist=d;}}
 if(chosen)chosen.run();
 else BSStartDialogue([{speaker:"探索",text:"周囲を調べた。特に気になるものはない。"}]);
}
