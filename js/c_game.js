"use strict";
/* Gate Rush game loop, rules in motion, UI */
var state='menu',prevState='run',cardMode='menu',pz=0,px=0,count=5,frac=0,time=0,shake=0,flash=0,pop=0,popBad=false,freeze=0;
var lastStand=false,popups=[],bullets=[],parts=[],fireT=0,keepWeapon=false,lostTo='',hintMsg='',hintT=0,hintDur=1;
var sup={drone:{left:0},arty:{left:0},air:{left:0}};
var droneT=0,droneTg=null,artyT=0,artyShells=0,artyNext=0,artyZ=0,airT=0,airAnim=0;

function setCount(n){n=Math.max(0,Math.min(CAP,Math.round(n)));if(n!==count){popBad=n<count;pop=1;count=n;}}
function popup(text,color,x,y,small){popups.push({text:text,color:color,x:x,y:y,t:0,big:!small});}
function part(x,y,vx,vy,life,r,col,grav,ring){
  if(parts.length>320)return;
  parts.push({x:x,y:y,vx:vx,vy:vy,life:life,max:life,r:r,col:col,g:grav||0,ring:!!ring});
}
function burst(x,y,n,cols,spd,r,life,grav){
  for(var i=0;i<n;i++){
    var a=rnd()*TAU,v=spd*(0.3+rnd()*0.7);
    part(x,y,Math.cos(a)*v,Math.sin(a)*v-spd*0.3,life*(0.6+rnd()*0.4),r*(0.6+rnd()*0.8),cols[i%cols.length],grav);
  }
}
function boomFx(x,y,sc){
  if(window.R3&&R3.ok)R3.boom(x,y,sc);
  part(x,y,0,0,0.12,roadHalf*0.22*sc+6,'#fff6d8');
  part(x,y,0,0,0.4,roadHalf*0.1*sc+4,'#ffb347',0,true);
  part(x,y,0,0,0.55,roadHalf*0.16*sc+5,'rgba(255,255,255,.6)',0,true);
  for(var k=0;k<5;k++)part(x+(rnd()-0.5)*30*sc,y-rnd()*14*sc,(rnd()-0.5)*26*sc,-(18+rnd()*30)*sc,0.9+rnd()*0.5,(9+rnd()*8)*sc+2,'rgba(70,70,76,.55)');
  burst(x,y,12,['#ff9c3a','#ffe27a','#6b6b6b','#e2cda2'],140*sc+40,7*sc+2,0.5,80);
}
function hint(key,msg,dur){
  if(save.hints[key]||hintT>1.2)return;
  save.hints[key]=1;persist();hintMsg=msg;hintDur=hintT=dur||4.5;
}

function startLevel(){
  if(!keepWeapon)weapon='m16';keepWeapon=false;
  genLevel(level);
  pz=0;px=0;count=startCount();frac=0;popups=[];bullets=[];parts=[];shake=0;flash=0;pop=0;freeze=0;fireT=0;lostTo='';hintT=0;lastStand=false;
  resetSup();updateHud();$('lvl').textContent='Mission '+level;$('vig').style.opacity=THEMES[theme].vig;
}
function updateHud(){$('medals').textContent='Medals '+save.medals;}

