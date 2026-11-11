"use strict";
/* Gate Rush core: config, save data, audio, level generation */
var cv=document.getElementById('c'),ctx=cv.getContext('2d');
var W=0,H=0,DPR=1,horizon=0,baseY=0,roadHalf=0;
var qDPR=2,DRAWMAX=140;
var K=0.035,SPEED=24,MAXU=140,CAP=9999,TAU=6.2832;
var FONT='"Lilita One","Arial Rounded MT Bold",sans-serif';
var reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function $(id){return document.getElementById(id);}
function resize(){
  DPR=Math.min(qDPR,window.devicePixelRatio||1);
  W=cv.clientWidth;H=cv.clientHeight;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  horizon=H*0.27;baseY=H*0.8;roadHalf=Math.min(W*0.44,H*0.32);
  if(window.R3&&R3.ok)R3.resize();
}
window.addEventListener('resize',resize);

/* ---------- save data (one viewer, one browser) ---------- */
var save={level:1,best:1,stars:{},medals:0,up:{rec:0,mark:0,log:0},found:['m16'],hints:{},sound:1,branch:''};
(function(){
  try{
    var raw=localStorage.getItem('gr_save2');
    if(raw){var o=JSON.parse(raw);for(var k in o)if(k in save&&o[k]!==null)save[k]=o[k];}
    else{var b=parseInt(localStorage.getItem('gr_best')||'1',10)||1;save.best=b;save.level=b;}
  }catch(e){}
  if(typeof save.up!=='object')save.up={};
  ['rec','mark','log'].forEach(function(k){save.up[k]=save.up[k]|0;});
  if(!Array.isArray(save.found))save.found=['m16'];
  if(typeof save.stars!=='object')save.stars={};
  if(typeof save.hints!=='object')save.hints={};
  if(typeof save.branch!=='string')save.branch='';
  save.level=Math.max(1,save.level|0);save.best=Math.max(save.level,save.best|0);save.medals=Math.max(0,save.medals|0);
})();
function persist(){try{localStorage.setItem('gr_save2',JSON.stringify(save));}catch(e){}}
var level=save.level;

var UPG={
  rec:{name:'Recruits',desc:function(){return '+1 '+BR().one+' at the start of every mission';},max:10,cost:function(l){return 20+l*15;}},
  mark:{name:'Marksmanship',desc:function(){return '+6% weapon damage';},max:10,cost:function(l){return 25+l*20;}},
  log:{name:'Logistics',desc:function(){var s=BR().sup;return '+12% '+s.drone.toLowerCase()+', '+s.arty.toLowerCase()+' and '+s.air.toLowerCase()+' damage';},max:8,cost:function(l){return 30+l*25;}}
};
function startCount(){return 5+save.up.rec;}
function dmgMul(){return 1+0.06*save.up.mark;}
function supMul(){return 1+0.12*save.up.log;}

/* ---------- audio ---------- */
var actx=null,noiseBuf=null,lastShot=0,drumStep=0,drumNext=0;
function initAudio(){
  if(actx)return;
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    var n=actx.sampleRate,b=actx.createBuffer(1,n,n),d=b.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=Math.random()*2-1;
    noiseBuf=b;
    /* everything goes through a gentle compressor so stacked gunfire and explosions do not clip */
    var comp=actx.createDynamicsCompressor();
    comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=0.004;comp.release.value=0.2;
    SFX.master=actx.createGain();SFX.master.gain.value=save.sound?1:0;SFX.master.connect(comp);comp.connect(actx.destination);
    SFX.mgain=actx.createGain();SFX.mgain.gain.value=0;SFX.mgain.connect(SFX.master);
    loadSfx();
  }catch(e){actx=null;}
}
/* ---------- recorded sounds (CC0; sources in sfx/CREDITS.md). Synth sounds above remain the fallback. ---------- */
var SFX={buf:{},master:null,mgain:null,music:null,mt:-1,last:{},drone:null};
var SFX_LIST=['rifle','mg','shotgun','fifty','grenade','minigun','hit','oof','drone','boom_big','boom','boom_far','boom_low',
  'jet','helo','click','gate_up','gate_down','pickup','equip','upgrade','win','lose','stand','music'];
