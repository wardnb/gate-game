"use strict";
/* Gate Rush drawing */
var THEMES=[
  {sky:['#143070','#4b84cf','#cfe3f6'],sun:'255,246,205',sunY:0.09,sunR:0.16,far:'#8ea3c6',near:'#a8977d',ground:['#e2cda2','#cfb384','#a98c60'],
   haze:'225,236,248',road:[56,63,80],roadFar:[156,168,195],shade:null,clouds:0.85,stars:false,dirt:'120,96,62',vig:0.38,tint:'#ffffff',dim:0},
  {sky:['#2a1f5c','#b8527a','#ffb870'],sun:'255,196,120',sunY:0.03,sunR:0.22,far:'#7c5a86',near:'#8a5f52',ground:['#e0a674','#b97f52','#8a5a3a'],
   haze:'255,205,165',road:[62,56,74],roadFar:[190,140,130],shade:'rgba(120,40,30,.10)',clouds:0.5,stars:false,dirt:'110,70,45',vig:0.42,tint:'#b0603a',dim:0.25},
  {sky:['#050a1c','#0f1f48','#2c4274'],sun:'225,232,255',sunY:0.14,sunR:0.1,far:'#1c2b52',near:'#26304c',ground:['#3c4a66','#2e3955','#212a44'],
   haze:'90,120,180',road:[40,46,62],roadFar:[70,88,128],shade:'rgba(6,12,36,.34)',clouds:0.16,stars:true,dirt:'20,26,44',vig:0.5,tint:'#18264a',dim:0.68}
];
function proj(x,zr){if(window.R3&&R3.ok)return R3.proj(x,zr);var s=1/(1+zr*K);return{x:W/2+x*roadHalf*s,y:horizon+(baseY-horizon)*s,s:s};}
var OFFS=[],cache={};
(function(){for(var i=0;i<MAXU;i++){var r=0.046*Math.sqrt(i+0.5),a=i*2.39996;OFFS.push({x:r*Math.cos(a),z:r*Math.sin(a)*14,i:i});}})();
function sorted(m){if(!cache[m])cache[m]=OFFS.slice(0,m).sort(function(a,b){return b.z-a.z;});return cache[m];}
function radius(n){return 0.046*Math.sqrt(Math.min(n,MAXU));}
function ell(x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function rrect(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);}

var PAL_US=BR().pal;
var PAL_RED={body:'#d63a48',dark:'#8e1f2b',helmet:'#a32633',gear:'#6e1620'};
var PAL_FAST={body:'#f08a3c',dark:'#a8521a',helmet:'#c96a22',gear:'#7a3a10'};
var PAL_SHIELD={body:'#b23a52',dark:'#5a2030',helmet:'#56627a',gear:'#3c465a'};
var PAL_GIANT={body:'#8e1f2b',dark:'#3a0d13',helmet:'#2b2b33',gear:'#1f1f26'};

/* Soldiers are painted once into small sprite sheets (8 run frames + 1 standing) and then blitted. */
var SPR={},SPW=46,SPH=64,SPFOOT=58;
function rr(c,x,y,w,h,r,fill,stroke,lw){
  c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function paintSoldier(c,u,ph,pal,run,facing,gun,gunCol){
  var x=SPW/2*u/16,y=SPFOOT*u/16,sw=run?Math.sin(ph):0,hop=run?Math.abs(Math.cos(ph))*u*0.22:0,ol='rgba(14,18,12,.9)',lw=u*0.11;
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x+u*0.2,y,u*0.95,u*0.3,0,0,TAU);c.fill();
  var top=y-u*1.1-hop,l1=y-Math.max(0,sw)*u*0.42,l2=y-Math.max(0,-sw)*u*0.42;
  rr(c,x-u*0.54,top,u*0.46,l1-top-u*0.12,u*0.1,pal.dark,ol,lw);
  rr(c,x+u*0.08,top,u*0.46,l2-top-u*0.12,u*0.1,pal.dark,ol,lw);
  rr(c,x-u*0.6,l1-u*0.26,u*0.6,u*0.26,u*0.08,'#22252a',ol,lw);
  rr(c,x+u*0.02,l2-u*0.26,u*0.6,u*0.26,u*0.08,'#22252a',ol,lw);
  var by=y-u*2.15-hop,arm=run?sw*u*0.12:0;
  rr(c,x-u*0.98,by+u*0.1+arm,u*0.34,u*0.86,u*0.14,pal.body,ol,lw);
  rr(c,x+u*0.64,by+u*0.1-arm,u*0.34,u*0.86,u*0.14,pal.body,ol,lw);
  rr(c,x-u*0.7,by,u*1.4,u*1.22,u*0.22,pal.body,ol,lw);
  c.fillStyle='rgba(255,255,255,.12)';c.fillRect(x-u*0.62,by+u*0.08,u*0.34,u*1.02);
  if(facing){
    rr(c,x-u*0.52,by+u*0.16,u*1.04,u*0.6,u*0.1,pal.gear,null,0);
    c.fillStyle=pal.dark;c.fillRect(x-u*0.7,by+u*0.9,u*1.4,u*0.2);
    c.fillStyle='#d8b23a';c.fillRect(x-u*0.12,by+u*0.9,u*0.24,u*0.2);
  }else{
    rr(c,x-u*0.5,by+u*0.12,u*1.0,u*0.86,u*0.14,pal.gear,ol,lw*0.8);
    rr(c,x-u*0.58,by-u*0.02,u*1.16,u*0.26,u*0.12,pal.dark,ol,lw*0.8);
    c.fillStyle='rgba(255,255,255,.1)';c.fillRect(x-u*0.42,by+u*0.2,u*0.2,u*0.7);
  }
  c.lineCap='round';
  if(facing){
    c.strokeStyle=ol;c.lineWidth=u*0.34;c.beginPath();c.moveTo(x-u*0.9,by+u*0.82);c.lineTo(x+u*0.7,by+u*0.42);c.stroke();
    c.strokeStyle='#2b3038';c.lineWidth=u*0.2;c.beginPath();c.moveTo(x-u*0.9,by+u*0.82);c.lineTo(x+u*0.7,by+u*0.42);c.stroke();
  }else{
    c.strokeStyle=ol;c.lineWidth=u*(gun+0.14);c.beginPath();c.moveTo(x+u*0.74,by+u*0.9);c.lineTo(x+u*1.0,by-u*0.6);c.stroke();
    c.strokeStyle=gunCol;c.lineWidth=u*gun;c.beginPath();c.moveTo(x+u*0.74,by+u*0.9);c.lineTo(x+u*1.0,by-u*0.6);c.stroke();
  }
  c.lineCap='butt';
  var hy=y-u*2.62-hop;
  if(facing){
    c.beginPath();c.arc(x,hy,u*0.5,0,TAU);c.fillStyle='#e6c09a';c.fill();c.strokeStyle=ol;c.lineWidth=lw;c.stroke();
    c.fillStyle='#1b1b1f';c.fillRect(x-u*0.3,hy+u*0.02,u*0.18,u*0.12);c.fillRect(x+u*0.12,hy+u*0.02,u*0.18,u*0.12);
    c.fillRect(x-u*0.16,hy+u*0.26,u*0.32,u*0.07);
    c.beginPath();c.arc(x,hy-u*0.06,u*0.62,Math.PI,TAU);c.closePath();c.fillStyle=pal.helmet;c.fill();c.strokeStyle=ol;c.stroke();
    rr(c,x-u*0.7,hy-u*0.14,u*1.4,u*0.16,u*0.06,pal.helmet,ol,lw*0.8);
  }else{
    c.fillStyle='#d9b48f';c.fillRect(x-u*0.2,hy+u*0.22,u*0.4,u*0.3);
    c.beginPath();c.arc(x,hy,u*0.6,0,TAU);c.fillStyle=pal.helmet;c.fill();c.strokeStyle=ol;c.lineWidth=lw;c.stroke();
    c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.arc(x-u*0.16,hy-u*0.2,u*0.24,0,TAU);c.fill();
    c.fillStyle=pal.dark;c.fillRect(x-u*0.58,hy+u*0.12,u*1.16,u*0.1);
  }
}
function sprite(pal,facing,frame,U){
  var gun=facing?0.2:WEAPONS[weapon].gun,key=pal.body+(facing?'f':'b'+gun)+frame+'|'+U;
  var c=SPR[key];
  if(!c){
    c=document.createElement('canvas');c.width=Math.ceil(SPW*U/16);c.height=Math.ceil(SPH*U/16);
    paintSoldier(c.getContext('2d'),U,frame*TAU/8,pal,frame<8,facing,gun,weapon==='m320'?'#4a5630':'#2b3038');
    SPR[key]=c;
  }
  return c;
}
function soldier(x,y,u,ph,pal,run,facing){
  if(u<2.8){
    /* far away: three shapes instead of a sprite */
    ctx.fillStyle=pal.dark;ctx.fillRect(x-u*0.5,y-u*1.05,u,u*1.05);
    ctx.fillStyle=pal.body;ctx.fillRect(x-u*0.8,y-u*2.1,u*1.6,u*1.1);
    ctx.fillStyle=pal.helmet;ctx.fillRect(x-u*0.55,y-u*3.05,u*1.1,u*0.95);
    return;
  }
  var fr=run?((Math.floor(ph/TAU*8)%8)+8)%8:8,U=u>40?64:u>14?32:16,img=sprite(pal,facing,fr,U),k=u/U;
  ctx.drawImage(img,x-img.width*k/2,y-SPFOOT*k*U/16,img.width*k,img.height*k);
}
function drawCrowd(cx,zr,n,pal,run,facing,speed){
  var m=Math.min(n,DRAWMAX);if(m<=0)return;
  var list=sorted(m),sp=speed||11;
  for(var j=0;j<list.length;j++){
    var o=list[j],z=zr+o.z;
    if(1+z*K<0.55)continue;
    var p=proj(cx+o.x,z);
    soldier(p.x,p.y,roadHalf*0.055*p.s,time*sp+o.i*1.7,pal,run,facing);
  }
}
function pill(text,x,y,size,bg,border){
  ctx.font='400 '+size+'px '+FONT;
  ctx.textAlign='center';ctx.textBaseline='middle';
  var w=ctx.measureText(text).width+size*0.9,h=size*1.35;
  ctx.fillStyle=bg;rrect(x-w/2,y-h/2,w,h,h/2);ctx.fill();
  if(border){ctx.lineWidth=Math.max(1.5,size*0.09);ctx.strokeStyle=border;ctx.stroke();}
  ctx.fillStyle='#fff';ctx.fillText(text,x,y+size*0.04);
}
function star(cx,cy,r){
  ctx.beginPath();
  for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,q=i%2?r*0.42:r;ctx.lineTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q);}
  ctx.closePath();ctx.fill();
}

