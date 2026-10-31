"use strict";
document.addEventListener("keydown",e=>{
 const k=e.key.toLowerCase();
 if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
 if(k==="arrowup"||k==="w")move(0,-1);
 if(k==="arrowdown"||k==="s")move(0,1);
 if(k==="arrowleft"||k==="a")move(-1,0);
 if(k==="arrowright"||k==="d")move(1,0);
 if(k===" "||k==="enter")interact();
});
place();requestAnimationFrame(loop);
