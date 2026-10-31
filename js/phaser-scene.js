"use strict";
// Ver.0.2.8: per-character, per-direction horizontal silhouette matching; preserve sprite PNGs.
(function(){
 if(typeof Phaser==="undefined"){console.warn("Phaser unavailable: legacy field remains usable.");return;}
 const WIDTH=900,HEIGHT=506;
 const ROW={front:0,back:1,left:2,right:3};
 // Leviathan IDLE row 2 faces RIGHT; WALK row 2 faces LEFT.
 const SPRITE_ROW={
  kingmaker:{idle:ROW,walk:ROW},
  leviathan:{idle:{front:0,back:1,left:3,right:2},walk:ROW}
 };
 // Measured opaque sprite heights (px) in the official 128x160 source frames.
 // Idle and walk have different transparent margins; never edit the approved PNGs.
 const VISUAL_HEIGHT={kingmaker:{idle:149,walk:138.5},leviathan:{idle:143,walk:137.5}};
 const FOOT_Y={kingmaker:{idle:153,walk:150.5},leviathan:{idle:151,walk:150}};
 const BASE_SCALE=.65;
 // Width-only correction for LEVIATHAN idle. Avoid stretching walking frames.
 // Side views need more correction than front/back; tuning values are provisional.
 const IDLE_WIDTH_RATIO={front:1.08,back:1.10,left:1.20,right:1.20};
 // KINGMAKER right-facing walk source has a narrower silhouette than right-facing idle.
 const WALK_WIDTH_RATIO={kingmaker:{front:1,back:1,left:1,right:1.10},leviathan:{front:1,back:1,left:1,right:1}};
 const names=['kingmaker','leviathan'];
 // Exploration-only character speed (100% = baseline); combat speed is independent.
 const MOVE_SPEED={kingmaker:1.25,leviathan:.90};
 const FOLLOW={min:50,preferred:70,max:100,catchupMultiplier:2.2,basePixelsPerSecond:115,acceleration:450,deceleration:560};
 // LEVIATHAN only: reacts sooner and visibly hurries, without changing her normal 90% pace.
 const LEVI_HURRY={startDistance:83,fullDistance:145,acceleration:780,animationMax:1.65};
 // A* navigation fallback: 18px cells, conservative obstacle clearance.
 // Keep the approved leader-trail behavior on clear paths; reroute only if blocked.
 const NAV_CELL=18,NAV_COLS=Math.ceil(WIDTH/NAV_CELL),NAV_ROWS=Math.ceil(HEIGHT/NAV_CELL);
 const navFree=(cx,cy)=>cx>=0&&cy>=0&&cx<NAV_COLS&&cy<NAV_ROWS&&BSCanStand(Math.min(WIDTH-1,cx*NAV_CELL+NAV_CELL/2),Math.min(HEIGHT-1,cy*NAV_CELL+NAV_CELL/2));
 function navClear(ax,ay,bx,by){
  const len=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.ceil(len/6));
  for(let i=1;i<=n;i++){const t=i/n;if(!BSCanStand(ax+(bx-ax)*t,ay+(by-ay)*t))return false;}
  return true;
 }
 function navRoute(sx,sy,tx,ty){
  // Small obstacle maps: use a visibility graph around expanded rectangle corners.
  // Unlike grid snapping, waypoints are always directly reachable from the actor.
  if(!BSCanStand(sx,sy)||!BSCanStand(tx,ty))return null;
  if(navClear(sx,sy,tx,ty))return [{x:tx,y:ty}];
  const nodes=[{x:sx,y:sy},{x:tx,y:ty}];
  const clearance=18; // body radius (11px) + turning allowance
  for(const o of BS_OBSTACLES){
   for(const x of [o.x-clearance,o.x+o.w+clearance]){
    for(const y of [o.y-clearance,o.y+o.h+clearance]){
     if(x>8&&x<WIDTH-8&&y>8&&y<HEIGHT-8&&BSCanStand(x,y))nodes.push({x,y});
    }
   }
  }
  const dist=Array(nodes.length).fill(Infinity),prev=Array(nodes.length).fill(-1),visited=new Set();dist[0]=0;
  for(let k=0;k<nodes.length;k++){
   let u=-1;
   for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||dist[i]<dist[u]))u=i;
   if(u<0||!Number.isFinite(dist[u]))break;
   if(u===1)break;
   visited.add(u);
   for(let v=0;v<nodes.length;v++){
    if(v===u||visited.has(v)||!navClear(nodes[u].x,nodes[u].y,nodes[v].x,nodes[v].y))continue;
    const nd=dist[u]+Math.hypot(nodes[v].x-nodes[u].x,nodes[v].y-nodes[u].y);
    if(nd<dist[v]){dist[v]=nd;prev[v]=u;}
   }
  }
  if(!Number.isFinite(dist[1]))return null;
  const route=[];let at=1;
  while(at!==0){route.push(nodes[at]);at=prev[at];if(at<0)return null;}
  return route.reverse();
 }

 let sceneRef=null;
 class FieldScene extends Phaser.Scene{
  constructor(){super('TestField');this.actors={};this.heroSprite=null;this.heroName='kingmaker';this.currentAnimation='';this.followerSprite=null;this.followerAnimation='';this.trail=[];this.followerFacing='right';this.followDistance=FOLLOW.preferred;this.followSpeed=0;this.followerIsMoving=false;this.navPath=[];this.navCooldown=0;this.navGoal=null;}
  preload(){
   for(const name of names){
    this.load.spritesheet(name+'_idle','assets/characters/'+name+'_idle.png',{frameWidth:128,frameHeight:160,endFrame:11});
    this.load.spritesheet(name+'_walk','assets/characters/'+name+'_walk.png',{frameWidth:128,frameHeight:160,endFrame:15});
   }
  }
  create(){
   sceneRef=this;
   const g=this.add.graphics();g.fillGradientStyle(0x202b37,0x202b37,0x10151e,0x10151e,1);g.fillRect(0,0,WIDTH,HEIGHT);
   g.lineStyle(1,0xffffff,.035);
   for(let gx=0;gx<WIDTH;gx+=50)g.lineBetween(gx,0,gx,HEIGHT);
   for(let gy=0;gy<HEIGHT;gy+=50)g.lineBetween(0,gy,WIDTH,gy);
   // Visible solid props, deliberately placed away from the initial spawn and test NPC/enemy.
   const blocks=this.add.graphics().setDepth(2);
   for(const o of BS_OBSTACLES){
    blocks.fillStyle(0x354452,1);blocks.fillRoundedRect(o.x,o.y,o.w,o.h,8);
    blocks.lineStyle(3,0x8299a8,.9);blocks.strokeRoundedRect(o.x,o.y,o.w,o.h,8);
    blocks.lineStyle(1,0xffffff,.16);blocks.lineBetween(o.x+10,o.y+12,o.x+o.w-10,o.y+12);
   }
   const addActor=(label,color,outline)=>{
    const rect=this.add.rectangle(0,0,32,40,color).setStrokeStyle(2,outline);
    const txt=this.add.text(0,0,label,{fontFamily:'system-ui',fontSize:'22px',color:'#ffffff'}).setOrigin(.5);
    return {rect,txt};
   };
   this.actors.npc=addActor('♟',0x344c64,0x8cb3d6);
   this.actors.enemy=addActor('⚔',0x68442a,0xcfa47a);
   this.actors.inspect=addActor('?',0x315b56,0x9bcac1);
   for(const name of names){
    for(const dir of Object.keys(ROW)){
     const idleRow=SPRITE_ROW[name].idle[dir],walkRow=SPRITE_ROW[name].walk[dir];
     this.anims.create({key:name+'_idle_'+dir,frames:[0,1,2,1].map(i=>({key:name+'_idle',frame:idleRow*3+i})),frameRate:1.6,repeat:-1});
     this.anims.create({key:name+'_walk_'+dir,frames:[0,1,2,3].map(i=>({key:name+'_walk',frame:walkRow*4+i})),frameRate:1000/165,repeat:-1});
    }
   }
   this.heroSprite=this.add.sprite(0,0,'kingmaker_idle',0).setOrigin(.5,153/160).setScale(BASE_SCALE).setDepth(10);
   this.followerSprite=this.add.sprite(0,0,'leviathan_idle',0).setOrigin(.5,151/160).setScale(BASE_SCALE).setDepth(9);
   this.resetFollowerTrail('right');
   this.actors.heroFallback=addActor('♛',0x682538,0xe2a6b5);
   this.actors.heroFallback.rect.setVisible(false);this.actors.heroFallback.txt.setVisible(false);
   window.BSSetExplorationCharacter=(name)=>{
    if(!names.includes(name))return false;
    this.heroName=name;this.currentAnimation='';this.followerAnimation='';
    // Swap party roles without teleporting the follower across the map.
    this.resetFollowerTrail(facing);
    this.refreshHero(this.isMoving||false);return true;
   };
   window.BSPhaserRefresh=()=>{
    for(const [name,px,py] of [['npc',55,30],['enemy',80,65],['inspect',60,62]]){
     this.actors[name].rect.setPosition(WIDTH*px/100,HEIGHT*py/100);
     this.actors[name].txt.setPosition(WIDTH*px/100,HEIGHT*py/100);
    }
    this.refreshHero(this.isMoving||false);
   };
   window.BSPhaserStep=(moving)=>{this.isMoving=!!moving;this.refreshHero(this.isMoving);};
   window.BSPhaserRefresh();
   document.getElementById('field').classList.add('phaser-active');
  }
  resetFollowerTrail(dir){
   const px=WIDTH*x/100,py=HEIGHT*y/100;
   const offset={front:[0,-1],back:[0,1],left:[1,0],right:[-1,0]}[dir]||[-1,0];
   const fx=px+offset[0]*this.followDistance,fy=py+offset[1]*this.followDistance;
   // Start the follower at the end of a real 55px path, never at (0,0).
   this.trail=[{x:fx,y:fy},{x:px,y:py}];
   this.followerSprite.setPosition(fx,fy);
   this.followerFacing=dir;
   this.followerAnimation='';this.followSpeed=0;this.followerIsMoving=false;this.navPath=[];this.navCooldown=0;this.navGoal=null;
   if(this.followerSprite.anims)this.followerSprite.anims.timeScale=1;
  }
  // Record the leader's actual route; the follower advances along that route each frame.
  refreshFollower(px,py,moving){
   if(!this.followerSprite)return;
   const trail=this.trail;
   const last=trail[trail.length-1];
   if(Math.hypot(px-last.x,py-last.y)>.3)trail.push({x:px,y:py});
   // Trim the route behind the follower, preserving one preceding waypoint.
   if(trail.length>1800)trail.splice(0,trail.length-1800);
   this.followerSprite.setDepth(this.followerSprite.y<py?9:11);
  }
  update(time,delta){
   if(!this.followerSprite||!this.heroSprite||fighting)return;
   const dt=Math.min(delta/1000,.05);
   const px=WIDTH*x/100,py=HEIGHT*y/100;
   this.refreshFollower(px,py,this.isMoving);
   const trail=this.trail;
   // Find the point FOLLOW.preferred pixels back along the leader's actual path.
   let remaining=FOLLOW.preferred;
   let target=trail[0];
   for(let i=trail.length-1;i>0;i--){
    const a=trail[i],b=trail[i-1],len=Math.hypot(a.x-b.x,a.y-b.y);
    if(len>=remaining){const t=len?remaining/len:0;target={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};break;}
    remaining-=len;
   }
   const sprite=this.followerSprite;
   this.navCooldown=Math.max(0,this.navCooldown-dt);
   const blocked=!navClear(sprite.x,sprite.y,target.x,target.y);
   // A trailing waypoint may be on the far side of a wall. If its route fails,
   // try newer trail points and finally the leader's current reachable position.
   // Do not wait for the leader to return close to the stranded follower.
   if(blocked && (this.navCooldown===0 || !this.navPath.length || !this.navGoal || Math.hypot(target.x-this.navGoal.x,target.y-this.navGoal.y)>35)){
    const candidates=BSCanStand(target.x,target.y)?[target]:[];
    for(let i=trail.length-1;i>=0;i-=Math.max(1,Math.floor(trail.length/12)))if(BSCanStand(trail[i].x,trail[i].y))candidates.push(trail[i]);
    candidates.push({x:px,y:py});
    let route=null,chosen=null;
    for(const candidate of candidates){
     if(Math.hypot(candidate.x-sprite.x,candidate.y-sprite.y)<12)continue;
     const found=navRoute(sprite.x,sprite.y,candidate.x,candidate.y);
     if(found && found.length && found.every((point,i)=>i>0?navClear(found[i-1].x,found[i-1].y,point.x,point.y):navClear(sprite.x,sprite.y,point.x,point.y))){route=found;chosen=candidate;break;}
    }
    this.navPath=route||[];
    this.navGoal=chosen?{x:chosen.x,y:chosen.y}:null;
    this.navCooldown=route?.5:.18;
   }
   if(!blocked){this.navPath=[];this.navGoal=null;}
   while(this.navPath.length && Math.hypot(this.navPath[0].x-sprite.x,this.navPath[0].y-sprite.y)<7)this.navPath.shift();
   // Follow valid A* waypoints; retry if the chosen waypoint becomes unreachable.
   const aim=blocked?(this.navPath[0]||{x:sprite.x,y:sprite.y}):target;
   const dx=aim.x-sprite.x,dy=aim.y-sprite.y,dist=Math.hypot(dx,dy);
   const leaderDist=Math.hypot(px-sprite.x,py-sprite.y);
   const followerName=this.heroName==='kingmaker'?'leviathan':'kingmaker';
   const normal=FOLLOW.basePixelsPerSecond*MOVE_SPEED[followerName];
   // When the leader is inside the comfort band, the follower eases to a stop.
   // Outside it, smoothly accelerate up to 2.2x of the follower's own speed.
   const isLeviFollower=followerName==='leviathan';
   const needCatchup=leaderDist>(isLeviFollower?LEVI_HURRY.startDistance:FOLLOW.max);
   const catchupFraction=isLeviFollower
    ?Math.max(0,Math.min(1,(leaderDist-LEVI_HURRY.startDistance)/(LEVI_HURRY.fullDistance-LEVI_HURRY.startDistance)))
    :Math.max(0,Math.min(1,(leaderDist-FOLLOW.max)/65));
   const desired=dist<1.5?0:needCatchup
    ?normal*(1+(FOLLOW.catchupMultiplier-1)*catchupFraction)
    :Math.min(normal,normal*dist/22);
   const rate=desired>this.followSpeed&&isLeviFollower&&needCatchup?LEVI_HURRY.acceleration
    :desired>this.followSpeed?FOLLOW.acceleration:FOLLOW.deceleration;
   this.followSpeed+=Math.max(-rate*dt,Math.min(rate*dt,desired-this.followSpeed));
   const travel=Math.min(dist,this.followSpeed*dt);
   let moved=0;
   if(dist>.001&&travel>0){
    const nx=sprite.x+dx/dist*travel,ny=sprite.y+dy/dist*travel;
    if(navClear(sprite.x,sprite.y,nx,ny)){sprite.setPosition(nx,ny);moved=travel;}
    else {this.navCooldown=0;this.navPath=[];this.navGoal=null;this.followSpeed=0;}
   }
   const actualMoving=moved>.08;
   if(actualMoving)this.followerFacing=Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'back':'front');
   sprite.setDepth(sprite.y<py?9:11);
   const mode=actualMoving?'walk':'idle',dir=this.followerFacing;
   const key=followerName+'_'+mode+'_'+dir;
   if(this.followerAnimation!==key){
    const scale=BASE_SCALE*VISUAL_HEIGHT[followerName].idle/VISUAL_HEIGHT[followerName][mode];
    const widthRatio=(followerName==='leviathan'&&mode==='idle')?IDLE_WIDTH_RATIO[dir]:(mode==='walk'?WALK_WIDTH_RATIO[followerName][dir]:1);
    sprite.setScale(scale*widthRatio,scale).setOrigin(.5,FOOT_Y[followerName][mode]/160);
    sprite.play(key);this.followerAnimation=key;
   }
   // A quicker walking cadence makes LEVIATHAN look as if she is rushing to catch up.
   // Keep official sprites untouched; restore the ordinary cadence as she settles.
   if(sprite.anims&&sprite.anims.currentAnim){
    const hurryRatio=isLeviFollower&&needCatchup&&actualMoving
     ?Math.min(LEVI_HURRY.animationMax,Math.max(1,this.followSpeed/normal)):1;
    sprite.anims.timeScale=hurryRatio;
   }
   // Drop route points already passed; never skip corners ahead of the follower.
   while(trail.length>2){
    const a=trail[0],b=trail[1];
    const vx=b.x-a.x,vy=b.y-a.y,len2=vx*vx+vy*vy;
    if(len2<.01){trail.shift();continue;}
    const projection=((sprite.x-a.x)*vx+(sprite.y-a.y)*vy)/len2;
    if(projection>=1)trail.shift();else break;
   }
  }
  refreshHero(moving){
   if(!this.heroSprite)return;
   const px=WIDTH*x/100,py=HEIGHT*y/100;
   this.heroSprite.setPosition(px,py);
   this.refreshFollower(px,py,moving);
   const mode=moving?'walk':'idle',dir=ROW[facing]!==undefined?facing:'front';
   const key=this.heroName+'_'+mode+'_'+dir;
   if(this.currentAnimation!==key){
    // Preserve the same on-screen apparent height and the same ground contact point.
    const scale=BASE_SCALE*VISUAL_HEIGHT[this.heroName].idle/VISUAL_HEIGHT[this.heroName][mode];
    const widthRatio=(this.heroName==='leviathan' && mode==='idle')?IDLE_WIDTH_RATIO[dir]:(mode==='walk'?WALK_WIDTH_RATIO[this.heroName][dir]:1);
    this.heroSprite.setScale(scale*widthRatio,scale);
    this.heroSprite.setOrigin(.5,FOOT_Y[this.heroName][mode]/160);
    this.heroSprite.play(key);
    this.currentAnimation=key;
   }
  }
 }
 try{new Phaser.Game({type:Phaser.CANVAS,parent:'phaser-root',width:WIDTH,height:HEIGHT,transparent:true,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[FieldScene],render:{pixelArt:false,antialias:true}});}
 catch(e){console.error('Phaser initialization failed; legacy field retained.',e);}
})();