/* ---------- world ---------- */
function hsh(k,a){var v=Math.sin(k*127.1+a*311.7)*43758.5453;return v-Math.floor(v);}
function quad(x0,x1,za,zb,fill){
  var a0=proj(x0,za),a1=proj(x1,za),b0=proj(x0,zb),b1=proj(x1,zb);
  ctx.fillStyle=fill;ctx.beginPath();
  ctx.moveTo(a0.x,a0.y);ctx.lineTo(a1.x,a1.y);ctx.lineTo(b1.x,b1.y);ctx.lineTo(b0.x,b0.y);ctx.closePath();ctx.fill();
}
function ridge(base,amp,seed,col,step){
  ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,horizon+1);
  for(var x=0;x<=W+step;x+=step){
    var k=x/step,hh=(hsh(Math.floor(k),seed)*0.7+hsh(Math.floor(k/3),seed+5)*0.6)*amp;
    ctx.lineTo(x,horizon-base-hh);
  }
  ctx.lineTo(W,horizon+1);ctx.closePath();ctx.fill();
}
function cloud(x,y,s,a){
  ctx.fillStyle='rgba(255,255,255,'+a+')';
  ell(x,y,s*1.3,s*0.42);ell(x-s*0.6,y+s*0.12,s*0.8,s*0.32);ell(x+s*0.55,y+s*0.1,s*0.9,s*0.34);ell(x+s*0.1,y-s*0.25,s*0.7,s*0.38);
}
function tri(x0,y0,x1,y1,x2,y2,col){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.fill();}
function line(x0,y0,x1,y1,col,w){ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,w);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
function buoy(x,y,u,col){
  ctx.fillStyle='rgba(255,255,255,.35)';ell(x,y,u*0.16,u*0.04);
  tri(x-u*0.08,y,x,y-u*0.24,x+u*0.08,y,col);
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(x,y-u*0.12,u*0.06,u*0.12);
  ctx.fillStyle=(Math.floor(time*2)%2)?'#fff6a0':'rgba(255,246,160,.3)';ell(x,y-u*0.26,u*0.025,u*0.025);
}
function boat(x,y,u,hull,stripe){
  ctx.fillStyle='rgba(255,255,255,.4)';ell(x-u*0.38,y,u*0.16,u*0.03);
  ctx.fillStyle=hull;ctx.beginPath();ctx.moveTo(x-u*0.36,y-u*0.09);ctx.lineTo(x+u*0.42,y-u*0.09);ctx.lineTo(x+u*0.3,y);ctx.lineTo(x-u*0.32,y);ctx.closePath();ctx.fill();
  if(stripe){ctx.fillStyle=stripe;ctx.beginPath();ctx.moveTo(x+u*0.1,y-u*0.09);ctx.lineTo(x+u*0.18,y-u*0.09);ctx.lineTo(x+u*0.12,y);ctx.lineTo(x+u*0.04,y);ctx.closePath();ctx.fill();}
  ctx.fillStyle=hull;ctx.fillRect(x-u*0.2,y-u*0.18,u*0.26,u*0.1);
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x-u*0.2,y-u*0.18,u*0.26,u*0.025);
  line(x-u*0.08,y-u*0.18,x-u*0.08,y-u*0.32,'#555c66',u*0.02);
}
var PROP={
  rock:function(x,y,u){
    ctx.fillStyle='#9a835f';ctx.beginPath();ctx.moveTo(x-u*0.24,y);ctx.lineTo(x-u*0.16,y-u*0.2);ctx.lineTo(x+u*0.04,y-u*0.27);ctx.lineTo(x+u*0.24,y-u*0.1);ctx.lineTo(x+u*0.26,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7d6a4c';ctx.beginPath();ctx.moveTo(x+u*0.04,y-u*0.27);ctx.lineTo(x+u*0.24,y-u*0.1);ctx.lineTo(x+u*0.26,y);ctx.lineTo(x+u*0.06,y);ctx.closePath();ctx.fill();
  },
  bush:function(x,y,u){
    ctx.fillStyle='#5f7340';ell(x-u*0.1,y-u*0.1,u*0.14,u*0.12);ell(x+u*0.1,y-u*0.08,u*0.13,u*0.1);
    ctx.fillStyle='#74894d';ell(x,y-u*0.16,u*0.14,u*0.13);
  },
  bags:function(x,y,u){
    for(var r=0;r<3;r++)for(var c=0;c<3-r;c++){ctx.fillStyle=r%2?'#bfae80':'#cdbd8e';ell(x+(c-(2-r)/2)*u*0.2,y-u*0.05-r*u*0.085,u*0.11,u*0.05);}
  },
  tent:function(x,y,u){
    tri(x-u*0.32,y,x,y-u*0.34,x+u*0.32,y,'#5d6b38');tri(x,y-u*0.34,x+u*0.32,y,x+u*0.1,y,'#4a562c');tri(x-u*0.08,y,x-u*0.02,y-u*0.17,x+u*0.05,y,'#2f381c');
  },
  cactus:function(x,y,u){
    ctx.fillStyle='#5b6e3c';ctx.fillRect(x-u*0.035,y-u*0.36,u*0.07,u*0.36);
    ctx.fillRect(x-u*0.15,y-u*0.24,u*0.12,u*0.05);ctx.fillRect(x-u*0.15,y-u*0.3,u*0.045,u*0.11);
    ctx.fillRect(x+u*0.03,y-u*0.18,u*0.12,u*0.05);ctx.fillRect(x+u*0.105,y-u*0.27,u*0.045,u*0.14);
  },
  palm:function(x,y,u){
    ctx.strokeStyle='#7a5a36';ctx.lineWidth=Math.max(1,u*0.05);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+u*0.12,y-u*0.3,x+u*0.05,y-u*0.56);ctx.stroke();
    var tx=x+u*0.05,ty=y-u*0.56,a=[-2.9,-2.3,-1.6,-0.9,-0.25],i;
    for(i=0;i<a.length;i++){ctx.fillStyle=i%2?'#3f7a30':'#4f8f3a';ctx.beginPath();ctx.ellipse(tx+Math.cos(a[i])*u*0.14,ty+Math.sin(a[i])*u*0.07+u*0.04,u*0.17,u*0.04,a[i]+(a[i]<-1.57?-0.3:0.3),0,TAU);ctx.fill();}
    ctx.fillStyle='#5a4126';ell(tx,ty+u*0.02,u*0.04,u*0.035);
  },
  craft:function(x,y,u){
    ctx.fillStyle='#6b7350';ctx.beginPath();ctx.moveTo(x-u*0.3,y);ctx.lineTo(x-u*0.34,y-u*0.12);ctx.lineTo(x+u*0.26,y-u*0.12);ctx.lineTo(x+u*0.36,y-u*0.04);ctx.lineTo(x+u*0.3,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#545b3e';ctx.fillRect(x-u*0.2,y-u*0.19,u*0.24,u*0.07);
    ctx.fillStyle='#2b2f2a';ctx.fillRect(x-u*0.3,y-u*0.035,u*0.6,u*0.035);
  },
  buoyR:function(x,y,u){buoy(x,y,u,'#d23a3a');},
  buoyG:function(x,y,u){buoy(x,y,u,'#2f8f4a');},
  boat:function(x,y,u){boat(x,y,u,'#8a929e',null);},
  cutter:function(x,y,u){boat(x,y,u,'#f4f4f2','#e8742c');},
  cap:function(x,y,u){ctx.fillStyle='rgba(255,255,255,.55)';ell(x-u*0.1,y-u*0.02,u*0.12,u*0.025);ell(x+u*0.12,y,u*0.08,u*0.02);},
  ice:function(x,y,u){
    ctx.fillStyle='#eef6fb';ctx.beginPath();ctx.moveTo(x-u*0.28,y);ctx.lineTo(x-u*0.2,y-u*0.07);ctx.lineTo(x+u*0.06,y-u*0.09);ctx.lineTo(x+u*0.26,y-u*0.04);ctx.lineTo(x+u*0.22,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#b9d6e6';ctx.fillRect(x-u*0.26,y-u*0.012,u*0.48,u*0.02);
  },
  light:function(x,y,u){
    ctx.fillStyle='#6d6a64';ell(x,y-u*0.02,u*0.18,u*0.06);
    ctx.fillStyle='#f4f2ec';ctx.beginPath();ctx.moveTo(x-u*0.09,y-u*0.04);ctx.lineTo(x-u*0.05,y-u*0.6);ctx.lineTo(x+u*0.05,y-u*0.6);ctx.lineTo(x+u*0.09,y-u*0.04);ctx.closePath();ctx.fill();
    ctx.fillStyle='#c8102e';ctx.fillRect(x-u*0.08,y-u*0.24,u*0.16,u*0.07);ctx.fillRect(x-u*0.065,y-u*0.44,u*0.13,u*0.07);
    ctx.fillStyle='#2b2f36';ctx.fillRect(x-u*0.07,y-u*0.7,u*0.14,u*0.1);
    ctx.fillStyle='rgba(255,236,150,'+(0.55+0.45*Math.sin(time*3))+')';ctx.fillRect(x-u*0.045,y-u*0.68,u*0.09,u*0.06);
  },
  hangar:function(x,y,u){
    ctx.fillStyle='#8a929c';ctx.beginPath();ctx.ellipse(x,y,u*0.36,u*0.3,0,Math.PI,TAU);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6c747e';ctx.beginPath();ctx.ellipse(x+u*0.12,y,u*0.24,u*0.3,0,1.5*Math.PI,TAU);ctx.lineTo(x+u*0.36,y);ctx.lineTo(x+u*0.12,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2b3038';ctx.fillRect(x-u*0.17,y-u*0.17,u*0.34,u*0.17);
  },
  tower:function(x,y,u){
    ctx.fillStyle='#cfcac0';ctx.fillRect(x-u*0.04,y-u*0.55,u*0.08,u*0.55);
    ctx.fillStyle='#3a5a78';ctx.beginPath();ctx.moveTo(x-u*0.13,y-u*0.66);ctx.lineTo(x+u*0.13,y-u*0.66);ctx.lineTo(x+u*0.09,y-u*0.55);ctx.lineTo(x-u*0.09,y-u*0.55);ctx.closePath();ctx.fill();
    ctx.fillStyle='#8a929c';ctx.fillRect(x-u*0.14,y-u*0.69,u*0.28,u*0.035);
    ctx.fillStyle=(Math.floor(time*1.5)%2)?'#ff4d4d':'#7a2020';ell(x,y-u*0.71,u*0.02,u*0.02);
  },
  sock:function(x,y,u){
    line(x,y,x,y-u*0.4,'#c9ccd2',u*0.02);
    var w=Math.sin(time*2)*u*0.01;
    for(var i=0;i<4;i++){ctx.fillStyle=i%2?'#f6f3ea':'#ff7a1a';var x0=x+i*u*0.06,h=u*(0.05-i*0.007);ctx.fillRect(x0,y-u*0.39-h/2+w*i,u*0.06,h);}
  },
  lights:function(x,y,u){
    for(var i=-1;i<=1;i++){line(x+i*u*0.12,y,x+i*u*0.12,y-u*0.06,'#55606e',u*0.015);ctx.fillStyle=i?'#6fb2ff':'#f6f3ea';ell(x+i*u*0.12,y-u*0.07,u*0.018,u*0.018);}
  },
  dish:function(x,y,u){
    ctx.fillStyle='#8a8f99';ctx.fillRect(x-u*0.03,y-u*0.2,u*0.06,u*0.2);ctx.fillRect(x-u*0.1,y-u*0.03,u*0.2,u*0.03);
    ctx.save();ctx.translate(x,y-u*0.26);ctx.rotate(-0.5+Math.sin(time*0.3+x)*0.15);
    ctx.fillStyle='#f0f1f3';ctx.beginPath();ctx.ellipse(0,0,u*0.2,u*0.07,0,0,Math.PI);ctx.closePath();ctx.fill();
    ctx.fillStyle='#c9ccd2';ctx.beginPath();ctx.ellipse(0,0,u*0.2,u*0.025,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#6c717a';ctx.lineWidth=Math.max(1,u*0.012);ctx.beginPath();ctx.moveTo(0,u*0.02);ctx.lineTo(0,-u*0.16);ctx.stroke();
    ctx.restore();
  },
  rocket:function(x,y,u){
    ctx.strokeStyle='#b5523a';ctx.lineWidth=Math.max(1,u*0.014);
    var gx=x+u*0.14,i;line(gx,y,gx,y-u*0.82,'#b5523a',u*0.02);line(gx+u*0.08,y,gx+u*0.08,y-u*0.82,'#b5523a',u*0.02);
    for(i=0;i<8;i++){ctx.beginPath();ctx.moveTo(gx,y-i*u*0.1);ctx.lineTo(gx+u*0.08,y-(i+1)*u*0.1);ctx.stroke();}
    ctx.fillStyle='#f4f4f2';ctx.fillRect(x-u*0.05,y-u*0.72,u*0.1,u*0.66);
    ctx.fillStyle='#d9dadf';ctx.fillRect(x+u*0.015,y-u*0.72,u*0.035,u*0.66);
    tri(x-u*0.05,y-u*0.72,x,y-u*0.88,x+u*0.05,y-u*0.72,'#2b2f36');
    tri(x-u*0.05,y-u*0.06,x-u*0.11,y,x-u*0.05,y-u*0.16,'#2b2f36');tri(x+u*0.05,y-u*0.06,x+u*0.11,y,x+u*0.05,y-u*0.16,'#2b2f36');
    ctx.fillStyle='#7d7f86';ctx.fillRect(x-u*0.16,y-u*0.06,u*0.4,u*0.06);
  },
  mast:function(x,y,u){
    line(x-u*0.06,y,x-u*0.01,y-u*0.62,'#9aa0aa',u*0.018);line(x+u*0.06,y,x+u*0.01,y-u*0.62,'#9aa0aa',u*0.018);
    for(var i=1;i<6;i++){var yy=y-i*u*0.1,hw=u*(0.06-i*0.008);line(x-hw,yy,x+hw,yy-u*0.05,'#9aa0aa',u*0.012);}
    ctx.fillStyle=(Math.floor(time*1.2)%2)?'#ff4d4d':'#7a2020';ell(x,y-u*0.64,u*0.022,u*0.022);
  },
  acacia:function(x,y,u){
    line(x,y,x-u*0.03,y-u*0.3,'#5a4630',u*0.04);line(x-u*0.02,y-u*0.22,x+u*0.12,y-u*0.36,'#5a4630',u*0.025);
    ctx.fillStyle='#6b7a3c';ell(x-u*0.02,y-u*0.38,u*0.3,u*0.07);ctx.fillStyle='#7f8f48';ell(x+u*0.04,y-u*0.41,u*0.2,u*0.05);
  },
  tree:function(x,y,u){
    line(x,y,x,y-u*0.22,'#5a4630',u*0.045);
    ctx.fillStyle='#4c6d34';ell(x-u*0.08,y-u*0.3,u*0.14,u*0.13);ell(x+u*0.09,y-u*0.28,u*0.13,u*0.12);
    ctx.fillStyle='#5f8540';ell(x,y-u*0.4,u*0.15,u*0.14);
  },
  tank:function(x,y,u){
    ctx.fillStyle='#2b2d26';ctx.fillRect(x-u*0.3,y-u*0.07,u*0.6,u*0.07);
    ctx.fillStyle='#6e6a4c';ctx.beginPath();ctx.moveTo(x-u*0.32,y-u*0.07);ctx.lineTo(x-u*0.28,y-u*0.15);ctx.lineTo(x+u*0.3,y-u*0.15);ctx.lineTo(x+u*0.34,y-u*0.07);ctx.closePath();ctx.fill();
    ctx.fillStyle='#5c5940';ctx.fillRect(x-u*0.14,y-u*0.23,u*0.26,u*0.08);
    line(x+u*0.1,y-u*0.2,x+u*0.42,y-u*0.22,'#4a4834',u*0.03);
  },
  fighter:function(x,y,u){
    ctx.fillStyle='#8d949c';ctx.beginPath();ctx.moveTo(x-u*0.36,y-u*0.08);ctx.lineTo(x+u*0.34,y-u*0.1);ctx.lineTo(x+u*0.4,y-u*0.07);ctx.lineTo(x-u*0.36,y-u*0.04);ctx.closePath();ctx.fill();
    tri(x-u*0.1,y-u*0.07,x+u*0.12,y-u*0.07,x-u*0.16,y,'#737a83');
    tri(x-u*0.36,y-u*0.07,x-u*0.26,y-u*0.07,x-u*0.34,y-u*0.22,'#737a83');
    ctx.fillStyle='#2e4a66';ell(x+u*0.2,y-u*0.11,u*0.06,u*0.025);
    line(x-u*0.2,y-u*0.04,x-u*0.2,y,'#3a3e44',u*0.012);line(x+u*0.24,y-u*0.06,x+u*0.24,y,'#3a3e44',u*0.012);
  },
  radome:function(x,y,u){
    ctx.fillStyle='#8a8f99';ctx.fillRect(x-u*0.16,y-u*0.12,u*0.32,u*0.12);
    ctx.fillStyle='#eef0f2';ctx.beginPath();ctx.arc(x,y-u*0.24,u*0.18,0,TAU);ctx.fill();
    ctx.fillStyle='#d3d7dc';ctx.beginPath();ctx.arc(x+u*0.05,y-u*0.22,u*0.13,-0.6,1.6);ctx.fill();
  }
};
function drawProp(k,land){
  var z=k*22,zr=z-pz;if(zr<-10||zr>330)return;
  var side=(k%2===0)?1:-1,h1=hsh(k,1),h2=hsh(k,2);
  var p=proj(side*(1.4+h1*1.1),zr),u=roadHalf*p.s,name=land.props[Math.floor(h2*land.props.length)];
  ctx.globalAlpha=Math.min(1,p.s*5);
  if(!land.water&&name!=='cap')ctx.fillStyle='rgba(0,0,0,.18)',ell(p.x+u*0.06,p.y,u*0.3,u*0.06);
  (PROP[name]||PROP.rock)(p.x,p.y,u);
  ctx.globalAlpha=1;
}
/* branch land colours shaded for the time of day */
function mixHex(a,b,t){
  var x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16),r=[16,8,0].map(function(s){var p=(x>>s)&255,q=(y>>s)&255;return Math.round(p+(q-p)*t);});
  return 'rgb('+r[0]+','+r[1]+','+r[2]+')';
}
function scene(th,land){
  var m=function(c){return mixHex(c,th.tint,th.dim);};
  return{ground:land.ground.map(m),far:land.far&&[m(land.far[0]),land.far[1]],near:land.near&&[m(land.near[0]),land.near[1]],sea:land.sea&&m(land.sea)};
}
var bgCv=null,bgKey='';
function buildBackdrop(th){
  /* sky, sun, ridges and ground never change during a mission: paint them once and blit */
  if(!bgCv)bgCv=document.createElement('canvas');
  bgCv.width=cv.width;bgCv.height=cv.height;
  var real=ctx,i;ctx=bgCv.getContext('2d');ctx.setTransform(DPR,0,0,DPR,0,0);
  var g=ctx.createLinearGradient(0,0,0,horizon);
  g.addColorStop(0,th.sky[0]);g.addColorStop(0.55,th.sky[1]);g.addColorStop(1,th.sky[2]);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,horizon+1);
  if(th.stars){
    ctx.fillStyle='#fff';
    for(i=0;i<46;i++){ctx.globalAlpha=0.35+0.6*hsh(i,21);ctx.fillRect(hsh(i,11)*W,hsh(i,12)*horizon*0.85,1.6,1.6);}
    ctx.globalAlpha=1;
  }
  var sx=W*0.74,sy=horizon-H*th.sunY,R=H*th.sunR,sg=ctx.createRadialGradient(sx,sy,0,sx,sy,R);
  sg.addColorStop(0,'rgba('+th.sun+',1)');sg.addColorStop(0.22,'rgba('+th.sun+',.95)');sg.addColorStop(0.3,'rgba('+th.sun+',.32)');sg.addColorStop(1,'rgba('+th.sun+',0)');
  ctx.fillStyle=sg;ctx.fillRect(sx-R,sy-R,R*2,R*2);
  var sc=scene(th,BR().land),gy=horizon;
  if(sc.far)ridge(H*0.012*sc.far[1],H*0.05*sc.far[1],3,sc.far[0],W/14);
  if(sc.near)ridge(0,H*0.03*sc.near[1],7,sc.near[0],W/9);
  if(sc.sea){
    gy=horizon+H*0.035;ctx.fillStyle=sc.sea;ctx.fillRect(0,horizon,W,gy-horizon+1);
    ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(0,gy-H*0.004,W,H*0.004);
  }
  var s=ctx.createLinearGradient(0,gy,0,H);
  s.addColorStop(0,sc.ground[0]);s.addColorStop(0.4,sc.ground[1]);s.addColorStop(1,sc.ground[2]);
  ctx.fillStyle=s;ctx.fillRect(0,gy,W,H-gy);
  ctx=real;
}
function drawWorld(){
  var th=THEMES[theme],land=BR().land,key=theme+'|'+save.branch+'|'+cv.width+'|'+cv.height;
  if(key!==bgKey){buildBackdrop(th);bgKey=key;}
  ctx.drawImage(bgCv,0,0,W,H);
  var drift=reduceMotion?0:time*3;
  for(var c=0;c<4;c++){
    var cxp=((hsh(c,9)*W*1.4+drift*(0.5+c*0.2))%(W*1.4))-W*0.2;
    cloud(cxp,horizon*(0.2+hsh(c,4)*0.36),W*(0.05+hsh(c,6)*0.04),th.clouds);
  }
  var near=-12,far=420,start=Math.floor((pz+near)/10)*10;
  if(land.water)for(var g=Math.floor((pz-10)/7);g<Math.floor((pz+200)/7);g++){
    var gz=g*7-pz;if(gz<-8)continue;
    var gs=(g%2?1:-1)*(1.15+hsh(g,31)*2.2),gp=proj(gs,gz),gu=roadHalf*gp.s,ga=0.25+0.3*Math.sin(time*2.4+g);
    if(ga>0){ctx.fillStyle='rgba(255,255,255,'+ga+')';ell(gp.x,gp.y,gu*0.09,gu*0.014);}
  }
  quad(-1.3,1.3,near,60,'rgba('+land.dirt+',.16)');
  for(var z=start;z<pz+far;z+=10){
    var za=Math.max(near,z-pz),zb=Math.min(far,z+10-pz);
    if(zb<=za)continue;
    var odd=((Math.round(z/10)%2)+2)%2,sc=1/(1+Math.max(0,za)*K),t=1-Math.min(1,sc*1.5),d=odd?0:7;
    var col='rgb('+Math.round(th.road[0]+d+t*(th.roadFar[0]-th.road[0]))+','+Math.round(th.road[1]+d+t*(th.roadFar[1]-th.road[1]))+','+Math.round(th.road[2]+d+t*(th.roadFar[2]-th.road[2]))+')';
    quad(-1.08,1.08,za,zb,land.curb[odd?0:1]);
    quad(-1,1,za,zb,col);
    if(odd&&za<200)quad(-0.014,0.014,za,zb,'rgba(255,214,90,.8)');
  }
  quad(-0.97,-0.955,near,far,'rgba(255,255,255,.5)');quad(0.955,0.97,near,far,'rgba(255,255,255,.5)');
  var hz=ctx.createLinearGradient(0,horizon,0,horizon+H*0.1);
  hz.addColorStop(0,'rgba('+th.haze+',.75)');hz.addColorStop(1,'rgba('+th.haze+',0)');
  ctx.fillStyle=hz;ctx.fillRect(0,horizon,W,H*0.1);
  var k0=Math.floor((pz-10)/22),k1=Math.floor((pz+330)/22);
  for(var k=k1;k>=k0;k--)drawProp(k,land);
  if(th.shade){ctx.fillStyle=th.shade;ctx.fillRect(0,horizon,W,H-horizon);}
}

/* ---------- objects ---------- */
function drawGate(it,zr){
  if(1+zr*K<0.6)return;
  var sides=[['l',-0.97,-0.03,it.l],['r',0.03,0.97,it.r]],pc=proj(0,zr),hh=roadHalf*0.66*pc.s,pw=Math.max(2,roadHalf*0.045*pc.s);
  for(var i=0;i<2;i++){
    var sd=sides[i],a=proj(sd[1],zr),b=proj(sd[2],zr),good=isGood(sd[3]),w=b.x-a.x,top=a.y-hh;
    if(it.done&&it.used===sd[0])continue;
    var al=it.done?0.45:1,rgb=good?'38,132,255':'232,52,70',chg=sd[3].t==='c';
    ctx.fillStyle='rgba('+rgb+','+(0.28*al)+')';ell((a.x+b.x)/2,a.y,w*0.55,hh*0.09);
    var g=ctx.createLinearGradient(0,top,0,a.y);
    g.addColorStop(0,'rgba('+rgb+','+(0.82*al)+')');g.addColorStop(1,'rgba('+rgb+','+(0.38*al)+')');
    ctx.fillStyle=g;ctx.fillRect(a.x,top,w,hh);
    ctx.fillStyle='rgba(255,255,255,'+(0.13*al)+')';ctx.beginPath();
    ctx.moveTo(a.x+w*0.12,a.y);ctx.lineTo(a.x+w*0.42,top);ctx.lineTo(a.x+w*0.62,top);ctx.lineTo(a.x+w*0.32,a.y);ctx.closePath();ctx.fill();
    ctx.fillStyle=chg?'rgba(255,200,40,'+al+')':good?'rgba(20,70,170,'+al+')':'rgba(140,20,36,'+al+')';ctx.fillRect(a.x,top-hh*0.13,w,hh*0.15);
    if(chg){
      ctx.font='400 '+(hh*0.115)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(40,28,0,'+al+')';
      ctx.fillText(sd[3].v>=sd[3].cap?'MAX':'SHOOT TO RAISE',(a.x+b.x)/2,top-hh*0.05);
      if(sd[3].hitT>0){ctx.fillStyle='rgba(255,255,255,'+(sd[3].hitT*0.5)+')';ctx.fillRect(a.x,top,w,hh);}
    }else{
      ctx.fillStyle='rgba(255,255,255,'+(0.9*al)+')';
      for(var st=0;st<3;st++)star(a.x+w*(0.3+st*0.2),top-hh*0.055,hh*0.05);
    }
    ctx.font='400 '+(hh*0.5)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=Math.max(1,hh*0.09);ctx.lineJoin='round';ctx.strokeStyle='rgba(8,16,40,'+(0.7*al)+')';
    ctx.strokeText(label(sd[3]),(a.x+b.x)/2,a.y-hh*0.46);
    ctx.fillStyle='rgba(255,255,255,'+al+')';ctx.fillText(label(sd[3]),(a.x+b.x)/2,a.y-hh*0.46);
  }
  var xs=[-1,0,1];
  for(var j=0;j<3;j++){
    var q=proj(xs[j],zr);
    ctx.fillStyle='#dfe4ee';ctx.fillRect(q.x-pw/2,q.y-hh*1.16,pw,hh*1.16);
    ctx.fillStyle='#9aa3b5';ctx.fillRect(q.x+pw*0.1,q.y-hh*1.16,pw*0.4,hh*1.16);
    ctx.fillStyle='#ffd23f';ctx.fillRect(q.x-pw*0.8,q.y-hh*1.2,pw*1.6,hh*0.05);
  }
}
function drawGiant(it,zr,name){
  var p=proj(it.x,zr),u=roadHalf*0.23*p.s,n=Math.ceil(it.n);
  ctx.fillStyle='rgba(0,0,0,.3)';ell(p.x,p.y,u*1.6,u*0.45);
  soldier(p.x,p.y,u,time*3.2,PAL_GIANT,!!it.active&&state==='run',true);
  if(it.max){
    var bw=u*2.6,by=p.y-u*3.6,fr=Math.max(0,Math.min(1,it.n/it.max));
    ctx.fillStyle='rgba(10,14,30,.8)';ctx.fillRect(p.x-bw/2,by,bw,u*0.3);
    ctx.fillStyle='#ff4d5e';ctx.fillRect(p.x-bw/2,by,bw*fr,u*0.3);
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,u*0.05);ctx.strokeRect(p.x-bw/2,by,bw,u*0.3);
    pill(String(n),p.x,by-u*0.55,Math.max(9,u*0.6),'rgba(110,12,26,.95)','rgba(255,255,255,.85)');
  }else if(name){
    pill(name,p.x,p.y-u*3.5,Math.max(8,u*0.42),'rgba(20,20,26,.9)','rgba(255,210,63,.9)');
  }
}
function drawFoe(it,zr){
  if(1+zr*K<0.6)return;
  if(it.big){drawGiant(it,zr);return;}
  var n=Math.ceil(it.n),run=!!it.active&&state==='run',p=proj(it.x,zr),sz=Math.max(9,roadHalf*0.13*p.s),py=p.y-roadHalf*0.42*p.s;
  if(it.kind==='fast'){
    drawCrowd(it.x,zr,n,PAL_FAST,run,true,17);
    pill(n+' »',p.x,py,sz,'rgba(214,100,16,.96)','rgba(255,255,255,.85)');
  }else if(it.kind==='shield'){
    drawCrowd(it.x,zr,n,PAL_SHIELD,run,true,7);
    var rw=roadHalf*(radius(n)+0.07)*p.s,sh=roadHalf*0.15*p.s,fy=proj(it.x,Math.max(0,zr-7)).y;
    ctx.fillStyle='rgba(120,140,175,.62)';rrect(p.x-rw,fy-sh,rw*2,sh,sh*0.2);ctx.fill();
    ctx.strokeStyle='rgba(230,238,250,.85)';ctx.lineWidth=Math.max(1,sh*0.1);ctx.stroke();
    ctx.fillStyle='rgba(230,238,250,.8)';ctx.fillRect(p.x-rw*0.5,fy-sh*0.62,rw,sh*0.16);
    pill(String(n),p.x,py,sz,'rgba(64,78,104,.96)','rgba(230,238,250,.9)');
  }else{
    drawCrowd(it.x,zr,n,PAL_RED,run,true);
    pill(String(n),p.x,py,sz,'rgba(170,24,44,.95)','rgba(255,255,255,.8)');
  }
}
function drawCrate(it,zr){
  if(1+zr*K<0.6)return;
  var p=proj(it.x,zr),u=roadHalf*0.3*p.s,bob=reduceMotion?0:Math.sin(time*4+it.z)*u*0.1,y=p.y-u*0.95-bob,pulse=0.5+0.5*Math.sin(time*6+it.z);
  var bm=ctx.createLinearGradient(0,p.y-u*3.2,0,p.y);
  bm.addColorStop(0,'rgba(255,210,63,0)');bm.addColorStop(1,'rgba(255,210,63,.32)');
  ctx.fillStyle=bm;ctx.fillRect(p.x-u*0.55,p.y-u*3.2,u*1.1,u*3.2);
  ctx.strokeStyle='rgba(255,210,63,'+(0.5+pulse*0.4)+')';ctx.lineWidth=Math.max(1,u*0.07);
  ctx.beginPath();ctx.ellipse(p.x,p.y,u*(0.75+pulse*0.12),u*(0.2+pulse*0.03),0,0,TAU);ctx.stroke();
  ctx.fillStyle='#7c8c4b';ctx.beginPath();
  ctx.moveTo(p.x-u*0.62,y-u*0.42);ctx.lineTo(p.x-u*0.44,y-u*0.66);ctx.lineTo(p.x+u*0.8,y-u*0.66);ctx.lineTo(p.x+u*0.62,y-u*0.42);ctx.closePath();ctx.fill();
  ctx.fillStyle='#46522a';ctx.beginPath();
  ctx.moveTo(p.x+u*0.62,y-u*0.42);ctx.lineTo(p.x+u*0.8,y-u*0.66);ctx.lineTo(p.x+u*0.8,y+u*0.2);ctx.lineTo(p.x+u*0.62,y+u*0.44);ctx.closePath();ctx.fill();
  ctx.fillStyle='#5d6b38';ctx.fillRect(p.x-u*0.62,y-u*0.42,u*1.24,u*0.86);
  ctx.fillStyle='#4a562c';ctx.fillRect(p.x-u*0.62,y-u*0.42,u*1.24,u*0.09);ctx.fillRect(p.x-u*0.62,y+u*0.35,u*1.24,u*0.09);
  ctx.fillStyle='#f4f1e4';star(p.x,y-u*0.1,u*0.2);
  ctx.font='400 '+(u*0.24)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(WEAPONS[it.w].tag||WEAPONS[it.w].name,p.x,y+u*0.22);
}
function drawBarrel(it,zr){
  if(1+zr*K<0.6)return;
  var p=proj(it.x,zr),u=roadHalf*0.26*p.s,pr=it.prize,col=pr.k==='troops'?['#2d6cdf','#1c49a0','#5e96f2']:pr.k==='weapon'?['#5d6b38','#3f4a25','#7c8c4b']:['#d9a514','#9a7308','#f3c744'];
  var w=u*0.95,h=u*1.25,x=p.x,y=p.y,sh=it.hitT>0?(rnd()-0.5)*u*0.08:0;
  ctx.fillStyle='rgba(0,0,0,.28)';ell(x+u*0.1,y,w*0.7,u*0.2);
  x+=sh;
  ctx.fillStyle=col[0];ctx.fillRect(x-w/2,y-h,w,h);
  ctx.fillStyle=col[1];ctx.fillRect(x+w*0.2,y-h,w*0.3,h);
  ell(x,y,w/2,u*0.14);
  ctx.fillStyle=col[1];ctx.fillRect(x-w/2,y-h*0.72,w,h*0.07);ctx.fillRect(x-w/2,y-h*0.34,w,h*0.07);
  ctx.fillStyle=col[2];ell(x,y-h,w/2,u*0.14);
  if(it.hitT>0){ctx.fillStyle='rgba(255,255,255,'+(it.hitT*0.6)+')';ctx.fillRect(x-w/2,y-h,w,h);}
  var txt=pr.k==='troops'?'+'+pr.v:pr.k==='weapon'?(WEAPONS[pr.w].tag||WEAPONS[pr.w].name):BR().tag[pr.s];
  ctx.font='400 '+(u*(txt.length>5?0.24:0.36))+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=Math.max(1,u*0.06);ctx.strokeStyle='rgba(8,16,40,.7)';ctx.lineJoin='round';
  ctx.strokeText(txt,x,y-h*0.52);ctx.fillStyle='#fff';ctx.fillText(txt,x,y-h*0.52);
  var bw=u*1.1,by=y-h-u*0.42,fr=Math.max(0,it.n/it.max);
  ctx.fillStyle='rgba(10,14,30,.8)';ctx.fillRect(x-bw/2,by,bw,u*0.14);
  ctx.fillStyle='#ffd23f';ctx.fillRect(x-bw/2,by,bw*fr,u*0.14);
}
function drawMines(it,zr){
  if(1+zr*K<0.6)return;
  var x0=it.side<0?-1:0,x1=it.side<0?0:1,j;
  for(j=0;j<8;j++)quad(x0+j/8,x0+(j+0.5)/8,zr-3,zr+3,'rgba(255,205,40,.55)');
  quad(x0,x1,zr-3.4,zr-3,'#ffcd28');quad(x0,x1,zr+3,zr+3.4,'#ffcd28');
  for(j=0;j<5;j++){
    var m=proj(x0+0.1+j*0.2,zr+(j%2?1.2:-1.2)),r=roadHalf*0.05*m.s;
    ctx.fillStyle='#2a2e36';ell(m.x,m.y,r,r*0.42);
    ctx.fillStyle=(Math.floor(time*4)+j)%2?'#ff3b3b':'#7a1010';ctx.beginPath();ctx.arc(m.x,m.y-r*0.3,r*0.28,0,TAU);ctx.fill();
  }
  var sp=proj(x0+0.5,zr),u=roadHalf*0.2*sp.s,sy=sp.y-u*2.3;
  ctx.fillStyle='#ffcd28';ctx.beginPath();ctx.moveTo(sp.x,sy-u*0.5);ctx.lineTo(sp.x+u*0.5,sy+u*0.36);ctx.lineTo(sp.x-u*0.5,sy+u*0.36);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#1d2126';ctx.lineWidth=Math.max(1,u*0.07);ctx.stroke();
  ctx.fillStyle='#1d2126';ctx.font='400 '+(u*0.55)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',sp.x,sy+u*0.08);
}
function drawFlag(p){
  var top=p.y-roadHalf*1.02,w=roadHalf*0.38,h=w*0.55,cols=10,cw=w/cols,i,c;
  ctx.strokeStyle='#e8e8e8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y-roadHalf*0.1);ctx.lineTo(p.x,top-3);ctx.stroke();
  ctx.fillStyle='#ffd23f';ctx.beginPath();ctx.arc(p.x,top-5,3.5,0,TAU);ctx.fill();
  for(c=0;c<cols;c++){
    var dy=reduceMotion?0:Math.sin(time*6-c*0.7)*h*0.07*(c/cols),x=p.x+1.5+c*cw;
    for(i=0;i<13;i++){ctx.fillStyle=i%2?'#ffffff':'#c8102e';ctx.fillRect(x,top+dy+i*h/13,cw+0.6,h/13+0.6);}
    if(c<4){ctx.fillStyle='#16306b';ctx.fillRect(x,top+dy,cw+0.6,h*7/13);}
    ctx.fillStyle='rgba(0,0,0,'+(0.08+0.08*Math.sin(time*6-c*0.7+1.5))+')';ctx.fillRect(x,top+dy,cw+0.6,h);
  }
  ctx.fillStyle='#ffffff';
  for(i=0;i<12;i++){ctx.beginPath();ctx.arc(p.x+1.5+cw*4*((i%4)+0.5)/4,top+h*7/13*(Math.floor(i/4)+0.5)/3,w*0.014,0,TAU);ctx.fill();}
}
function drawBoss(zr){
  if(zr>400)return;
  var c,i;
  for(c=0;c<8;c++){quad(-1+c*0.25,-0.75+c*0.25,zr-16,zr-14,c%2?'#fff':'#222');quad(-1+c*0.25,-0.75+c*0.25,zr-14,zr-12,c%2?'#222':'#fff');}
  var wz=zr+11,ps=1/(1+wz*K);
  if(ps>0.05){
    for(var r=0;r<3;r++)for(i=0;i<11-r%2;i++){
      var q=proj(-1+(i+0.5+(r%2)*0.5)*2/11,wz),u=roadHalf*q.s;
      ctx.fillStyle=r%2?'#bfae80':'#cdbd8e';ell(q.x,q.y-u*0.06-r*u*0.1,u*0.105,u*0.06);
    }
    for(i=-1;i<=1;i+=2){
      var f=proj(i*0.8,wz),fu=roadHalf*f.s;
      ctx.fillStyle='#d9d9d9';ctx.fillRect(f.x-fu*0.012,f.y-fu*0.95,fu*0.024,fu*0.95);
      ctx.fillStyle='#b3182c';ctx.beginPath();ctx.moveTo(f.x,f.y-fu*0.95);ctx.lineTo(f.x+fu*0.3,f.y-fu*0.86);ctx.lineTo(f.x,f.y-fu*0.75);ctx.closePath();ctx.fill();
    }
  }
  if(boss>0){
    var n=Math.ceil(boss);
    if(bossMission)drawGiant({x:0,n:1,active:state==='battle'},zr+8,'WARLORD');
    drawCrowd(0,zr,n,PAL_RED,state==='battle',true);
    var p=proj(0,zr);
    pill(String(n),p.x,p.y-roadHalf*(bossMission?1.05:0.68)*p.s,Math.max(10,roadHalf*0.17*p.s),'rgba(170,24,44,.95)','rgba(255,255,255,.8)');
  }
}
function drawItem(it,zr){
  if(it.type==='gate')drawGate(it,zr);else if(it.type==='crate')drawCrate(it,zr);
  else if(it.type==='barrel')drawBarrel(it,zr);else if(it.type==='mines')drawMines(it,zr);else drawFoe(it,zr);
}