/* ---------- support ---------- */
function refreshSup(){
  for(var i=0;i<SUPDEF.length;i++){
    var d=SUPDEF[i],b=$('s-'+d[0]);
    b.hidden=level<d[2];b.disabled=sup[d[0]].left<=0;b.textContent=BR().sup[d[0]]+' ×'+sup[d[0]].left;
  }
}
function resetSup(){
  sup.drone.left=2;sup.arty.left=level>=2?1:0;sup.air.left=level>=3?1:0;
  droneT=artyT=airT=airAnim=0;artyShells=0;droneTg=null;refreshSup();
}
function useSupport(k){
  if(state!=='run'||!sup[k]||sup[k].left<=0)return;
  if(k==='drone'){if(droneT>0)return;droneT=8;popup(BR().say.drone,'#a8e6ff',W/2,H*0.42);if(SFX.buf.drone)droneLoop(8);else beep(1200,0.08,'sine',0.06);}
  else if(k==='arty'){if(artyT>0||artyShells>0)return;artyT=1;artyZ=pz+86;popup(BR().say.arty,'#ffd23f',W/2,H*0.42);if(!sfx('boom_far',0.7))beep(300,0.25,'triangle',0.06);}
  else{if(airT>0||airAnim>0)return;airT=1.1;popup(BR().say.air,'#ffd23f',W/2,H*0.42);if(!sfx(BR().air==='helo'?'helo':'jet',0.85))noise(1.1,0.05,'bandpass',500,0.6);}
  sup[k].left--;refreshSup();buzz(15);
}
function isTarget(fo){return (fo.type==='foe'||fo.type==='barrel')&&!fo.done;}
function supportTick(dt){
  var i,fo,m=supMul();
  if(droneT>0){
    droneT-=dt;droneTg=null;
    var bestZ=1e9;
    for(i=0;i<items.length;i++){fo=items[i];if(fo.type==='foe'&&!fo.done&&fo.z-pz>-2&&fo.z-pz<110&&fo.z<bestZ){bestZ=fo.z;droneTg=fo;}}
    var d=(0.5*count+2)*m*dt;
    if(droneTg){
      hurt(droneTg,d,'s');
      if(rnd()<0.3){var tp=proj(droneTg.x,droneTg.z-pz);burst(tp.x,tp.y-roadHalf*0.12*tp.s,1,['#a8e6ff','#ffe27a'],50*tp.s+15,3*tp.s+1,0.2,0);}
    }else if(boss>0&&bossZ-pz<110){boss=Math.max(0,boss-d);droneTg={x:0,z:bossZ};}
  }
  if(artyT>0){artyT-=dt;if(artyT<=0){artyShells=6;artyNext=0;}}
  if(artyShells>0){
    artyNext-=dt;
    if(artyNext<=0){
      artyNext=0.2;artyShells--;
      var D=(1.0*count+8)*m/6;
      for(i=0;i<items.length;i++){fo=items[i];if(isTarget(fo)&&Math.abs(fo.z-artyZ)<45)hurt(fo,D,'s');}
      if(boss>0&&Math.abs(bossZ-artyZ)<45)boss=Math.max(0,boss-D);
      var sp=proj((rnd()-0.5)*1.6,Math.max(4,artyZ-pz+(rnd()-0.5)*50));
      boomFx(sp.x,sp.y,sp.s);shake=Math.max(shake,0.6);boomSnd(0.1);buzz(20);
    }
  }
  if(airT>0){
    airT-=dt;
    if(airT<=0){
      airAnim=0.001;var A=(1.6*count+12)*m;
      for(i=0;i<items.length;i++){
        fo=items[i];
        if(isTarget(fo)&&fo.z-pz>0&&fo.z-pz<170){var ap=proj(fo.x,fo.z-pz);boomFx(ap.x,ap.y,ap.s);hurt(fo,A,'s');}
      }
      if(boss>0&&bossZ-pz<170){boss=Math.max(0,boss-A);var bp=proj(0,bossZ-pz);boomFx(bp.x,bp.y,bp.s);}
      for(i=0;i<5;i++){var lp=proj((rnd()-0.5)*1.2,15+i*28);boomFx(lp.x,lp.y,lp.s);}
      shake=1;boomSnd(0.16);buzz(60);
    }
  }
  if(airAnim>0){airAnim+=dt/0.9;if(airAnim>=1)airAnim=0;}
}

/* ---------- damage ---------- */
function equip(w){
  weapon=w;fireT=0;
  var isNew=save.found.indexOf(w)<0;
  if(isNew){save.found.push(w);persist();}
  popup((isNew?'New: ':'')+WEAPONS[w].name,'#ffd23f',W/2,H*0.5);
  if(!sfx('equip',0.8)){beep(700,0.07,'triangle',0.07);beep(1050,0.1,'triangle',0.07,actx?actx.currentTime+0.07:0);}
}
function hurt(fo,d,src){
  if(fo.done)return;
  var fp;
  if(fo.type==='barrel'){
    fo.n-=d;fo.hitT=1;
    if(fo.n<=0){
      fo.done=true;fp=proj(fo.x,fo.z-pz);
      burst(fp.x,fp.y-roadHalf*0.15*fp.s,16,['#ffd23f','#ffffff','#8a8f99'],110*fp.s+40,5*fp.s+2,0.5,150);
      var pr=fo.prize;
      if(pr.k==='troops'){setCount(count+pr.v);popup('+'+pr.v,'#9fd4ff',fp.x,fp.y-roadHalf*0.4*fp.s);if(!sfx('pickup',0.7))beep(620,0.09,'square',0.05);}
      else if(pr.k==='weapon')equip(pr.w);
      else{sup[pr.s].left++;refreshSup();popup(BR().tag[pr.s]+' +1','#ffd23f',fp.x,fp.y-roadHalf*0.4*fp.s);if(!sfx('pickup',0.7,1.2))beep(880,0.1,'triangle',0.06);}
    }
    return;
  }
  if(fo.kind==='shield'&&src==='b')d*=0.55;
  fo.n-=d;
  if(fo.n<=0){
    fo.done=true;fo.hit=true;fp=proj(fo.x,fo.z-pz);
    popup(fo.big?'Giant down!':'Cleared','#ffe27a',fp.x,fp.y-roadHalf*0.3*fp.s,!fo.big);
    burst(fp.x,fp.y-roadHalf*0.1*fp.s,16,['#d63a48','#ffb3ba','#e2cda2'],90*fp.s+30,5*fp.s+2,0.5,120);
    if(fo.big){boomFx(fp.x,fp.y-roadHalf*0.3*fp.s,fp.s);shake=0.8;freeze=0.12;boomSnd(0.14);buzz(40);}
    else if(!sfx('hit',0.4,0.9+rnd()*0.3))beep(900,0.06,'square',0.04);
  }
}
function lose(why){lostTo=why;setCount(0);finish(false);}