function loadSfx(){
  SFX_LIST.forEach(function(n){
    try{
      fetch('sfx/'+n+'.mp3').then(function(r){return r.ok?r.arrayBuffer():null;}).then(function(a){
        if(!a)return;
        actx.decodeAudioData(a,function(b){SFX.buf[n]=b;if(n==='music')startMusic();},function(){});
      }).catch(function(){});
    }catch(e){}
  });
}
function out(){return SFX.master||actx.destination;}
function sfx(n,vol,rate,at){
  var b=SFX.buf[n];if(!b||!actx)return false;if(!save.sound)return true;
  try{
    var s=actx.createBufferSource(),g=actx.createGain();
    s.buffer=b;s.playbackRate.value=rate||1;g.gain.value=vol==null?1:vol;
    s.connect(g);g.connect(SFX.master);s.start(at||actx.currentTime);return s;
  }catch(e){return false;}
}
function startMusic(){
  if(SFX.music||!SFX.buf.music)return;
  /* the loop is 44.304 s of music (24 bars). Some browsers keep the MP3 encoder padding at the front, some strip it:
     whatever is left over at the start is padding, so skip it and loop only the music */
  var s=actx.createBufferSource(),pad=Math.max(0,Math.min(0.06,SFX.buf.music.duration-44.304));s.buffer=SFX.buf.music;s.loop=true;
  s.loopStart=pad;s.loopEnd=Math.min(s.buffer.duration,pad+44.304);
  s.connect(SFX.mgain);s.start(actx.currentTime,pad);SFX.music=s;SFX.mt=-1;
}
function musicTick(st){
  if(!SFX.mgain)return;
  var t=st==='run'||st==='battle'?0.32:st==='pause'?0.07:0.16;
  if(t!==SFX.mt){SFX.mt=t;try{SFX.mgain.gain.setTargetAtTime(t,actx.currentTime,0.5);}catch(e){}}
}
function applySound(){if(SFX.master)try{SFX.master.gain.setTargetAtTime(save.sound?1:0,actx.currentTime,0.05);}catch(e){}}
function droneLoop(sec){
  var b=SFX.buf.drone;if(!b||!actx||!save.sound)return;
  try{var s=actx.createBufferSource(),g=actx.createGain(),t=actx.currentTime;s.buffer=b;s.loop=true;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.32,t+0.4);g.gain.setValueAtTime(0.32,t+sec-0.6);g.gain.linearRampToValueAtTime(0,t+sec);
    s.connect(g);g.connect(SFX.master);s.start(t);s.stop(t+sec+0.05);}catch(e){}
}
function beep(f,d,type,vol,at,f2){
  if(!save.sound||!actx)return;
  try{
    var o=actx.createOscillator(),g=actx.createGain(),t=at||actx.currentTime;
    o.type=type||'square';o.frequency.setValueAtTime(f,t);
    if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
    g.gain.setValueAtTime(vol||0.06,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(out());o.start(t);o.stop(t+d+0.02);
  }catch(e){}
}
function noise(dur,vol,type,freq,q,at){
  if(!save.sound||!actx||!noiseBuf)return;
  try{
    var s=actx.createBufferSource(),fl=actx.createBiquadFilter(),g=actx.createGain(),t=at||actx.currentTime;
    s.buffer=noiseBuf;fl.type=type;fl.frequency.value=freq;fl.Q.value=q||1;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(fl);fl.connect(g);g.connect(out());s.start(t,Math.random()*0.5,dur+0.03);
  }catch(e){}
}
var GUNSND={m16:['rifle',1,0.3,0.1],m4:['rifle',1.07,0.28,0.085],m249:['mg',1,0.32,0.065],m1014:['shotgun',1,0.42,0.2],
  m240:['mg',0.86,0.36,0.075],m320:['grenade',1,0.5,0.25],m2:['fifty',1,0.45,0.12],m134:['minigun',1,0.3,0.05]};
function shotSnd(wp){
  if(!actx)return;
  var t=actx.currentTime,gs=GUNSND[weapon];
  if(gs&&SFX.buf[gs[0]]){if(t-lastShot<gs[3])return;lastShot=t;sfx(gs[0],gs[2]*(0.85+Math.random()*0.3),gs[1]*(0.94+Math.random()*0.12));return;}
  if(t-lastShot<0.075)return;lastShot=t;
  noise(wp.snd[1],wp.snd[2],'bandpass',wp.snd[0]*(0.92+Math.random()*0.16),1.1);
}
function boomSnd(v){
  v=v||0.12;var r=0.92+Math.random()*0.16;
  if(v>=0.14?sfx('boom_big',0.95,r):v>=0.08?sfx(Math.random()<0.5?'boom':'boom_low',0.75,r):sfx('boom',0.35,r*1.15))return;
  noise(0.45,v,'lowpass',420,0.7);beep(90,0.35,'sine',0.1,0,40);
}
function drums(){
  if(!save.sound||!actx||SFX.buf.music)return;
  var t=actx.currentTime;
  if(drumNext<t)drumNext=t+0.05;
  while(drumNext<t+0.2){
    var s=drumStep%8;
    if(s===0||s===4||s===5)beep(115,0.13,'sine',0.085,drumNext,45);
    if(s===2||s===6||s===7)noise(0.09,0.03,'highpass',1600,0.8,drumNext);
    drumNext+=0.24;drumStep++;
  }
}
function buzz(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}

/* ---------- rules ---------- */
function rnd(){return Math.random();}
function apply(op,n){
  var r=n;
  if(op.t==='+')r=n+op.v; else if(op.t==='-')r=Math.max(1,n-op.v);
  else if(op.t==='*')r=n*op.v; else if(op.t==='c')r=Math.max(1,n+Math.floor(op.v));
  else r=Math.max(1,Math.floor(n/op.v));
  return Math.min(CAP,r);
}
function label(op){
  if(op.t==='c'){var v=Math.floor(op.v);return (v>=0?'+':'−')+Math.abs(v);}
  return (op.t==='+'?'+':op.t==='-'?'−':op.t==='*'?'×':'÷')+op.v;
}
function isGood(op){return op.t==='c'?op.v>=0:(op.t==='+'||op.t==='*');}
function nice(v){return v<10?Math.max(1,Math.round(v)):v<100?Math.round(v/5)*5:Math.round(v/10)*10;}

var WEAPONS={
  /* dps = red troops each soldier drops per second; rate = minimum shots/sec drawn; per = extra shots/sec per soldier;
     pierce = extra squads a round passes through; ap = ignores shields; unlock = first mission it can appear; snd = [Hz, seconds, volume] */
  m16:{name:'M16A4',cal:'5.56mm',note:'Slow, accurate single shots.',dps:0.4,rate:2,per:0.18,cap:26,n:1,r:0.018,col:'#ffe27a',spd:115,range:95,tail:6,jit:0,gun:0.2,flash:0.04,unlock:0,snd:[1900,0.05,0.035]},
  m4:{name:'M4A1',cal:'5.56mm',note:'Same round, quicker follow-up shots.',dps:0.5,rate:3,per:0.28,cap:34,n:1,r:0.018,col:'#ffe27a',spd:118,range:95,tail:6,jit:0.03,gun:0.2,flash:0.04,unlock:1,snd:[2000,0.045,0.035]},
  m249:{name:'M249 SAW',tag:'M249 SAW',cal:'5.56mm',note:'Belt-fed: four times the rate of fire, sprays.',dps:0.62,rate:8,per:0.7,cap:55,n:1,r:0.015,col:'#ffc46a',spd:135,range:95,tail:5,jit:0.13,gun:0.26,flash:0.05,unlock:1,snd:[2200,0.035,0.03]},
  m1014:{name:'M1014 Shotgun',tag:'M1014',cal:'12 gauge',note:'Five-pellet fan. Brutal up close, half the range.',dps:0.9,rate:2.5,per:0.16,cap:12,n:5,spread:0.22,r:0.017,col:'#ffe9c0',spd:100,range:50,tail:2,jit:0.05,gun:0.24,flash:0.09,smoke:true,unlock:2,snd:[900,0.11,0.06]},
  m240:{name:'M240B',cal:'7.62mm',note:'Heavier rounds punch through one squad into the next.',dps:0.72,rate:5,per:0.4,cap:40,n:1,r:0.025,col:'#ff8a3a',spd:130,range:95,tail:8,jit:0.07,gun:0.3,flash:0.06,pierce:1,unlock:3,snd:[1300,0.06,0.04]},
  m320:{name:'M320 Launcher',tag:'M320',cal:'40mm',note:'Grenades blast neighbouring squads and ignore shields.',dps:0.6,rate:1,per:0.05,cap:7,n:1,r:0.045,col:'#c8d48a',rocket:true,ap:true,spd:65,range:95,tail:2,jit:0,gun:0.36,flash:0.08,smoke:true,unlock:5,snd:[300,0.16,0.07]},
  m2:{name:'M2 Browning',tag:'M2 .50',cal:'.50 cal',note:'Slow, heavy rounds go through everything, shields included.',dps:0.85,rate:2.5,per:0.14,cap:16,n:1,r:0.036,col:'#ff5a3a',ap:true,spd:150,range:95,tail:11,jit:0.02,gun:0.38,flash:0.1,pierce:9,unlock:7,snd:[650,0.1,0.06]},
  m134:{name:'M134 Minigun',tag:'M134',cal:'7.62mm',note:'A wall of fire. Strongest overall, sprays wide.',dps:1.0,rate:14,per:1.0,cap:70,n:1,r:0.016,col:'#ffb04a',spd:150,range:95,tail:6,jit:0.18,gun:0.34,flash:0.05,pierce:1,unlock:9,snd:[1500,0.03,0.03]}
};
var WORDER=['m16','m4','m249','m1014','m240','m320','m2','m134'];
var WKEYS=WORDER.slice(1);
var SUPDEF=[['drone','Drone',1],['arty','Artillery',2],['air','Air strike',3]];
var TUNE={waveBase:0.33,waveDiff:0.35,waveRnd:0.3,bossBase:1.6,bossDiff:2.2,parLoss:0.2,chargePar:0.6,
  giantBase:1.3,giantDiff:0.9,giantPar:0.1,barrelHp:0.45,barrelPrize:0.35,barrelPar:0.5,bossMission:1.35};

/* ---------- branches ----------
   Choosing a branch changes uniforms, setting, support-call names and wording. Rules and balance are identical for all six,
   so tools/sim.js results hold whichever branch is picked. No official seals or insignia are drawn. */
var BRANCHES={
  army:{name:'Army',motto:"This We'll Defend",one:'Soldier',many:'Soldiers',accent:'#d4a62a',
    pal:{body:'#8b8a5e',dark:'#5c5a3c',helmet:'#7d7b54',gear:'#6b6447',camo:['#6e6a45','#a39a72','#4e4a34'],hcamo:1},
    sup:{drone:'Drone',arty:'Artillery',air:'Air strike'},tag:{drone:'DRONE',arty:'ARTY',air:'AIR'},
    say:{drone:'Drones up',arty:'Fire mission!',air:'Air strike inbound'},air:'jet',
    land:{ground:['#e2cda2','#cfb384','#a98c60'],far:['#8ea3c6',1],near:['#a8977d',1],dirt:'120,96,62',curb:['#c8102e','#f6f3ea'],props:['rock','bush','bags','tent','cactus','acacia','tank','acacia']}},
  marines:{name:'Marine Corps',motto:'Semper Fidelis',one:'Marine',many:'Marines',accent:'#c8102e',
    pal:{body:'#5d6b3f',dark:'#3a4428',helmet:'#5d6b3f',gear:'#8a7650',camo:['#3a4628','#8a7d55','#25261c'],hcamo:1},
    sup:{drone:'Drone',arty:'Mortars',air:'Air support'},tag:{drone:'DRONE',arty:'MORTAR',air:'AIR'},
    say:{drone:'Drones up',arty:'Mortars firing!',air:'Air support inbound'},air:'jet',
    land:{ground:['#f0dcaa','#e4c88c','#c9a96a'],sea:'#3f8fb8',far:['#7fa0b8',0.45],near:null,dirt:'140,110,70',curb:['#c8102e','#ffd23f'],props:['palm','bags','palm','craft','bush','palm']}},
  navy:{name:'Navy',motto:'Non sibi sed patriae',one:'Sailor',many:'Sailors',accent:'#d4af37',
    pal:{body:'#34508a',dark:'#22355e',helmet:'#8b939f',gear:'#2a3550',camo:['#22355e','#4a6aa8','#1a2440']},
    sup:{drone:'Drone',arty:'Naval guns',air:'Jet strike'},tag:{drone:'DRONE',arty:'GUNS',air:'JETS'},
    say:{drone:'Drones up',arty:'Naval gunfire inbound',air:'Jets inbound'},air:'jet',
    land:{ground:['#5d9fd0','#3f7fb4','#2a5f8f'],water:true,far:['#7d93b0',0.35],near:null,dirt:'20,50,80',curb:['#ffd23f','#2b2f36'],props:['buoyR','buoyG','boat','cap','cap']}},
  airforce:{name:'Air Force',motto:'Aim High',one:'Airman',many:'Airmen',accent:'#5b8fd9',
    pal:{body:'#9aa57c',dark:'#5f6748',helmet:'#2f3d5c',gear:'#4b5338',camo:['#7c8560','#b3b48e','#596042']},
    sup:{drone:'Drone',arty:'Gunship',air:'Air strike'},tag:{drone:'DRONE',arty:'GUNSHIP',air:'AIR'},
    say:{drone:'Drones up',arty:'Gunship on station',air:'Air strike inbound'},air:'jet',
    land:{ground:['#9cc46a','#82ab55','#5f8a3e'],far:['#8ea3c6',0.7],near:['#7f9a6a',0.5],dirt:'70,90,40',curb:['#ffd23f','#f6f3ea'],props:['hangar','tower','sock','lights','tree','tree','bush']}},
  spaceforce:{name:'Space Force',motto:'Semper Supra',one:'Guardian',many:'Guardians',accent:'#b8c2d4',
    pal:{body:'#5c6782',dark:'#363d52',helmet:'#c9ced8',gear:'#2c3142',camo:['#454e66','#7a86a2','#2c3142']},
    sup:{drone:'Drone',arty:'GPS strike',air:'Air strike'},tag:{drone:'DRONE',arty:'GPS',air:'AIR'},
    say:{drone:'Drones up',arty:'GPS strike locked',air:'Air strike inbound'},air:'jet',
    land:{ground:['#bdb8ad','#a6a093','#827b6c'],far:['#9a8f9c',0.8],near:['#9c9480',0.6],dirt:'90,86,76',curb:['#b8c2d4','#2b2f36'],props:['dish','rocket','mast','dish','rock']}},
  coastguard:{name:'Coast Guard',motto:'Semper Paratus',one:'Coast Guardsman',many:'Coast Guardsmen',accent:'#e8742c',
    pal:{body:'#4f7ac0',dark:'#2e4f86',helmet:'#eef0f4',gear:'#2a3f66'},
    sup:{drone:'Drone',arty:'Deck gun',air:'Helo strike'},tag:{drone:'DRONE',arty:'GUN',air:'HELO'},
    say:{drone:'Drones up',arty:'Deck gun firing!',air:'Helo inbound'},air:'helo',
    land:{ground:['#6aa6c4','#4b86a8','#326582'],water:true,far:['#9fb3c4',0.6],near:null,dirt:'20,50,80',curb:['#e8742c','#f6f3ea'],props:['light','buoyR','cutter','ice','cap']}}
};
var BORDER=['army','marines','navy','airforce','spaceforce','coastguard'];
if(!BRANCHES[save.branch])save.branch='';
function BR(){return BRANCHES[save.branch]||BRANCHES.army;}

var items=[],bossZ=0,boss=0,bossStart=0,homing=0,bossMission=false,theme=0,weapon='m16';
function genLevel(n){
  items=[];
  var segs=5+Math.min(4,Math.floor((n-1)/2)),z=65,E=startCount(),diff=Math.min(1,(n-1)/10),diffB=Math.min(2.5,(n-1)/10),i;
  homing=0.04+0.16*diff;bossMission=n%5===0;theme=Math.floor((n-1)/3)%3;
  var ease=n===1?0.75:n===2?0.9:1;
  var gi=Math.floor(segs/2),script=n===1?['A','C','A','B','A']:null;
  for(i=0;i<segs;i++){
    var r=rnd(),tpl=script?script[i]:(i===0?'A':r<0.3?'A':(r<0.55&&E>=10)?'B':r<0.85?'C':(n>=4?'D':'A')),a,b,Eb;
    if(tpl==='B'&&E<10)tpl='A';
    if(tpl==='A'){
      a={t:'+',v:nice(E*(0.4+rnd()*0.4))};
      b=rnd()<0.5?{t:'-',v:nice(E*(0.25+rnd()*0.25))}:{t:'/',v:2};
      Eb=E+a.v;
    }else if(tpl==='B'){
      b={t:'*',v:(n>=5&&rnd()<0.2)?3:2};
      a={t:'+',v:nice(E*(b.v-1)*(0.6+rnd()*0.8))};
      Eb=Math.max(E+a.v,E*b.v);
    }else if(tpl==='C'){
      a={t:'c',v:-nice(E*(0.2+rnd()*0.3)),cap:nice(E*(0.9+rnd()*0.5))};
      b={t:'+',v:nice(E*(0.25+rnd()*0.2))};
      Eb=E+Math.max(b.v,Math.round(TUNE.chargePar*a.cap));
    }else{
      a={t:'-',v:nice(E*(0.2+rnd()*0.2))};b={t:'/',v:2};
      Eb=Math.max(apply(a,E),apply(b,E));
    }
    var swap=rnd()<0.5;
    items.push({type:'gate',z:z,l:swap?b:a,r:swap?a:b,done:false,used:''});
    E=Math.min(CAP,Eb);
    var wz=z+50,fct=(TUNE.waveBase+TUNE.waveDiff*diff+rnd()*TUNE.waveRnd)*ease,tot=0,free;
    if(n>=2&&(i===gi||(n>=7&&i===segs-1))){
      var hp=nice(E*(TUNE.giantBase+TUNE.giantDiff*diffB));free=rnd()<0.5?-0.55:0.55;
      items.push({type:'foe',kind:'giant',big:true,z:wz+30,x:0,n:hp,max:hp,done:false});
      E=Math.max(3,E-Math.round(TUNE.giantPar*hp));
    }else if(i>=1&&rnd()<0.25+0.25*diff){
      var each=nice(E*fct*0.6);tot=each*2;free=0;
      items.push({type:'foe',kind:'norm',z:wz,x:-0.5,n:each,done:false},{type:'foe',kind:'norm',z:wz,x:0.5,n:each,done:false});
    }else{
      var lane=[-0.5,0,0.5][Math.floor(rnd()*3)],kr=rnd(),kind=(n>=3&&kr<0.25)?'fast':(n>=5&&kr<0.45)?'shield':'norm';
      tot=nice(E*fct*(kind==='fast'?0.6:kind==='shield'?0.75:1));free=lane>0?-0.55:0.55;
      items.push({type:'foe',kind:kind,z:wz+(kind==='fast'?25:0),x:lane,n:tot,done:false});
    }
    E=Math.max(3,E-Math.round(TUNE.parLoss*tot));
    /* pickup: free crate on mission 1, otherwise barrels you shoot open */
    if(n===1){
      if(i===1)items.push({type:'crate',z:z+40,x:free,w:'m249',done:false});
      if(i===3)items.push(barrel(z+42,free,{k:'troops',v:nice(E*TUNE.barrelPrize)},E));
    }else if(rnd()<0.5){
      var pr=rnd(),pool=WKEYS.filter(function(k){return WEAPONS[k].unlock<=n&&k!==weapon;}),prize;
      var sups=SUPDEF.filter(function(d){return n>=d[2];});
      if(pr<0.3&&pool.length)prize={k:'weapon',w:pool[Math.floor(rnd()*pool.length)]};
      else if(pr<0.45)prize={k:'support',s:sups[Math.floor(rnd()*sups.length)][0]};
      else{prize={k:'troops',v:nice(E*TUNE.barrelPrize)};E+=Math.round(prize.v*TUNE.barrelPar);}
      items.push(barrel(z+42,free,prize,E));
    }
    if(n>=3&&i<segs-1&&rnd()<0.3)items.push({type:'mines',z:z+66,side:rnd()<0.5?-1:1,done:false});
    z+=80;
  }
  bossZ=z+20;
  boss=bossStart=nice(E*(TUNE.bossBase+TUNE.bossDiff*diffB)*(bossMission?TUNE.bossMission:1)*ease);
}
function barrel(z,x,prize,E){var hp=Math.max(3,nice(E*TUNE.barrelHp));return{type:'barrel',z:z,x:x,n:hp,max:hp,prize:prize,done:false};}
