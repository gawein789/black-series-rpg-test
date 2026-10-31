"use strict";
const SAVE_KEY="black-series-rpg-test-v01";
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({x,y,hp,sp}));say("テストデータをこのブラウザに保存しました。");}catch(e){say("保存できませんでした。ブラウザの設定を確認してください。");}}
function load(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));if(!d){say("セーブデータがありません。");return;}
 if(![d.x,d.y,d.hp,d.sp].every(Number.isFinite))throw Error("invalid save");
 x=d.x;y=d.y;hp=d.hp;sp=d.sp;place();say("セーブデータを読み込みました。");
 }catch(e){say("読込に失敗しました。");}}