/* ---------- hints ---------- */
function checkHints(){
  if(!save.hints.drag){if(hintT<=0){hintMsg='Drag left or right to steer your squad';hintDur=hintT=2;}return;}
  for(var i=0;i<items.length;i++){
    var it=items[i],zr=it.z-pz;
    if(it.done||zr<0||zr>240)continue;
    if(it.type==='gate'&&zr<95){
      if(it.l.t==='c'||it.r.t==='c')hint('charge','Gold-top gate: line up and shoot it to raise its number.');
      else hint('gate','Blue gates add troops. Red gates take them away.');
    }else if(it.type==='foe'){
      if(it.big)hint('giant','Giant incoming! Tap a support button to help bring it down.',5.5);
      else if(zr<120){
        if(it.kind==='fast')hint('fast','Orange runners are fast. Face them early.');
        else if(it.kind==='shield')hint('shield','Shield squads soak up bullets. The .50 cal, grenades and support ignore shields.',5.5);
        else hint('foe','Red squads always reach you. Line up and shoot them down first.',5);
      }
    }else if(it.type==='crate'&&zr<80)hint('crate','Run over an ammo crate to take its weapon.');
    else if(it.type==='barrel'&&zr<95)hint('barrel','Shoot barrels open for what is inside. Do not run into them.',5);
    else if(it.type==='mines'&&zr<95)hint('mines','Minefield! Steer to the clear side.');
  }
  if(level>=2&&pz>20)hint('arty',BR().sup.arty+' unlocked. Tap it when enemies are a little way ahead.',5);
  if(level>=3&&pz>30)hint('air',BR().sup.air+' unlocked. It hits everything on the road ahead.',5);
}

