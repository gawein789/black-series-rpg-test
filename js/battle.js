"use strict";
// The v0.1.0 test battle is retained; this is NOT the final WAIT-ATB system.
function startBattle(){
 fighting=true;ready=false;guarding=false;enemyHp=60;atb=0;enemyTimer=0;
 battle.style.display="block";document.body.classList.add("in-battle");log.textContent="開発用テスト戦闘、開始！";updateBattle();
}
function updateBattle(){
 document.getElementById("battleInfo").textContent="TEST ENEMY HP "+enemyHp+"/60  |  KINGMAKER HP "+hp+"/100";
 fill.style.width=atb+"%";attackBtn.disabled=!ready;guardBtn.disabled=!ready;place();
}
function attack(){if(!ready)return;enemyHp=Math.max(0,enemyHp-22);ready=false;atb=0;log.textContent="KINGMAKERの攻撃！ 22ダメージ！";if(enemyHp<=0){finish("勝利！ テスト戦闘完了。");return;}updateBattle();}
function guard(){if(!ready)return;guarding=true;ready=false;atb=0;log.textContent="防御態勢を取った。";updateBattle();}
function finish(t){fighting=false;ready=false;battle.style.display="none";document.body.classList.remove("in-battle");say(t);place();}
function escapeBattle(){finish("テスト戦闘から撤退した。");}
let last=performance.now();
function loop(now){
 const dt=Math.min((now-last)/1000,.1);last=now;
 if(fighting&&hp>0){
  if(!ready){atb=Math.min(100,atb+dt*34);if(atb>=100)ready=true;}
  if(!ready){enemyTimer+=dt;if(enemyTimer>=3.5){enemyTimer=0;const dmg=guarding?4:10;guarding=false;hp=Math.max(0,hp-dmg);log.textContent="敵の攻撃！ "+dmg+"ダメージ！";if(hp<=0){hp=100;finish("敗北。テスト用にHPを回復した。");}}}
  updateBattle();
 }
 requestAnimationFrame(loop);
}
