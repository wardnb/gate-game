// Headless balance study: runs the real game code with bot players and prints win rates per mission.
// Usage: node tools/sim.js ['{"tuneKey":value}'] [runsPerMission]   env: LV=1,5,12  UP=rec,mark,log
const vm=require('vm'),fs=require('fs');
const noop=()=>{};
function mk(tune){
  const mkel=()=>new Proxy({clientWidth:390,clientHeight:780,
    getContext:()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):String(k).startsWith('create')?()=>({addColorStop:noop}):noop,set:()=>true})},
    {get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>{t[k]=v;return true;}});
  const els={};
  const win={__GR_TEST:true,addEventListener:noop,matchMedia:()=>({matches:true}),devicePixelRatio:1};
  const sb={window:win,document:{getElementById:id=>els[id]||(els[id]=mkel()),addEventListener:noop,hidden:false,createElement:()=>mkel()},requestAnimationFrame:noop,setTimeout:noop,Math,console,JSON,Array,Object,String,parseInt};
  const dir=require('path').join(__dirname,'..','js');
  vm.runInNewContext(['a_core.js','b_draw.js','c_game.js'].map(f=>fs.readFileSync(require('path').join(dir,f),'utf8')).join('\n'),sb);
  Object.assign(win.__GR.TUNE,tune||{});
  if(process.env.UP){const u=process.env.UP.split(',').map(Number);win.__GR.save.up.rec=u[0];win.__GR.save.up.mark=u[1];win.__GR.save.up.log=u[2];}
  return win.__GR;
}
function gateVal(G,op,c,g,zr){
  if(op.t!=='c')return G.apply(op,c);
  const W=G.WEAPONS[g.weapon];const pot=Math.min(op.cap,op.v+W.dps*c*(Math.min(zr,W.range)/24)*0.8);
  return Math.max(1,c+Math.floor(pot));
}
const bots={
  skilled(G,g,mem){
    let tx=g.px;
    const gate=g.items.find(i=>i.type==='gate'&&!i.done);
    const foes=g.items.filter(i=>i.type==='foe'&&!i.done&&i.z>g.pz-2&&i.z-g.pz<100).sort((a,b)=>a.z-b.z||b.n-a.n);
    const crate=g.items.find(i=>i.type==='crate'&&!i.done&&i.z-g.pz<45);
    let gx=null,gz=1e9;
    if(gate){gz=gate.z-g.pz;const l=gateVal(G,gate.l,g.count,g,gz),r=gateVal(G,gate.r,g.count,g,gz);gx=l>r?-0.5:0.5;}
    const foe=foes[0];
    if(gate&&gz<26)tx=gx;
    else if(foe)tx=foe.x;
    else if(gate&&gz<70)tx=gx;
    else if(g.bossZ-g.pz<110)tx=0;
    if(crate&&mem.want&&!(foe&&foe.z-g.pz<30&&foe.n>g.count*0.2)&&!(gate&&gz<20))tx=crate.x;
    const bar=g.items.find(i=>i.type==='barrel'&&!i.done&&i.z>g.pz&&i.z-g.pz<85);
    if(bar&&!(foe&&foe.z-g.pz<55&&foe.n>g.count*0.2)&&!(gate&&gz<26)){tx=bar.x;if(bar.z-g.pz<14)tx=bar.x>0?bar.x-0.6:bar.x+0.6;}
    else if(bar&&bar.z-g.pz<14&&Math.abs(tx-bar.x)<0.45)tx=bar.x>0?bar.x-0.6:bar.x+0.6;
    const mine=g.items.find(i=>i.type==='mines'&&!i.done&&i.z>g.pz&&i.z-g.pz<22);
    if(mine)tx=-mine.side*0.5;
    const big=foes.find(f=>f.big);
    if(foe&&foe.z-g.pz<75&&foe.n>g.count*0.5)G.use('drone');
    if(big&&big.z-g.pz<80){G.use('arty');if(big.n>g.count*0.6)G.use('air');}
    if(g.bossZ-g.pz<100){G.use('arty');G.use('air');G.use('drone');}
    return tx;
  },
  casual(G,g,mem){
    const gate=g.items.find(i=>i.type==='gate'&&!i.done);
    if(gate&&mem.g!==gate){mem.g=gate;const l=gateVal(G,gate.l,g.count,g,0),r=gateVal(G,gate.r,g.count,g,0);
      const bestx=l>r?-0.5:0.5;mem.x=Math.random()<0.75?bestx:-bestx;}
    if(g.bossZ-g.pz<100){G.use('arty');G.use('air');G.use('drone');}
    const big=g.items.find(i=>i.type==='foe'&&i.big&&!i.done&&i.z-g.pz<95&&i.z>g.pz);
    if(big){if(big.z-g.pz<60){G.use('air');G.use('arty');}if(!(gate&&gate.z-g.pz<25))return big.x;}
    const mine=g.items.find(i=>i.type==='mines'&&!i.done&&i.z>g.pz&&i.z-g.pz<22);
    if(mine&&mem.m!==mine){mem.m=mine;mem.dodge=Math.random()<0.8;}
    if(mine&&mem.dodge)return -mine.side*0.5;
    if(!gate)return 0;
    return gate.z-g.pz<55?mem.x:g.px;
  },
  idle(){return 0.01;}
};
const KEYS=['m4','m249','m1014','m240','m320','m2','m134'];
const why={};
function run(G,level,bot){
  let w='m16';
  if(level>1&&Math.random()<(bot==='skilled'?0.6:0.3)){const p=KEYS.filter(k=>G.WEAPONS[k].unlock<=level-1);w=p[Math.floor(Math.random()*p.length)];}
  G.start(level,w);const mem={want:G.WEAPONS[w].dps<0.6};let n=0;
  while(n++<6000){
    const g=G.get();if(g.state==='win'||g.state==='lose'){if(bot==='skilled'&&g.state==='lose')why[g.lostTo]=(why[g.lostTo]||0)+1;return g;}
    if(g.state==='run'){const tx=bots[bot](G,g,mem),d=tx-g.px,st=2.5/30;G.setX(Math.max(-0.92,Math.min(0.92,g.px+Math.max(-st,Math.min(st,d)))));}
    G.step(1/30);
  }
  return G.get();
}
const tune=process.argv[2]?JSON.parse(process.argv[2]):{};
const G=mk(tune),N=+process.argv[3]||150;
console.log('lvl  skilled casual idle | skilled: avg troops at last stand vs force');
for(const L of (process.env.LV?process.env.LV.split(',').map(Number):[1,2,3,5,8,12,16,20])){
  let out=[];let ac=0,ab=0;
  for(const b of ['skilled','casual','idle']){
    let w=0;for(let i=0;i<N;i++){const g=run(G,L,b);if(g.state==='win')w++;if(b==='skilled'){ab+=g.bossStart;}}
    out.push((100*w/N).toFixed(0).padStart(5)+'%');
  }
  console.log(String(L).padStart(3),out.join(' '),'| force avg',(ab/N).toFixed(0));
}

console.log('careful-bot losses by cause',JSON.stringify(why));