/* ---------- update ---------- */
function update(dt){
  var i;
  if(freeze>0){freeze-=dt;dt*=0.12;}
  time+=dt;if(shake>0)shake=Math.max(0,shake-dt*3);if(flash>0)flash=Math.max(0,flash-dt*3);if(pop>0)pop=Math.max(0,pop-dt*4);
  if(hintT>0)hintT-=dt;
  for(i=popups.length-1;i>=0;i--){popups[i].t+=dt;if(popups[i].t>0.9)popups.splice(i,1);}
  for(i=parts.length-1;i>=0;i--){var q=parts[i];q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=q.g*dt;q.life-=dt;if(q.life<=0)parts.splice(i,1);}
  if(state==='run'||state==='battle')drums();
  if(state==='run'){
    checkHints();
    for(i=0;i<items.length;i++){
      var e=items[i];
      if(e.hitT>0)e.hitT-=dt*5;
      if(e.type==='gate'){if(e.l.hitT>0)e.l.hitT-=dt*6;if(e.r.hitT>0)e.r.hitT-=dt*6;}
      if(e.type!=='foe'||e.done)continue;
      var ez=e.z-pz,fast=e.kind==='fast';
      if(ez<(e.big?260:fast?170:140)){
        if(e.big){
          if(!e.active){popup('Giant ahead!','#ff9aa4',W/2,H*0.36);if(!sfx('boom_low',0.6,0.7))beep(70,0.5,'sawtooth',0.08);}
          e.step=(e.step||0)-dt;
          if(e.step<=0&&ez<150){e.step=0.62;shake=Math.max(shake,0.16);beep(58,0.14,'sine',0.1,0,38);}
        }
        e.active=true;e.z-=(e.big?3:fast?18:e.kind==='shield'?5:8)*dt;
        if(ez<70){var dx=px-e.x,st=(ez<45?1.4:homing)*dt;e.x+=Math.max(-st,Math.min(st,dx));}
      }
    }
  }
  for(var b=bullets.length-1;b>=0;b--){
    var bu=bullets[b],gone=false,hp=null,f;
    bu.z+=bu.spd*dt;bu.x+=bu.vx*dt;
    if(bu.z>pz+bu.range||Math.abs(bu.x)>1.05)gone=true;
    if(bu.rocket&&!gone&&rnd()<0.6){var sp=proj(bu.x,bu.z-pz-2);part(sp.x,sp.y-roadHalf*0.09*sp.s,(rnd()-0.5)*10,-8,0.35,roadHalf*0.03*sp.s,'rgba(235,235,235,.8)');}
    for(f=0;f<items.length&&!gone;f++){
      var fo=items[f];
      if(fo.done)continue;
      if(fo.type==='gate'){
        if(bu.z>=fo.z-1&&bu.z<=fo.z+7){
          var gop=bu.x<0?fo.l:fo.r;
          if(gop.t==='c'){gop.v=Math.min(gop.cap,gop.v+bu.dmg);gop.hitT=1;gone=true;var gp=proj(bu.x,fo.z-pz);burst(gp.x,gp.y-roadHalf*0.3*gp.s,2,['#ffd23f','#ffffff'],50*gp.s+15,3*gp.s+1,0.22,0);}
        }
      }else if(fo.type==='foe'||fo.type==='barrel'){
        var br=fo.type==='barrel',rad=br?0.15:fo.big?0.24:radius(Math.ceil(fo.n));
        if(fo!==bu.skip&&bu.z>=fo.z-(br?3:4)&&bu.z<=fo.z+(br?5:8)&&Math.abs(bu.x-fo.x)<rad+0.07){
          hp=proj(bu.x,fo.z-pz-3);hurt(fo,bu.dmg,bu.ap?'s':'b');
          if(bu.rocket)for(var g2=0;g2<items.length;g2++){var o2=items[g2];if(o2!==fo&&isTarget(o2)&&Math.abs(o2.z-fo.z)<15)hurt(o2,bu.dmg*0.5,'s');}
          if(bu.pierce>0&&!bu.rocket){bu.pierce--;bu.dmg*=0.6;bu.skip=fo;}else gone=true;
        }
      }
    }
    if(!gone&&boss>0&&bu.z>=bossZ-5&&Math.abs(bu.x)<radius(Math.ceil(boss))+0.07){boss=Math.max(0,boss-bu.dmg);gone=true;hp=proj(bu.x,bossZ-pz-5);}
    if(hp){
      var hy=hp.y-roadHalf*0.1*hp.s;
      if(window.R3&&R3.ok)R3.impact(hp.x,hp.y,bu.rocket);
      if(bu.rocket){part(hp.x,hy,0,0,0.35,roadHalf*0.08*hp.s+3,'#ffb347',0,true);burst(hp.x,hy,10,['#ff9c3a','#ffe27a','#888'],110*hp.s+30,6*hp.s+2,0.45,60);boomSnd(0.05);}
      else burst(hp.x,hy,3,['#ffe27a','#ff8b96'],60*hp.s+20,3*hp.s+1.5,0.25,0);
    }
    if(gone)bullets.splice(b,1);
  }
  if(state==='run'){
    supportTick(dt);
    if(!lastStand&&bossZ-pz<115){lastStand=true;popup(bossMission?'Warlord ahead!':'Last stand!','#ffd23f',W/2,H*0.36);if(!sfx('stand',0.85)){beep(196,0.3,'triangle',0.07);beep(262,0.4,'triangle',0.07,actx?actx.currentTime+0.25:0);}}
    if(!reduceMotion&&rnd()<0.45){var dp=proj(px+(rnd()-0.5)*2*radius(count),-3-rnd()*5);part(dp.x,dp.y,(rnd()-0.5)*14,-6-rnd()*10,0.35+rnd()*0.25,3+rnd()*4,'rgba(214,196,160,.3)');}
    pz+=SPEED*dt;
    if(keyDir)px+=keyDir*1.8*dt;
    px=Math.max(-0.92,Math.min(0.92,px));
    var p=proj(px,0),py=(window.R3&&R3.ok)?R3.above(2.9):p.y-roadHalf*1.15,loss;
    for(var j=0;j<items.length;j++){
      var it=items[j];if(it.done)continue;
      if(it.type==='gate'){
        if(pz>=it.z){
          var side=px<0?'l':'r',op=it[side],before=count,good=isGood(op);
          setCount(apply(op,count));it.done=true;it.used=side;
          var dl=count-before;
          popup((dl>=0?'+':'−')+Math.abs(dl),dl>=0?'#9fd4ff':'#ff9aa4',p.x,py);
          burst(p.x,p.y-roadHalf*0.25,18,good?['#9fd4ff','#ffffff','#2d6cdf']:['#ff9aa4','#d63a48','#ffffff'],170,4,0.5,200);
          if(dl>=0&&sfx('gate_up',0.65,1+Math.min(0.25,count/800))){}
          else if(dl<0&&sfx('gate_down',0.65)){flash=0.6;buzz(30);}
          else if(dl>=0){beep(520+Math.min(400,count),0.09,'square',0.05);beep(780+Math.min(400,count),0.09,'square',0.04,actx?actx.currentTime+0.06:0);}
          else{beep(200,0.15,'sawtooth',0.05);flash=0.6;buzz(30);}
        }
      }else if(it.type==='crate'){
        if(pz>=it.z){
          it.done=true;
          if(Math.abs(px-it.x)<radius(count)+0.22){equip(it.w);burst(p.x,p.y-roadHalf*0.25,16,['#ffd23f','#ffffff','#7c8c4b'],170,4,0.5,200);}
        }
      }else if(it.type==='barrel'){
        if(pz>=it.z-2){
          if(Math.abs(px-it.x)<radius(count)+0.14){
            loss=Math.max(1,Math.round(count*0.1));it.done=true;shake=0.7;flash=0.7;buzz(40);
            popup('−'+Math.min(loss,count),'#ff9aa4',p.x,py);if(!sfx('hit',0.7,0.8))noise(0.2,0.1,'lowpass',600,0.8);sfx('oof',0.5);
            burst(p.x,p.y-roadHalf*0.2,14,['#8a8f99','#e2cda2','#7f9150'],180,5,0.5,200);
            if(count-loss<=0){lose('barrel');return;}
            setCount(count-loss);
          }else if(pz>it.z+3)it.done=true;
        }
      }else if(it.type==='mines'){
        if(pz>=it.z){
          it.done=true;
          if(px*it.side>0){
            loss=Math.max(1,Math.round(count*0.25));shake=1;flash=1;freeze=0.08;buzz(80);boomSnd(0.14);sfx('oof',0.6,0.95);
            popup('−'+Math.min(loss,count),'#ff9aa4',p.x,py);boomFx(p.x,p.y-roadHalf*0.1,1);
            if(count-loss<=0){lose('mines');return;}
            setCount(count-loss);
          }
        }
      }else if(pz>=it.z-5){
        var fn=Math.ceil(it.n),lost=Math.min(count,fn);
        it.done=true;it.hit=true;shake=1;flash=1;freeze=0.07;buzz(60);
        popup('−'+lost,'#ff9aa4',p.x,py);if(!(sfx('oof',0.75,0.9+rnd()*0.2)&&sfx('hit',0.6,0.75))){beep(120,0.2,'sawtooth',0.07);noise(0.18,0.08,'lowpass',500,0.8);}
        burst(p.x,p.y-roadHalf*0.2,22,['#d63a48','#e2cda2','#7f9150'],200,5,0.55,200);
        if(count-fn<=0){lose(it.big?'giant':'squad');return;}
        setCount(count-fn);
      }
    }
    var wp=WEAPONS[weapon],shots=Math.min(wp.cap,Math.max(wp.rate,wp.per*count));
    fireT+=dt*shots;
    while(fireT>=1){
      fireT-=1;
      var dmg=wp.dps*dmgMul()*count/(shots*wp.n);
      var o=OFFS[Math.floor(rnd()*Math.min(count,MAXU))],bx=px+o.x,mp=proj(bx,o.z),mu=roadHalf*0.055*mp.s;
      for(var s=0;s<wp.n;s++){
        bullets.push({x:bx,z:pz+o.z+2,vx:(s-(wp.n-1)/2)*(wp.spread||0)+(rnd()-0.5)*2*wp.jit,dmg:dmg,pierce:wp.pierce||0,r:wp.r,col:wp.col,
          rocket:!!wp.rocket,ap:!!wp.ap,spd:wp.spd*(0.92+rnd()*0.16),range:wp.range,tail:wp.tail});
      }
      part(mp.x+mu*1.0,mp.y-mu*2.9,0,-15,0.07,roadHalf*wp.flash*mp.s,'#fff3b0');
      if(wp.smoke)part(mp.x+mu*1.0,mp.y-mu*2.9,(rnd()-0.5)*20,-25,0.3,roadHalf*0.05*mp.s,'rgba(230,230,230,.7)');
      shotSnd(wp);
    }
    if(pz>=bossZ-12){state='battle';frac=0;droneT=0;}
  }else if(state==='battle'){
    px+=(0-px)*Math.min(1,dt*6);
    frac+=Math.max(14,(count+boss)*0.7)*dt;
    var k=Math.floor(frac);frac-=k;k=Math.min(k,count,Math.ceil(boss));
    if(k>0){
      boss-=k;shake=Math.max(shake,0.35);
      var cp=proj((rnd()-0.5)*1.2,6);
      burst(cp.x,cp.y-roadHalf*0.15,4,['#e2cda2','#d63a48','#ffe27a','#7f9150'],150,5,0.4,150);
      if(Math.floor(time*20)%2===0&&!(rnd()<0.5&&sfx(rnd()<0.6?'rifle':'hit',0.22,0.9+rnd()*0.3)))noise(0.05,0.04,'bandpass',900+rnd()*600,1);
      if(count-k<=0&&boss>0){lose('boss');return;}
      setCount(count-k);
    }
    if(count<=0){lose('boss');}
    else if(boss<=0){boss=0;finish(true);}
  }
}