/* ---------- support visuals ---------- */
function drawSupport(){
  var j;
  if(artyT>0||artyShells>0){
    var pu=0.5+0.5*Math.sin(time*18);
    for(j=-1;j<=1;j++){
      var m=proj(j*0.55,Math.max(4,artyZ-pz+j*14)),r=roadHalf*0.3*m.s;
      ctx.strokeStyle='rgba(255,60,60,'+(0.5+pu*0.4)+')';ctx.lineWidth=Math.max(1,3*m.s);
      ctx.beginPath();ctx.ellipse(m.x,m.y,r,r*0.3,0,0,TAU);ctx.stroke();
      ctx.beginPath();ctx.moveTo(m.x-r*1.2,m.y);ctx.lineTo(m.x+r*1.2,m.y);ctx.stroke();
    }
  }
  if(droneT>0&&count>0){
    for(j=-1;j<=1;j+=2){
      var d=proj(px+j*0.42,9),u=roadHalf*0.11*d.s,dx=d.x,dy=d.y-roadHalf*0.62*d.s+Math.sin(time*5+j)*u*0.3;
      if(droneTg&&rnd()<0.75){
        var tp=proj(droneTg.x,Math.max(0,droneTg.z-pz));
        ctx.strokeStyle='rgba(170,235,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(tp.x,tp.y-roadHalf*0.12*tp.s);ctx.stroke();
      }
      ctx.fillStyle='rgba(0,0,0,.2)';ell(d.x,d.y,u*1.1,u*0.3);
      ctx.strokeStyle='#2a2e36';ctx.lineWidth=Math.max(1,u*0.16);ctx.beginPath();
      ctx.moveTo(dx-u,dy-u*0.25);ctx.lineTo(dx+u,dy+u*0.25);ctx.moveTo(dx-u,dy+u*0.25);ctx.lineTo(dx+u,dy-u*0.25);ctx.stroke();
      ctx.fillStyle='#3b414c';rrect(dx-u*0.4,dy-u*0.22,u*0.8,u*0.44,u*0.12);ctx.fill();
      ctx.fillStyle='rgba(220,230,240,.55)';
      ell(dx-u,dy-u*0.3,u*0.5,u*0.14);ell(dx+u,dy-u*0.3,u*0.5,u*0.14);ell(dx-u,dy+u*0.2,u*0.5,u*0.14);ell(dx+u,dy+u*0.2,u*0.5,u*0.14);
      ctx.fillStyle='#ff4d5e';ctx.beginPath();ctx.arc(dx,dy+u*0.22,u*0.1,0,TAU);ctx.fill();
    }
  }
  if(airAnim>0){
    var t=airAnim,y=H*1.08-t*(H*1.08-horizon*0.85),sc=(1.7-1.5*t)*roadHalf*0.5,x=W/2;
    ctx.fillStyle='rgba(0,0,0,.22)';ell(x+sc*0.3,Math.min(H,y+sc*1.4),sc*1.5,sc*0.5);
    if(BR().air==='helo'){
      ctx.fillStyle='#4a515c';ctx.fillRect(x-sc*0.07,y+sc*0.2,sc*0.14,sc*1.1);
      ctx.fillRect(x-sc*0.28,y+sc*1.18,sc*0.56,sc*0.1);
      ctx.fillStyle='#e8742c';ell(x,y,sc*0.32,sc*0.62);
      ctx.fillStyle='#f4f4f2';ctx.fillRect(x-sc*0.32,y+sc*0.05,sc*0.64,sc*0.12);
      ctx.fillStyle='#2e3440';ell(x,y-sc*0.32,sc*0.18,sc*0.2);
      ctx.fillStyle='rgba(220,226,234,.22)';ell(x,y,sc*1.45,sc*1.45);
      var ra=time*40;ctx.strokeStyle='rgba(40,44,52,.75)';ctx.lineWidth=Math.max(1,sc*0.07);ctx.beginPath();
      ctx.moveTo(x-Math.cos(ra)*sc*1.4,y-Math.sin(ra)*sc*1.4);ctx.lineTo(x+Math.cos(ra)*sc*1.4,y+Math.sin(ra)*sc*1.4);
      ctx.moveTo(x+Math.sin(ra)*sc*1.4,y-Math.cos(ra)*sc*1.4);ctx.lineTo(x-Math.sin(ra)*sc*1.4,y+Math.cos(ra)*sc*1.4);ctx.stroke();
      return;
    }
    ctx.fillStyle='#646c78';ctx.beginPath();
    ctx.moveTo(x,y-sc*1.3);ctx.lineTo(x+sc*0.16,y-sc*0.5);ctx.lineTo(x+sc*1.5,y+sc*0.05);ctx.lineTo(x+sc*1.5,y+sc*0.3);ctx.lineTo(x+sc*0.18,y+sc*0.25);
    ctx.lineTo(x+sc*0.14,y+sc*0.9);ctx.lineTo(x+sc*0.55,y+sc*1.15);ctx.lineTo(x+sc*0.55,y+sc*1.3);ctx.lineTo(x,y+sc*1.2);
    ctx.lineTo(x-sc*0.55,y+sc*1.3);ctx.lineTo(x-sc*0.55,y+sc*1.15);ctx.lineTo(x-sc*0.14,y+sc*0.9);ctx.lineTo(x-sc*0.18,y+sc*0.25);
    ctx.lineTo(x-sc*1.5,y+sc*0.3);ctx.lineTo(x-sc*1.5,y+sc*0.05);ctx.lineTo(x-sc*0.16,y-sc*0.5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2e3440';ell(x,y-sc*0.55,sc*0.09,sc*0.28);
    ctx.fillStyle='#4a515c';ell(x-sc*0.38,y+sc*0.75,sc*0.14,sc*0.3);ell(x+sc*0.38,y+sc*0.75,sc*0.14,sc*0.3);
  }
}

/* ---------- overlays drawn on the canvas ---------- */
function drawProgress(){
  var x0=16,x1=W-16,y=58,w=x1-x0,fr=Math.max(0,Math.min(1,pz/Math.max(1,bossZ-12))),i;
  ctx.fillStyle='rgba(20,36,79,.6)';rrect(x0,y,w,7,3.5);ctx.fill();
  ctx.fillStyle='#ffd23f';rrect(x0,y,Math.max(7,w*fr),7,3.5);ctx.fill();
  for(i=0;i<items.length;i++){
    var it=items[i];
    if(it.type==='foe'&&it.big&&!it.done){ctx.fillStyle='#ff4d5e';ctx.beginPath();ctx.arc(x0+w*Math.min(1,it.z/(bossZ-12)),y+3.5,5,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
  }
  ctx.fillStyle='#c8102e';ctx.fillRect(x1-2,y-9,2,16);ctx.beginPath();ctx.moveTo(x1-2,y-9);ctx.lineTo(x1-12,y-5);ctx.lineTo(x1-2,y-1);ctx.closePath();ctx.fill();
}
function drawHint(){
  if(hintT<=0||!hintMsg)return;
  var a=Math.min(1,hintT*3,(hintDur-hintT)*5+0.2),maxW=Math.min(W-48,340),words=hintMsg.split(' '),lines=[''],i;
  ctx.font='800 16px Nunito,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(i=0;i<words.length;i++){
    var t=lines[lines.length-1]+(lines[lines.length-1]?' ':'')+words[i];
    if(ctx.measureText(t).width>maxW-28&&lines[lines.length-1])lines.push(words[i]);else lines[lines.length-1]=t;
  }
  var h=lines.length*21+16,y=80;
  ctx.globalAlpha=Math.max(0,Math.min(1,a));
  ctx.fillStyle='rgba(20,36,79,.92)';rrect(W/2-maxW/2,y,maxW,h,12);ctx.fill();
  ctx.strokeStyle='rgba(255,210,63,.9)';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fff';
  for(i=0;i<lines.length;i++)ctx.fillText(lines[i],W/2,y+8+10.5+i*21);
  ctx.globalAlpha=1;
}
function drawHand(){
  if(save.hints.drag||state!=='run')return;
  var y=baseY+(H-baseY)*0.34,x=W/2+Math.sin(time*2.6)*roadHalf*0.55;
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=3;ctx.setLineDash([6,7]);
  ctx.beginPath();ctx.moveTo(W/2-roadHalf*0.6,y);ctx.lineTo(W/2+roadHalf*0.6,y);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.arc(x,y,15,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(20,36,79,.9)';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='rgba(20,36,79,.9)';ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();
}

function draw2D(){
  /* the original 2D world: used when the 3D renderer is unavailable */
  drawWorld();
  var vis=items.filter(function(it){return it.z-pz<400&&!((it.type==='foe'||it.type==='barrel'||it.type==='crate')&&it.done&&(it.hit||it.type!=='foe'));});
  vis.sort(function(a,b){return b.z-a.z;});
  var i,bossDrawn=false;
  for(i=0;i<vis.length;i++){
    var it=vis[i],zr=it.z-pz;
    if(!bossDrawn&&bossZ>it.z){drawBoss(bossZ-pz);bossDrawn=true;}
    if(zr<0)continue;
    drawItem(it,zr);
  }
  if(!bossDrawn)drawBoss(bossZ-pz);
  for(i=0;i<bullets.length;i++){
    var bl=bullets[i],za=bl.z-pz,bp=proj(bl.x,za),tp=proj(bl.x-bl.vx*0.05,Math.max(0,za-bl.tail));
    var lift=roadHalf*0.09,br=Math.max(1,roadHalf*bl.r*bp.s);
    ctx.lineCap='round';
    ctx.strokeStyle=bl.rocket?'rgba(230,230,230,.5)':'rgba(255,200,80,.35)';ctx.lineWidth=br*(bl.rocket?2.2:3.2);
    ctx.beginPath();ctx.moveTo(tp.x,tp.y-lift*tp.s);ctx.lineTo(bp.x,bp.y-lift*bp.s);ctx.stroke();
    ctx.strokeStyle=bl.col;ctx.lineWidth=br*1.3;
    ctx.beginPath();ctx.moveTo(tp.x,tp.y-lift*tp.s);ctx.lineTo(bp.x,bp.y-lift*bp.s);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bp.x,bp.y-lift*bp.s,br*0.8,0,TAU);ctx.fill();
    ctx.lineCap='butt';
  }
  if(count>0){
    var p=proj(px,0);
    drawFlag(p);
    drawCrowd(px,0,count,PAL_US,state==='run'||state==='battle'||state==='win',false);
    pill(String(count),p.x-roadHalf*0.02,p.y-roadHalf*0.62,roadHalf*0.17*(1+0.35*pop),pop>0.05&&popBad?'rgba(170,24,44,.95)':'rgba(22,48,107,.95)','rgba(255,255,255,.85)');
  }
  for(i=0;i<vis.length;i++){
    var v=vis[i],zz=v.z-pz;
    if(zz>=0||zz<-9||v.type==='gate')continue;
    drawItem(v,zz);
  }
  drawSupport();
}
function draw(){
  var i;
  if(window.R3&&R3.ok){
    /* 3D mode: the WebGL canvas underneath holds the world; this canvas only carries labels, sparks and HUD */
    ctx.clearRect(0,0,W,H);R3.render();
    ctx.save();R3.labels();
  }else{
    ctx.save();if(shake>0&&!reduceMotion)ctx.translate((rnd()-0.5)*shake*14,(rnd()-0.5)*shake*14);
    draw2D();
  }
  for(i=0;i<parts.length;i++){
    var q=parts[i],al=Math.max(0,q.life/q.max);
    ctx.globalAlpha=al;
    if(q.ring){ctx.strokeStyle=q.col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(1+(1-al)*3),0,TAU);ctx.stroke();}
    else{ctx.fillStyle=q.col;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(0.5+al*0.5),0,TAU);ctx.fill();}
  }
  ctx.globalAlpha=1;
  for(i=0;i<popups.length;i++){
    var pp=popups[i],a2=Math.max(0,1-pp.t/0.9),sz=roadHalf*(pp.big?0.26:0.17)*(1+Math.max(0,0.15-pp.t)*3);
    ctx.globalAlpha=a2;
    ctx.font='400 '+sz+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';
    var tw=ctx.measureText(pp.text).width;if(tw>W-32){sz*=(W-32)/tw;ctx.font='400 '+sz+'px '+FONT;}
    ctx.lineWidth=6;ctx.lineJoin='round';ctx.strokeStyle='rgba(8,16,40,.7)';
    ctx.strokeText(pp.text,pp.x,pp.y-pp.t*70);ctx.fillStyle=pp.color;ctx.fillText(pp.text,pp.x,pp.y-pp.t*70);
    ctx.globalAlpha=1;
  }
  ctx.restore();
  if(flash>0){ctx.fillStyle='rgba(220,30,50,'+(flash*0.28)+')';ctx.fillRect(0,0,W,H);}
  if(state==='run'||state==='battle'||state==='pause'){
    drawProgress();
    pill(WEAPONS[weapon].name+' · '+WEAPONS[weapon].cal,W/2,H-76,14,'rgba(20,36,79,.85)','rgba(255,210,63,.8)');
    drawHint();drawHand();
  }
}