/* ---------- results ---------- */
function starStr(n){return n?'★★★'.slice(0,n)+'☆☆☆'.slice(0,3-n):'';}
var result={};
function finish(win){
  state=win?'win':'lose';keepWeapon=win;$('sup').hidden=true;
  if(win){
    var stars=count>=bossStart*0.5?3:count>=bossStart*0.2?2:1;
    var medals=(10*stars+Math.min(20,Math.floor(count/4)))*(bossMission?2:1);
    result={level:level,stars:stars,medals:medals,count:count,force:bossStart,need:Math.ceil(bossStart*0.5)};
    save.stars[level]=Math.max(save.stars[level]||0,stars);save.medals+=medals;
    level++;save.level=level;save.best=Math.max(save.best,level);persist();
    freeze=0.5;
    if(!reduceMotion)for(var i=0;i<90;i++)part(rnd()*W,-rnd()*H*0.3,(rnd()-0.5)*60,120+rnd()*160,2.2,3+rnd()*3,['#c8102e','#ffffff','#2d6cdf'][i%3],60);
    if(!sfx('win',0.95)){beep(523,0.12,'triangle',0.08);beep(659,0.12,'triangle',0.08,actx?actx.currentTime+0.12:0);beep(784,0.25,'triangle',0.08,actx?actx.currentTime+0.24:0);}
    buzz(100);
  }else{
    result={level:level,medals:2};save.medals+=2;persist();
    if(!sfx('lose',0.95))beep(150,0.35,'sawtooth',0.07);buzz(120);
  }
  setTimeout(function(){showCard(win?'win':'lose');},win?1000:700);
}
var LOSE={squad:'A red squad overran you. Line up and shoot squads down before they reach you.',
  giant:'The giant got through. Start shooting it early and call in support.',
  boss:function(){return 'The last stand held. Arrive with more troops, and save your '+BR().sup.air.toLowerCase()+' for it.';},
  barrel:'You ran into a barrel. Shoot it open or steer around it.',
  mines:'You marched through a minefield. Steer to the clear side.'};
function showCard(mode){
  cardMode=mode;
  var t=$('title'),sub=$('sub'),msg=$('msg'),st=$('stars'),go=$('go'),step=$('step'),quit=$('quit');
  sub.hidden=mode!=='menu'&&mode!=='branch';st.hidden=mode!=='win';step.hidden=mode!=='menu';quit.hidden=mode!=='pause';
  $('fine').hidden=mode!=='menu';$('brbtn').hidden=mode!=='menu';$('branches').hidden=mode!=='branch';
  go.hidden=mode==='branch';$('basebtn').hidden=mode==='branch';
  if(mode==='branch'){
    t.textContent='Choose your branch';msg.textContent='Same mission, your service. Change it any time from the menu.';buildBranches();
    $('overlay').hidden=false;var fb=$('branches').firstElementChild;if(fb&&fb.focus)fb.focus();return;
  }
  if(mode==='menu'){
    t.textContent='Gate Rush';msg.textContent='Drag to steer. Your '+BR().many+' fire on their own.';go.textContent='Play';updateStep();
    $('brbtn').textContent='Branch: '+BR().name;
  }else if(mode==='win'){
    t.textContent='Mission '+result.level+' accomplished';st.textContent=starStr(result.stars);
    var m=result.count+' '+(result.count===1?BR().one:BR().many)+' beat a force of '+result.force+'. +'+result.medals+' medals.';
    if(result.stars<3)m+=' Three stars needs '+result.need+' survivors.';
    if(level===2)m+=' '+BR().sup.arty+' unlocked.';if(level===3)m+=' '+BR().sup.air+' unlocked.';
    if(level%5===0)m+=' Next up: a boss mission, double medals.';
    msg.textContent=m;go.textContent='Next mission';
  }else if(mode==='lose'){
    var lm=LOSE[lostTo]||LOSE.squad;t.textContent='Mission failed';msg.textContent=(typeof lm==='function'?lm():lm)+' +2 medals.';go.textContent='Try again';
  }else{
    t.textContent='Paused';msg.textContent='Mission '+level+'. Your squad is holding position.';go.textContent='Resume';
  }
  updateHud();
  $('overlay').hidden=false;go.focus();
}
function updateStep(){
  $('mlabel').textContent='Mission '+level+(save.stars[level]?'  '+starStr(save.stars[level]):'');
  $('prev').disabled=level<=1;$('next').disabled=level>=save.best;
}
function stepMission(d){
  level=Math.max(1,Math.min(save.best,level+d));save.level=level;persist();keepWeapon=false;startLevel();updateStep();
}
function begin(){
  initAudio();try{if(actx&&actx.state==='suspended')actx.resume();}catch(e){}
  startLevel();drag=null;
  $('overlay').hidden=true;$('sup').hidden=false;
  state='run';if(!sfx('click',0.8))beep(440,0.08,'triangle',0.06);startMusic();
}
function pauseGame(){
  if(state!=='run'&&state!=='battle')return;
  prevState=state;state='pause';$('sup').hidden=true;showCard('pause');
}

/* ---------- armory ---------- */
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function buildBase(){
  var h='',k;
  for(k in UPG){
    var u=UPG[k],l=save.up[k],max=l>=u.max,cost=u.cost(l);
    h+='<div class="row"><div class="rt"><b>'+esc(u.name)+'</b><span>Level '+l+' of '+u.max+'</span></div><p>'+esc(u.desc())+'</p>'+
      '<button type="button" data-up="'+k+'"'+(max||save.medals<cost?' disabled':'')+'>'+(max?'Maxed':'Upgrade for '+cost+' medals')+'</button></div>';
  }
  $('upg').innerHTML=h;
  h='';
  for(var i=0;i<WORDER.length;i++){
    var w=WEAPONS[WORDER[i]],have=save.found.indexOf(WORDER[i])>=0;
    h+='<div class="row'+(have?'':' locked')+'"><div class="rt"><b>'+(have?esc(w.name):'Not found yet')+'</b><span>'+(have?esc(w.cal):'From mission '+Math.max(1,w.unlock))+'</span></div>'+
      (have?'<p>'+esc(w.note)+'</p>':'')+'</div>';
  }
  $('wlist').innerHTML=h;
  $('bmedals').textContent=save.medals+' medals';
}
$('base').addEventListener('click',function(e){
  var k=e.target&&e.target.getAttribute&&e.target.getAttribute('data-up');
  if(!k||!UPG[k])return;
  var l=save.up[k],cost=UPG[k].cost(l);
  if(l>=UPG[k].max||save.medals<cost)return;
  save.medals-=cost;save.up[k]=l+1;persist();buildBase();updateHud();
  initAudio();if(!sfx('upgrade',0.8)){beep(660,0.08,'triangle',0.06);beep(990,0.12,'triangle',0.06,actx?actx.currentTime+0.08:0);}
  if(cardMode==='menu')startLevel();
});
$('basebtn').addEventListener('click',function(){buildBase();$('base').hidden=false;$('baseclose').focus();});
$('baseclose').addEventListener('click',function(){$('base').hidden=true;$('go').focus();});

/* ---------- branch ---------- */
function applyBranch(){
  var b=BR(),de=document.documentElement;
  PAL_US=b.pal;bgKey='';
  if(de&&de.style)de.style.setProperty('--accent',b.accent);
  refreshSup();
}
function buildBranches(){
  var h='';
  for(var i=0;i<BORDER.length;i++){
    var k=BORDER[i],b=BRANCHES[k];
    h+='<button type="button" class="br" data-br="'+k+'" aria-pressed="'+(save.branch===k)+'" style="--sw:'+b.pal.body+';--hl:'+b.pal.helmet+';--ac:'+b.accent+'">'+
      '<i aria-hidden="true"></i><b>'+esc(b.name)+'</b><small>'+esc(b.motto)+'</small></button>';
  }
  $('branches').innerHTML=h;
}
$('branches').addEventListener('click',function(e){
  var el=e.target&&e.target.closest&&e.target.closest('[data-br]');
  if(!el)return;
  save.branch=el.getAttribute('data-br');persist();applyBranch();
  initAudio();if(!sfx('click',0.8))beep(660,0.08,'triangle',0.06);
  startLevel();showCard('menu');
});
$('brbtn').addEventListener('click',function(){showCard('branch');});

/* ---------- input ---------- */
var drag=null,keyDir=0;
cv.addEventListener('pointerdown',function(e){drag={x:e.clientX,px:px};try{cv.setPointerCapture(e.pointerId);}catch(err){}});
cv.addEventListener('pointermove',function(e){
  if(!drag||state!=='run')return;
  px=Math.max(-0.92,Math.min(0.92,drag.px+(e.clientX-drag.x)/roadHalf*1.25));
  if(!save.hints.drag&&Math.abs(px-drag.px)>0.12){save.hints.drag=1;persist();hintT=Math.min(hintT,0.3);}
});
function endDrag(){drag=null;}
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
function keyOf(e){return e.key&&e.key.length===1?e.key.toLowerCase():e.key;}
window.addEventListener('keydown',function(e){
  var key=keyOf(e);
  if(key==='ArrowLeft'||key==='a'){keyDir=-1;if(!save.hints.drag){save.hints.drag=1;persist();}}
  else if(key==='ArrowRight'||key==='d'){keyDir=1;if(!save.hints.drag){save.hints.drag=1;persist();}}
  else if(e.key==='1')useSupport('drone');else if(e.key==='2')useSupport('arty');else if(e.key==='3')useSupport('air');
  else if(e.key==='Escape'||key==='p')pauseGame();
});
window.addEventListener('keyup',function(e){
  var key=keyOf(e);
  if(key==='ArrowLeft'||key==='a'||key==='ArrowRight'||key==='d')keyDir=0;
});
$('go').addEventListener('click',function(){
  if(cardMode==='pause'){$('overlay').hidden=true;$('sup').hidden=false;state=prevState;drag=null;return;}
  begin();
});
$('quit').addEventListener('click',function(){keepWeapon=false;state='menu';startLevel();showCard('menu');});
$('prev').addEventListener('click',function(){stepMission(-1);});
$('next').addEventListener('click',function(){stepMission(1);});
$('pause').addEventListener('click',pauseGame);
document.addEventListener('visibilitychange',function(){if(document.hidden)pauseGame();});
SUPDEF.forEach(function(d){
  var b=$('s-'+d[0]);
  /* pointerdown, not click: a second thumb must be able to call support while the first is steering */
  b.addEventListener('pointerdown',function(e){e.preventDefault();useSupport(d[0]);});
  b.addEventListener('click',function(e){if(e.detail===0)useSupport(d[0]);});
});
function showMute(){$('mute').textContent=save.sound?'Sound on':'Sound off';}
$('mute').addEventListener('click',function(){save.sound=save.sound?0:1;persist();showMute();initAudio();applySound();});
showMute();

/* ---------- loop ---------- */
var last=0,slowT=0,qStep=0;
function frame(t){
  var raw=(t-last)/1000||0,dt=Math.min(0.033,raw);last=t;
  /* adaptive quality: if frames stay slow for 1.5 s, drop resolution first, then crowd detail */
  if(state==='run'&&raw<0.2){
    slowT=raw>0.024?slowT+raw:Math.max(0,slowT-raw*2);
    if(slowT>1.5&&qStep<3){qStep++;slowT=0;if(qStep===1)qDPR=1.5;else if(qStep===2)qDPR=1;else DRAWMAX=70;if(window.R3&&R3.ok)R3.quality(qStep);resize();}
  }
  if(state!=='pause')update(dt);
  if(actx)musicTick(state);
  draw();
  requestAnimationFrame(frame);
}
if(window.__GR_TEST)window.__GR={use:useSupport,sup:sup,TUNE:TUNE,WEAPONS:WEAPONS,radius:radius,apply:apply,save:save,
  start:function(l,w){level=l;keepWeapon=false;startLevel();if(w)weapon=w;state='run';},step:update,setX:function(x){px=x;},
  get:function(){return{state:state,pz:pz,px:px,count:count,items:items,bossZ:bossZ,boss:boss,bossStart:bossStart,weapon:weapon,lostTo:lostTo};}};
resize();applyBranch();startLevel();showCard(save.branch?'menu':'branch');
requestAnimationFrame(frame);
