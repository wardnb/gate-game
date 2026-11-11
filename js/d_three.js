/* Gate Rush 3D renderer (Three.js).
   Loaded as a module after the game scripts. It only reads game state (pz, px, items, bullets...) and draws it;
   rules never depend on it. If it fails to load (offline, no WebGL) the game keeps its 2D renderer.
   Units: 1 half-road (game x) = RH metres, 1 game z unit = ZS metres, world -Z is "forward". */
import * as THREE from 'three';

const RH = 4, ZS = 0.5, TAU2 = Math.PI * 2, TS = 1.55, SPREAD = 1.35;
const glc = document.getElementById('gl');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }

const S3 = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(60, 1, 0.5, 900);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), dummy = new THREE.Object3D();
let camRef = 12, envKey = '', env = null, lowQ = false, fontGen = 0;
const G = window;

/* ---------- small builders ---------- */
const matCache = {};
function mat(c, o) {
  const k = c + (o ? JSON.stringify(o) : '');
  if (!matCache[k]) matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  return matCache[k];
}
function M(x, y, z, rx, ry, rz, sx, sy, sz) {
  dummy.position.set(x || 0, y || 0, z || 0); dummy.rotation.set(rx || 0, ry || 0, rz || 0);
  dummy.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); dummy.updateMatrix(); return dummy.matrix.clone();
}
function mesh(geo, c, x, y, z, rx, ry, rz, sx, sy, sz, o) {
  const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c, o) : c);
  m.applyMatrix4(M(x, y, z, rx, ry, rz, sx, sy, sz)); m.castShadow = true; m.receiveShadow = true; return m;
}
function part(geo, color, mx) {
  geo = geo.index ? geo.toNonIndexed() : geo; if (mx) geo.applyMatrix4(mx);
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
function merge(list) {
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
function canvasTex(w, h, fn, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function hs(k, a) { const v = Math.sin(k * 127.1 + a * 311.7) * 43758.5453; return v - Math.floor(v); }
function wz(z) { return -z * ZS; }

/* ---------- soldiers: one instanced torso + one instanced leg mesh per uniform ---------- */
const TMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function soldierGeo(pal) {
  const sk = '#e6c09a', boot = '#22252a', gun = '#2b3038';
  const torso = merge([
    part(new THREE.BoxGeometry(.30, .30, .19), pal.body, M(0, .41, 0)),
    part(new THREE.BoxGeometry(.33, .19, .22), pal.gear, M(0, .45, 0)),
    part(new THREE.BoxGeometry(.31, .05, .2), pal.dark, M(0, .285, 0)),
    part(new THREE.BoxGeometry(.22, .25, .11), pal.dark, M(0, .45, .15)),
    part(new THREE.BoxGeometry(.085, .24, .09), pal.body, M(-.19, .44, -.06, .8)),
    part(new THREE.BoxGeometry(.085, .24, .09), pal.body, M(.19, .44, -.08, 1.05)),
    part(new THREE.BoxGeometry(.05, .065, .46), gun, M(.07, .47, -.24)),
    part(new THREE.BoxGeometry(.035, .08, .05), gun, M(.07, .41, -.17)),
    part(new THREE.SphereGeometry(.1, 10, 7), sk, M(0, .655, 0)),
    part(new THREE.BoxGeometry(.03, .022, .01), '#1b1b1f', M(-.035, .665, -.097)),
    part(new THREE.BoxGeometry(.03, .022, .01), '#1b1b1f', M(.035, .665, -.097)),
    part(new THREE.SphereGeometry(.128, 12, 6, 0, TAU2, 0, Math.PI / 2), pal.helmet, M(0, .67, 0)),
    part(new THREE.CylinderGeometry(.142, .142, .03, 12), pal.helmet, M(0, .672, 0))
  ]);
  const leg = merge([
    part(new THREE.BoxGeometry(.11, .26, .13), pal.dark, M(0, -.13, 0)),
    part(new THREE.BoxGeometry(.12, .06, .18), boot, M(0, -.245, -.025))
  ]);
  return { torso, leg };
}
class Troop {
  constructor(pal, cap) {
    const g = soldierGeo(pal); this.cap = cap;
    this.t = new THREE.InstancedMesh(g.torso, TMAT, cap); this.l = new THREE.InstancedMesh(g.leg, TMAT, cap * 2);
    for (const m of [this.t, this.l]) { m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.count = 0; S3.add(m); }
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, z, face, ph, run, sc) {
    if (this.n >= this.cap) return;
    const i = this.n++, yaw = face ? Math.PI : 0, sw = run ? Math.sin(ph) * 0.75 : 0, bob = run ? Math.abs(Math.cos(ph)) * 0.04 * sc : 0;
    dummy.position.set(x, bob, z); dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(sc); dummy.updateMatrix(); this.t.setMatrixAt(i, dummy.matrix);
    const cy = face ? -1 : 1;
    for (let s = 0; s < 2; s++) {
      const sd = s ? 1 : -1;
      dummy.position.set(x + sd * .075 * sc * cy, .27 * sc + bob, z); dummy.rotation.set(sd * sw, yaw, 0, 'YXZ'); dummy.updateMatrix();
      this.l.setMatrixAt(i * 2 + s, dummy.matrix);
    }
  }
  end() { this.t.count = this.n; this.l.count = this.n * 2; this.t.instanceMatrix.needsUpdate = true; this.l.instanceMatrix.needsUpdate = true; }
}
const troops = {};
function troop(pal, cap) { const k = pal.body + pal.helmet; return troops[k] || (troops[k] = new Troop(pal, cap || 520)); }
function crowd(tr, cx, zAbs, n, run, face, speed, sc) {
  const m = Math.min(n, G.DRAWMAX), z0 = wz(zAbs), sp = speed || 11, s = (sc || 1) * TS;
  for (let j = 0; j < m; j++) {
    const o = G.OFFS[j];
    tr.add(cx * RH + o.x * RH * SPREAD * s / TS, z0 - (o.z / 14) * RH * SPREAD * s / TS, face, G.time * sp + o.i * 1.7, run, s);
  }
}

/* ---------- shared textures ---------- */
const TX = {};
function flagTex() {
  return canvasTex(256, 140, (c, w, h) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#c8102e'; c.fillRect(0, i * h / 13, w, h / 13 + 1); }
    c.fillStyle = '#16306b'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); c.fillStyle = '#fff';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(8 + k * 16 + (r % 2) * 8, 8 + r * 14, 2.6, 0, TAU2); c.fill(); }
  });
}
function noiseTex(base, dots, rep) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const d = dots[i % dots.length]; c.fillStyle = d; c.globalAlpha = 0.18 + hs(i, 3) * 0.3;
      const r = 1 + hs(i, 4) * 3; c.fillRect(hs(i, 1) * w, hs(i, 2) * h, r, r * (0.6 + hs(i, 5)));
    }
    c.globalAlpha = 1;
  }, rep);
}
function roadTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#4a4f5c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { c.fillStyle = hs(i, 7) < 0.5 ? '#3c414d' : '#5a606d'; c.globalAlpha = 0.5; c.fillRect(hs(i, 1) * w, hs(i, 2) * h, 2, 2); }
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(10, 0, 5, h); c.fillRect(w - 15, 0, 5, h);
    c.fillStyle = '#ffd25a'; c.fillRect(w / 2 - 3, 0, 6, h * 0.5);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(w * 0.27, 0, 18, h); c.fillRect(w * 0.66, 0, 18, h);
  }, [1, 1]);
}
function curbTex(a, b) {
  return canvasTex(8, 64, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h / 2); c.fillStyle = b; c.fillRect(0, h / 2, w, h / 2); }, [1, 1]);
}
function glowTex() {
  return canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}
function blobTex() {
  return canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
}

/* ---------- sky ---------- */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunC: { value: new THREE.Color() }, sunD: { value: new THREE.Vector3(0.4, 0.15, -1).normalize() }, sunR: { value: 1 } },
  vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 top,mid,bot,sunC,sunD;uniform float sunR;varying vec3 vD;
    void main(){float h=vD.y;vec3 c=mix(bot,mid,smoothstep(0.,.18,h));c=mix(c,top,smoothstep(.18,.75,h));if(h<0.)c=bot;
    float d=max(dot(normalize(vD),sunD),0.);c+=sunC*(smoothstep(1.-.0009*sunR,1.-.0006*sunR,d)*1.2+pow(d,24.)*.35+pow(d,4.)*.08);
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat); sky.renderOrder = -10; S3.add(sky);
const starGeo = new THREE.BufferGeometry(); {
  const a = []; for (let i = 0; i < 500; i++) { const t = hs(i, 1) * TAU2, p = 0.05 + hs(i, 2) * 1.4; a.push(Math.cos(t) * Math.cos(p) * 560, Math.sin(p) * 560, Math.sin(t) * Math.cos(p) * 560); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
S3.add(stars);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0x888866, 1); S3.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 30, bottom: -14, near: 1, far: 140 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; S3.add(sun); S3.add(sun.target);
const LIGHT = [
  { hemi: [1.05], sun: ['#fff1d6', 2.4], dir: [-0.45, 1, 0.55], exp: 1.05 },
  { hemi: [0.8], sun: ['#ffb070', 1.9], dir: [-0.8, 0.45, 0.4], exp: 1.05 },
  { hemi: [0.5], sun: ['#a8bcff', 0.85], dir: [-0.4, 1, 0.3], exp: 1.15 }
];

/* ---------- water ---------- */
function waterMat(deep, shallow) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uShal: { value: new THREE.Color(shallow) } }]),
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW;void main(){vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT;uniform vec3 uDeep,uShal;varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      void main(){vec2 p=vW.xz;
        float w=sin(p.x*.55+uT*1.1)*.5+sin(p.y*.42-uT*.9+p.x*.2)*.5+sin((p.x+p.y)*1.6+uT*1.8)*.22+sin((p.x*.7-p.y*1.3)*2.3-uT*2.4)*.12;
        vec3 c=mix(uDeep,uShal,.5+.3*w);
        float g=smoothstep(.86,1.,sin(p.x*2.3+uT*1.7+sin(p.y*.8))*sin(p.y*1.9-uT*1.3));
        c+=vec3(1.)*g*.45;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
}

/* ---------- props: built from primitives, one prefab per name ---------- */
const g = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 12), pyr: new THREE.ConeGeometry(1, 1, 4), sph: new THREE.SphereGeometry(1, 12, 8),
  ico: new THREE.IcosahedronGeometry(1, 0), dode: new THREE.DodecahedronGeometry(1, 0), hemi: new THREE.SphereGeometry(1, 16, 8, 0, TAU2, 0, Math.PI / 2),
  arch: new THREE.CylinderGeometry(1, 1, 1, 18, 1, false, 0, Math.PI)
};
function grp(list) { const o = new THREE.Group(); list.forEach(m => o.add(m)); return o; }
function emis(c, i) { return new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: i || 1 }); }
const PREFAB = {
  rock: { off: 0, make: () => grp([mesh(g.dode, '#9a835f', 0, .35, 0, .3, .5, 0, 1.1, .6, .9, { flatShading: true }), mesh(g.dode, '#8a7454', .9, .2, .3, 0, 1, 0, .55, .4, .5, { flatShading: true })]) },
  bush: { off: 0, make: () => grp([mesh(g.ico, '#5f7340', 0, .45, 0, 0, 0, 0, .7, .55, .7, { flatShading: true }), mesh(g.ico, '#74894d', .5, .35, .2, 0, 1, 0, .5, .45, .5, { flatShading: true }), mesh(g.ico, '#56693a', -.5, .3, -.1, 0, 2, 0, .45, .38, .45, { flatShading: true })]) },
  bags: { off: 0, make: () => { const a = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) a.push(mesh(g.sph, r % 2 ? '#bfae80' : '#cdbd8e', (c - (3 - r) / 2) * .62, .2 + r * .32, 0, 0, 0, 0, .34, .17, .24)); return grp(a); } },
  tent: { off: .5, make: () => grp([mesh(g.pyr, '#5d6b38', 0, .9, 0, 0, Math.PI / 4, 0, 1.9, 1.8, 1.6, { flatShading: true }), mesh(g.box, '#2f381c', 0, .45, 1.15, 0, 0, 0, .55, .9, .05)]) },
  cactus: { off: 0, make: () => grp([mesh(g.cyl, '#5b6e3c', 0, 1, 0, 0, 0, 0, .16, 2, .16), mesh(g.cyl, '#5b6e3c', -.32, 1.1, 0, 0, 0, 0, .11, .7, .11), mesh(g.box, '#5b6e3c', -.18, .8, 0, 0, 0, 0, .3, .14, .14), mesh(g.cyl, '#5b6e3c', .3, 1.35, 0, 0, 0, 0, .1, .6, .1), mesh(g.box, '#5b6e3c', .16, 1.08, 0, 0, 0, 0, .28, .13, .13)]) },
  palm: {
    off: .6, make: () => {
      const a = [], tilt = .18;
      for (let i = 0; i < 6; i++) a.push(mesh(g.cyl6, i % 2 ? '#8a6a42' : '#7a5a36', Math.sin(i * tilt) * 0.9, .45 + i * .8, 0, 0, 0, -tilt * i * 0.6, .17 - i * .012, .82, .17 - i * .012));
      const tx = Math.sin(5 * tilt) * 0.9 + .1, ty = 4.9;
      for (let k = 0; k < 7; k++) { const an = k / 7 * TAU2; a.push(mesh(g.box, k % 2 ? '#3f7a30' : '#4f8f3a', tx + Math.cos(an) * 1.1, ty - .35, Math.sin(an) * 1.1, 0, -an, -.45, 2.3, .06, .45)); }
      a.push(mesh(g.sph, '#5a4126', tx, ty - .2, 0, 0, 0, 0, .25)); return grp(a);
    }
  },
  craft: { off: .6, make: () => grp([mesh(g.box, '#6b7350', 0, .75, 0, 0, 0, 0, 2.6, 1.1, 4.6), mesh(g.box, '#5d6446', 0, 1.15, -2.6, -.5, 0, 0, 2.5, .3, 1.2), mesh(g.box, '#545b3e', .4, 1.6, .4, 0, 0, 0, .9, .45, 1), mesh(g.cyl, '#2b2f2a', .4, 1.7, -.5, Math.PI / 2, 0, 0, .06, 1, .06), mesh(g.box, '#2b2f2a', 0, .25, 0, 0, 0, 0, 2.7, .5, 4.2)]) },
  buoyR: { off: 1, bob: 1, make: () => buoy('#d23a3a') },
  buoyG: { off: 1, bob: 1, make: () => buoy('#2f8f4a') },
  boat: { off: 3, bob: .5, make: () => boat('#8a929e', null) },
  cutter: { off: 4, bob: .5, make: () => boat('#f4f4f2', '#e8742c') },
  cap: { off: .5, make: () => grp([mesh(g.sph, '#f4f8fb', 0, 0, 0, 0, 0, 0, .9, .06, .25), mesh(g.sph, '#f4f8fb', .9, 0, .5, 0, .4, 0, .6, .05, .2)]) },
  ice: { off: 1, bob: .3, make: () => grp([mesh(g.cyl6, '#eef6fb', 0, .1, 0, 0, .3, 0, 1.8, .45, 1.4, { flatShading: true }), mesh(g.cyl6, '#dcecf5', .6, .35, .2, 0, 1, 0, .8, .4, .7, { flatShading: true })]) },
  light: {
    off: 7, make: () => {
      const a = [mesh(g.dode, '#6d6a64', 0, .3, 0, 0, 0, 0, 2.4, .8, 2.2, { flatShading: true })];
      const tower = new THREE.CylinderGeometry(.75, 1.15, 7, 16);
      a.push(mesh(tower, '#f4f2ec', 0, 4.2, 0)); a.push(mesh(new THREE.CylinderGeometry(.97, 1.05, 1, 16), '#c8102e', 0, 2.2, 0)); a.push(mesh(new THREE.CylinderGeometry(.83, .9, 1, 16), '#c8102e', 0, 5, 0));
      a.push(mesh(g.cyl, '#2b2f36', 0, 7.9, 0, 0, 0, 0, .75, .3, .75)); a.push(mesh(g.cyl, emis('#ffe27a', 1.4), 0, 8.4, 0, 0, 0, 0, .6, .7, .6));
      a.push(mesh(g.cone, '#c8102e', 0, 9.15, 0, 0, 0, 0, .8, .8, .8)); return grp(a);
    }
  },
  hangar: { off: 12, make: () => grp([mesh(g.arch, '#8a929c', 0, 0, 0, 0, 0, Math.PI / 2, 4.5, 11, 4.5), mesh(g.box, '#2b3038', 4, 1.6, 0, 0, 0, 0, .1, 3.2, 5.2), mesh(g.box, '#6c747e', 0, .05, 0, 0, 0, 0, 9.4, .1, 11.4)]).rotateY(Math.PI / 2) },
  tower: { off: 14, make: () => grp([mesh(g.cyl, '#cfcac0', 0, 4, 0, 0, 0, 0, .6, 8, .6), mesh(g.box, '#b8b2a6', 0, .8, 0, 0, 0, 0, 3, 1.6, 3), mesh(new THREE.CylinderGeometry(1.7, 1.25, 1.6, 8), new THREE.MeshLambertMaterial({ color: '#3a5a78', emissive: '#203040' }), 0, 8.8, 0), mesh(new THREE.CylinderGeometry(1.9, 1.9, .25, 8), '#8a929c', 0, 9.7, 0), mesh(g.sph, emis('#ff4d4d', 2), 0, 10, 0, 0, 0, 0, .14)]) },
  sock: { off: 2, make: () => grp([mesh(g.cyl, '#c9ccd2', 0, 2, 0, 0, 0, 0, .05, 4, .05), mesh(new THREE.ConeGeometry(.35, 1.6, 10, 1, true), '#ff7a1a', .8, 3.8, 0, 0, 0, Math.PI / 2 + .25, 1, 1, 1, { side: THREE.DoubleSide })]) },
  lights: { off: 0, make: () => { const a = []; for (let i = -1; i <= 1; i++) { a.push(mesh(g.cyl, '#55606e', 0, .2, i * 1.5, 0, 0, 0, .05, .4, .05)); a.push(mesh(g.sph, emis(i ? '#6fb2ff' : '#ffffff', 2), 0, .45, i * 1.5, 0, 0, 0, .1)); } return grp(a); } },
  dish: { off: 3, make: () => { const d = grp([mesh(g.hemi, '#f0f1f3', 0, 0, 0, Math.PI, 0, 0, 1.8, .55, 1.8, { side: THREE.DoubleSide }), mesh(g.cyl, '#6c717a', 0, .8, 0, 0, 0, 0, .04, 1.6, .04)]); d.position.set(0, 3, 0); d.rotation.set(-.7, 0, 0); return grp([mesh(g.cyl, '#8a8f99', 0, 1.4, 0, 0, 0, 0, .25, 2.8, .25), mesh(g.box, '#8a8f99', 0, .2, 0, 0, 0, 0, 1.6, .4, 1.6), d]); } },
  rocket: {
    off: 22, make: () => {
      const a = [mesh(g.cyl, '#f4f4f2', 0, 9, 0, 0, 0, 0, .9, 16, .9), mesh(g.cyl, '#d9dadf', 0, 3, 0, 0, 0, 0, .95, 1.2, .95), mesh(g.cone, '#2b2f36', 0, 18.2, 0, 0, 0, 0, .9, 2.4, .9), mesh(g.box, '#7d7f86', 1.5, .4, 0, 0, 0, 0, 7, .8, 5)];
      for (let i = 0; i < 4; i++) a.push(mesh(g.box, '#2b2f36', Math.cos(i * Math.PI / 2) * 1.1, 1.6, Math.sin(i * Math.PI / 2) * 1.1, 0, -i * Math.PI / 2, 0, .9, 2.2, .1));
      a.push(mesh(g.box, '#b5523a', 3.2, 8.5, 0, 0, 0, 0, 1.4, 17, 1.4)); for (let i = 0; i < 4; i++) a.push(mesh(g.box, '#b5523a', 2, 4 + i * 4, 0, 0, 0, 0, 2.2, .3, .3));
      return grp(a);
    }
  },
  mast: { off: 6, make: () => { const a = []; for (let i = 0; i < 3; i++) { const an = i * TAU2 / 3; a.push(mesh(g.cyl, '#9aa0aa', Math.cos(an) * .45, 6, Math.sin(an) * .45, 0, 0, 0, .05, 12, .05)); } for (let i = 1; i < 12; i++) a.push(mesh(g.cyl6, '#9aa0aa', 0, i, 0, 0, 0, 0, .5, .04, .5)); a.push(mesh(g.sph, emis('#ff4d4d', 2), 0, 12.2, 0, 0, 0, 0, .18)); return grp(a); } }
};
function buoy(c) { return grp([mesh(g.cyl, '#2b2f36', 0, .1, 0, 0, 0, 0, .7, .4, .7), mesh(g.cone, c, 0, 1.2, 0, 0, 0, 0, .55, 1.8, .55), mesh(g.sph, emis('#fff6a0', 1.5), 0, 2.25, 0, 0, 0, 0, .14)]); }
function boat(hull, stripe) {
  const a = [mesh(g.box, hull, 0, .55, 0, 0, 0, 0, 2.2, 1.1, 7), mesh(g.pyr, hull, 0, .55, -4.3, Math.PI / 2, Math.PI / 4, 0, 1.55, 1.6, .8), mesh(g.box, hull, 0, 1.6, .9, 0, 0, 0, 1.7, 1.2, 2.6), mesh(g.box, '#2b3038', 0, 1.85, -.42, 0, 0, 0, 1.5, .35, .05), mesh(g.cyl, '#555c66', 0, 3, .9, 0, 0, 0, .06, 2, .06)];
  if (stripe) { a.push(mesh(g.box, stripe, 1.12, .7, -1.4, 0, 0, -.0, .03, 1, .5)); a.push(mesh(g.box, stripe, -1.12, .7, -1.4, 0, 0, 0, .03, 1, .5)); }
  return grp(a).rotateY(Math.PI / 2);
}

/* ---------- environment for a branch + time of day ---------- */
function buildEnv(th, land) {
  if (env) { S3.remove(env.root); env.root.traverse(o => { if (o.material && o.material.map && o.userData.own) o.material.map.dispose(); }); }
  const root = new THREE.Group(), sc = G.scene(th, land), L = LIGHT[G.theme] || LIGHT[0];
  const hz = new THREE.Color('rgb(' + th.haze + ')');
  skyMat.uniforms.top.value.set(th.sky[0]); skyMat.uniforms.mid.value.set(th.sky[1]); skyMat.uniforms.bot.value.copy(hz).lerp(new THREE.Color(th.sky[2]), 0.5);
  skyMat.uniforms.sunC.value.set('rgb(' + th.sun + ')'); skyMat.uniforms.sunR.value = th.sunR * 6;
  skyMat.uniforms.sunD.value.set(0.38, Math.max(0.04, th.sunY * 1.4), -1).normalize();
  stars.visible = !!th.stars;
  S3.fog = new THREE.Fog(hz.clone().lerp(new THREE.Color(th.sky[2]), 0.3), 70, 330);
  hemi.color.set(th.sky[1]).lerp(new THREE.Color('#ffffff'), 0.5); hemi.groundColor.set(sc.ground[1]); hemi.intensity = L.hemi[0];
  sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; renderer.toneMappingExposure = L.exp;
  const e = { root, land, scroll: [], water: null, props: new Map(), mtn: [] };
  /* ground or sea */
  if (land.water) {
    const wm = waterMat(sc.ground[2], sc.ground[0]); const w = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), wm);
    w.rotation.x = -Math.PI / 2; w.position.y = -0.9; root.add(w); e.water = w;
  } else {
    const tx = noiseTex(sc.ground[1], [sc.ground[0], sc.ground[2], '#ffffff', '#000000'], [70, 70]);
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: tx }));
    gm.userData.own = 1; gm.rotation.x = -Math.PI / 2; gm.position.y = -0.02; gm.receiveShadow = true; root.add(gm); e.scroll.push([gm, 20]);
    if (sc.sea) {
      const wm = waterMat('#2a6f95', sc.sea); const w = new THREE.Mesh(new THREE.PlaneGeometry(1400, 400), wm);
      w.rotation.x = -Math.PI / 2; w.position.set(0, 0.0, -420); root.add(w); e.sea = w;
    }
  }
  /* road: a long slab that follows the camera in steps of one dash so its texture stays put */
  const rt = roadTex(); rt.repeat.set(1, 600 / 10);
  const roadMats = [mat('#3f4450'), mat('#3f4450'), new THREE.MeshLambertMaterial({ map: rt }), mat('#3f4450'), mat('#3f4450'), mat('#3f4450')];
  const deck = land.water ? 1.2 : 0.12;
  const road = new THREE.Mesh(new THREE.BoxGeometry(RH * 2, deck, 600), roadMats); road.position.y = -deck / 2; road.receiveShadow = true; root.add(road); e.scroll.push([road, 10]);
  if (land.water) { const sideM = mat('#8d939c'); const pier = new THREE.Mesh(new THREE.BoxGeometry(RH * 2 + 1.2, 0.6, 600), sideM); pier.position.y = -0.95; root.add(pier); e.scroll.push([pier, 10]); }
  const ct = curbTex(land.curb[0], land.curb[1]); ct.repeat.set(1, 600 / 10);
  for (const s of [-1, 1]) {
    const cm = new THREE.MeshLambertMaterial({ map: ct }); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 600), cm);
    cb.position.set(s * (RH + 0.25), 0.11 - (land.water ? 0 : 0.0), 0); cb.receiveShadow = true; cb.castShadow = true; root.add(cb); e.scroll.push([cb, 10]);
  }
  /* distant ridges */
  const ridge = (dist, amp, col, seed, base) => {
    const pts = [], n = 90; const c = new THREE.Color(col).lerp(S3.fog.color, 0.35);
    for (let i = 0; i <= n; i++) { const x = -900 + i * 1800 / n, h = base + (hs(Math.floor(i), seed) * 0.7 + hs(Math.floor(i / 3), seed + 5) * 0.6) * amp; pts.push(x, -2, 0, x, h, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const idx = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, fog: false, side: THREE.DoubleSide })); m.userData.dist = dist; root.add(m); e.mtn.push(m);
  };
  if (sc.far) ridge(520, 70 * sc.far[1], sc.far[0], 3, 6 * sc.far[1]);
  if (sc.near) ridge(470, 32 * sc.near[1], sc.near[0], 7, 2);
  /* scatter: tufts on land, small whitecaps on water */
  const scN = 220;
  const scGeo = land.water ? new THREE.SphereGeometry(1, 6, 3) : new THREE.ConeGeometry(.22, .5, 5);
  const scCol = land.water ? '#f4f8fb' : new THREE.Color(sc.ground[2]).lerp(new THREE.Color('#4f6b2c'), 0.45).getStyle();
  const scat = new THREE.InstancedMesh(scGeo, mat(scCol, { flatShading: true }), scN); scat.frustumCulled = false; root.add(scat); e.scat = scat;
  S3.add(root); env = e;
}
function propAt(k) {
  const land = env.land, names = land.props, name = names[Math.floor(hs(k, 2) * names.length)], pf = PREFAB[name];
  if (!pf.cache) pf.cache = pf.make();
  const o = pf.cache.clone(), side = (k % 2 === 0) ? 1 : -1;
  o.position.set(side * (RH * 1.5 + hs(k, 1) * RH * 1.3 + pf.off), land.water && !pf.bob && name !== 'cap' ? -0.9 : 0, wz(k * 22));
  if (pf.bob) { o.position.y = -0.95; o.userData.bob = pf.bob; o.userData.k = k; }
  if (name !== 'hangar' && name !== 'boat' && name !== 'cutter') o.rotation.y += hs(k, 9) * TAU2;
  else if (side < 0) o.rotation.y += Math.PI;
  const s = 0.85 + hs(k, 6) * 0.35; o.scale.multiplyScalar(s);
  env.root.add(o); return o;
}

/* ---------- per-item objects ---------- */
const objs = new Map();
const blob = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
const glowM = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd23f, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
function shadowDisc(r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blob); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1; return m; }

function gateFace(op, cv) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, good = G.isGood(op), chg = op.t === 'c';
  c.clearRect(0, 0, w, h);
  c.fillStyle = chg ? '#ffc828' : good ? '#1446aa' : '#8c1424'; c.fillRect(0, 0, w, 54);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (chg) { c.fillStyle = '#281c00'; c.font = '400 34px ' + G.FONT; c.fillText(op.v >= op.cap ? 'MAX' : 'SHOOT TO RAISE', w / 2, 29); }
  else { c.fillStyle = '#fff'; for (let s = 0; s < 3; s++) { const x = w * (0.35 + s * 0.15), y = 27, r = 15; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); } }
  c.font = '400 210px ' + G.FONT; c.lineJoin = 'round'; c.lineWidth = 20; c.strokeStyle = 'rgba(8,16,40,.75)';
  const t = G.label(op); c.strokeText(t, w / 2, h * 0.6); c.fillStyle = '#fff'; c.fillText(t, w / 2, h * 0.6);
}
function makeGate(it) {
  const root = new THREE.Group(), sides = {};
  for (const sd of ['l', 'r']) {
    const op = it[sd], good = G.isGood(op), col = good ? '#2684ff' : '#e83446';
    const gm = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(RH * 0.94, 2.6, 0.08), gm); glass.position.set((sd === 'l' ? -0.5 : 0.5) * RH, 1.4, 0);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 392;
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(RH * 0.94, 2.98), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
    face.position.set(glass.position.x, 1.59, 0.06); face.renderOrder = 3;
    root.add(glass, face); sides[sd] = { glass, face, cv, tx, txt: '', gen: -1, op };
  }
  for (const x of [-1, 0, 1]) {
    root.add(mesh(g.cyl, '#dfe4ee', x * RH, 1.55, 0, 0, 0, 0, .11, 3.1, .11));
    root.add(mesh(g.sph, '#ffd23f', x * RH, 3.15, 0, 0, 0, 0, .16));
  }
  return {
    root, update(it) {
      for (const sd of ['l', 'r']) {
        const s = sides[sd], op = it[sd], t = G.label(op) + (op.t === 'c' && op.v >= op.cap ? 'M' : '');
        if (t !== s.txt || s.gen !== fontGen) { gateFace(op, s.cv); s.tx.needsUpdate = true; s.txt = t; s.gen = fontGen; const good = G.isGood(op), col = good ? '#2684ff' : '#e83446'; s.glass.material.color.set(col); s.glass.material.emissive.set(col); }
        const used = it.done && it.used === sd, faded = it.done && !used;
        s.glass.visible = s.face.visible = !used;
        s.glass.material.opacity = faded ? 0.18 : 0.5; s.face.material.opacity = faded ? 0.35 : 1;
        s.glass.material.emissiveIntensity = 0.35 + (op.hitT > 0 ? op.hitT * 1.2 : 0) + Math.sin(G.time * 3) * 0.05;
      }
    }
  };
}
function makeBarrel(it) {
  const pr = it.prize, col = pr.k === 'troops' ? ['#2d6cdf', '#1c49a0', '#5e96f2'] : pr.k === 'weapon' ? ['#5d6b38', '#3f4a25', '#7c8c4b'] : ['#d9a514', '#9a7308', '#f3c744'];
  const body = new THREE.Group();
  body.add(mesh(g.cyl, col[0], 0, .6, 0, 0, 0, 0, .45, 1.2, .45));
  body.add(mesh(g.cyl, col[1], 0, .33, 0, 0, 0, 0, .47, .08, .47)); body.add(mesh(g.cyl, col[1], 0, .87, 0, 0, 0, 0, .47, .08, .47));
  body.add(mesh(g.cyl, col[2], 0, 1.21, 0, 0, 0, 0, .43, .03, .43));
  const flashM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const fl = new THREE.Mesh(g.cyl, flashM); fl.scale.set(.5, 1.25, .5); fl.position.y = .6; body.add(fl);
  const root = new THREE.Group(); root.add(body, shadowDisc(.8));
  return { root, update(it) { body.position.x = it.hitT > 0 ? (Math.random() - 0.5) * 0.12 : 0; flashM.opacity = it.hitT > 0 ? it.hitT * 0.6 : 0; } };
}
function makeCrate(it) {
  const tx = canvasTex(128, 128, (c) => { c.fillStyle = '#5d6b38'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#4a562c'; c.fillRect(0, 0, 128, 12); c.fillRect(0, 116, 128, 12); c.fillStyle = '#f4f1e4'; const x = 64, y = 62, r = 30; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); });
  const box = new THREE.Mesh(g.box, new THREE.MeshLambertMaterial({ map: tx })); box.scale.set(1.2, .85, .85); box.castShadow = true;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = 3.5;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .04;
  const root = new THREE.Group(); root.add(box, beam, ring);
  return { root, update(it) { const p = .5 + .5 * Math.sin(G.time * 6 + it.z); box.position.y = .9 + Math.sin(G.time * 4 + it.z) * .12; box.rotation.y = G.time * 1.2; ring.scale.setScalar(1 + p * .15); ring.material.opacity = .5 + p * .4; } };
}
function makeMines(it) {
  const tx = canvasTex(256, 64, (c) => { c.clearRect(0, 0, 256, 64); c.fillStyle = 'rgba(255,205,40,.75)'; for (let i = -4; i < 20; i++) { c.beginPath(); c.moveTo(i * 16, 64); c.lineTo(i * 16 + 8, 64); c.lineTo(i * 16 + 40, 0); c.lineTo(i * 16 + 32, 0); c.fill(); } c.fillStyle = '#ffcd28'; c.fillRect(0, 0, 256, 5); c.fillRect(0, 59, 256, 5); });
  const root = new THREE.Group(), x0 = it.side < 0 ? -RH / 2 : RH / 2;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(RH, 3.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false })); deck.rotation.x = -Math.PI / 2; deck.position.set(x0, .03, 0); deck.renderOrder = 1; root.add(deck);
  const bulbs = [];
  for (let j = 0; j < 5; j++) {
    const mx = x0 - RH / 2 + RH * (0.1 + j * 0.2), mz = (j % 2 ? 0.6 : -0.6);
    root.add(mesh(g.cyl, '#2a2e36', mx, .07, mz, 0, 0, 0, .28, .14, .28));
    const b = new THREE.Mesh(g.sph, new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); b.scale.setScalar(.08); b.position.set(mx, .17, mz); root.add(b); bulbs.push(b);
  }
  const sign = canvasTex(128, 128, (c) => { c.fillStyle = '#ffcd28'; c.strokeStyle = '#1d2126'; c.lineWidth = 8; c.beginPath(); c.moveTo(64, 8); c.lineTo(122, 116); c.lineTo(6, 116); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#1d2126'; c.font = '400 70px ' + G.FONT; c.textAlign = 'center'; c.fillText('!', 64, 104); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshLambertMaterial({ map: sign, transparent: true, side: THREE.DoubleSide })); sg.position.set(x0 + (it.side < 0 ? -RH * 0.55 : RH * 0.55), 1.9, 1.5); root.add(sg);
  root.add(mesh(g.cyl, '#8a8f99', sg.position.x, .8, 1.5, 0, 0, 0, .04, 1.6, .04));
  return { root, update() { bulbs.forEach((b, j) => b.material.color.set((Math.floor(G.time * 4) + j) % 2 ? '#ff3b3b' : '#5a1010')); } };
}
function makeShield(it) {
  const m = new THREE.Mesh(g.box, new THREE.MeshLambertMaterial({ color: '#8090b0', emissive: '#334', transparent: true, opacity: .55, depthWrite: false }));
  const root = new THREE.Group(); root.add(m);
  return { root, update(it) { const r = G.radius(Math.ceil(it.n)) * RH + .5; m.scale.set(r * 2, .8, .12); m.position.set(0, .45, r * 0.35 + .4); } };
}
function makeGiant(pal) {
  const gg = soldierGeo(pal), root = new THREE.Group(), body = new THREE.Mesh(gg.torso, TMAT), l1 = new THREE.Mesh(gg.leg, TMAT), l2 = new THREE.Mesh(gg.leg, TMAT);
  [body, l1, l2].forEach(m => { m.castShadow = true; root.add(m); });
  root.rotation.y = Math.PI; root.scale.setScalar(4.2 * TS); root.add(shadowDisc(.5));
  return { root, pose(run) { const ph = G.time * 3.2, sw = run ? Math.sin(ph) * .5 : 0, bob = run ? Math.abs(Math.cos(ph)) * .03 : 0; body.position.y = bob; l1.position.set(-.075, .27 + bob, 0); l2.position.set(.075, .27 + bob, 0); l1.rotation.x = -sw; l2.rotation.x = sw; } };
}
const GIANT_PAL = { body: '#8e1f2b', dark: '#3a0d13', helmet: '#2b2b33', gear: '#1f1f26' };
function makeObj(it) {
  if (it.type === 'gate') return makeGate(it);
  if (it.type === 'barrel') return makeBarrel(it);
  if (it.type === 'crate') return makeCrate(it);
  if (it.type === 'mines') return makeMines(it);
  if (it.type === 'foe' && it.big) { const gi = makeGiant(GIANT_PAL); return { root: gi.root, update(it) { gi.pose(!!it.active && G.state === 'run'); } }; }
  if (it.type === 'foe' && it.kind === 'shield') return makeShield(it);
  return null;
}

/* ---------- boss end zone ---------- */
const bossZone = new THREE.Group(); S3.add(bossZone);
{
  const chk = canvasTex(256, 32, (c) => { for (let i = 0; i < 16; i++) for (let r = 0; r < 2; r++) { c.fillStyle = (i + r) % 2 ? '#ffffff' : '#222222'; c.fillRect(i * 16, r * 16, 16, 16); } });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, 1), new THREE.MeshLambertMaterial({ map: chk })); strip.rotation.x = -Math.PI / 2; strip.position.set(0, .02, 7); bossZone.add(strip);
  const bag = new THREE.InstancedMesh(g.sph, mat('#c9b88c'), 3 * 12); let n = 0;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 12 - (r % 2); i++) { dummy.position.set(-RH + (i + .5 + (r % 2) * .5) * RH * 2 / 12, .2 + r * .3, -6); dummy.rotation.set(0, 0, 0); dummy.scale.set(.36, .17, .26); dummy.updateMatrix(); bag.setMatrixAt(n++, dummy.matrix); }
  bag.count = n; bag.castShadow = true; bossZone.add(bag);
  for (const s of [-1, 1]) { bossZone.add(mesh(g.cyl, '#d9d9d9', s * RH * .85, 2, -6, 0, 0, 0, .05, 4, .05)); bossZone.add(mesh(g.box, '#b3182c', s * RH * .85 + .6, 3.6, -6, 0, 0, 0, 1.2, .7, .03)); }
}
let warlord = null;

/* ---------- player flag ---------- */
const flagGeo = new THREE.PlaneGeometry(1.25, .7, 12, 4); flagGeo.translate(.625, 0, 0);
const flagBase = flagGeo.attributes.position.array.slice();
const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ map: flagTex(), side: THREE.DoubleSide })); flag.castShadow = true;
const pole = mesh(g.cyl, '#e8e8e8', 0, 0, 0, 0, 0, 0, .035, 2.6, .035);
const poleTop = mesh(g.sph, '#ffd23f', 0, 0, 0, 0, 0, 0, .07);
S3.add(flag, pole, poleTop);
const squadShadow = shadowDisc(1); S3.add(squadShadow);

/* ---------- bullets, support craft, explosions ---------- */
const BCAP = 600;
const bulletM = new THREE.InstancedMesh(g.box, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), BCAP); bulletM.frustumCulled = false; bulletM.count = 0; S3.add(bulletM);
const bcol = new THREE.Color();
function drone() {
  const d = new THREE.Group(); d.add(mesh(g.box, '#3b414c', 0, 0, 0, 0, 0, 0, .5, .16, .36));
  for (const a of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { d.add(mesh(g.box, '#2a2e36', a[0] * .28, 0, a[1] * .22, 0, Math.atan2(a[1], a[0]), 0, .45, .04, .05)); d.add(mesh(g.cyl, new THREE.MeshBasicMaterial({ color: '#dce6f0', transparent: true, opacity: .45 }), a[0] * .45, .06, a[1] * .36, 0, 0, 0, .24, .01, .24)); }
  d.add(mesh(g.sph, emis('#ff4d5e', 2), 0, -.06, -.18, 0, 0, 0, .05)); return d;
}
const drones = [drone(), drone()]; drones.forEach(d => S3.add(d));
const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const beams = [0, 1].map(() => { const l = new THREE.Line(beamGeo.clone(), new THREE.LineBasicMaterial({ color: '#aaebff', transparent: true, opacity: .9 })); S3.add(l); return l; });
const artyRings = [];
for (let j = 0; j < 3; j++) { const r = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 40), new THREE.MeshBasicMaterial({ color: '#ff3c3c', transparent: true, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = .05; S3.add(r); artyRings.push(r); }
function jet() {
  const j = new THREE.Group(), c = '#646c78';
  j.add(mesh(g.cyl, c, 0, 0, 0, Math.PI / 2, 0, 0, .45, 6, .45)); j.add(mesh(g.cone, c, 0, 0, -3.8, -Math.PI / 2, 0, 0, .45, 1.6, .45));
  j.add(mesh(g.box, c, 0, 0, .4, 0, 0, 0, 7, .1, 2.2)); j.add(mesh(g.box, c, 0, .7, 2.6, 0, 0, 0, .1, 1.4, 1.1)); j.add(mesh(g.box, c, 0, 0, 2.7, 0, 0, 0, 2.6, .08, .9));
  j.add(mesh(g.sph, '#2e3440', 0, .35, -1.6, 0, 0, 0, .3, .25, .8)); j.add(mesh(g.sph, emis('#ffb347', 3), 0, 0, 3.05, 0, 0, 0, .3));
  return j;
}
function helo() {
  const h = new THREE.Group(); h.add(mesh(g.sph, '#e8742c', 0, 0, 0, 0, 0, 0, .9, .85, 1.7)); h.add(mesh(g.box, '#f4f4f2', 0, -.1, 0, 0, 0, 0, 1.82, .25, 1.4));
  h.add(mesh(g.cyl, '#e8742c', 0, .25, 2.4, Math.PI / 2, 0, 0, .14, 3, .14)); h.add(mesh(g.box, '#e8742c', 0, .7, 3.8, 0, 0, 0, .08, .9, .7));
  h.add(mesh(g.sph, '#2e3440', 0, .2, -1.2, 0, 0, 0, .7, .5, .6));
  const rot = new THREE.Group(); rot.add(mesh(g.box, '#2a2e36', 0, 0, 0, 0, 0, 0, 7, .05, .22)); rot.add(mesh(g.box, '#2a2e36', 0, 0, 0, 0, Math.PI / 2, 0, 7, .05, .22)); rot.position.y = 1; h.add(rot); h.userData.rot = rot;
  return h;
}
const craft = { jet: jet(), helo: helo() }; S3.add(craft.jet, craft.helo);
const booms = [], boomLight = new THREE.PointLight('#ffb347', 0, 30, 1.6); S3.add(boomLight);
const boomGeo = new THREE.SphereGeometry(1, 16, 10);
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();

/* ---------- camera ---------- */
function placeCamera() {
  const sz = wz(G.pz), aspect = Math.max(0.3, G.W / Math.max(1, G.H));
  const dist = aspect < 0.75 ? 11.5 : 10.5;
  cam.position.set(G.px * RH * 0.32, dist * 0.6, sz + dist * 0.8);
  tmpV.set(G.px * RH * 0.22, 0.2, sz - 15); cam.lookAt(tmpV);
  /* fit roughly 12 m of width at the squad, whatever the screen shape */
  const d = cam.position.distanceTo(tmpV2.set(G.px * RH * 0.22, 0, sz));
  const hf = 2 * Math.atan(5.4 / d), vf = 2 * Math.atan(Math.tan(hf / 2) / aspect) * 180 / Math.PI;
  cam.fov = Math.min(78, Math.max(42, vf)); cam.aspect = aspect; cam.updateProjectionMatrix();
  if (G.shake > 0 && !G.reduceMotion) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.35; cam.position.y += (Math.random() - 0.5) * G.shake * 0.25; }
  cam.updateMatrixWorld();
  camRef = cam.position.distanceTo(tmpV2.set(G.px * RH, 0, sz));
  const a = toScreen(-RH, 0, sz), b = toScreen(RH, 0, sz); G.roadHalf = Math.max(40, (b.x - a.x) / 2);
}
const scr = { x: 0, y: 0, s: 1 };
function toScreen(x, y, z) {
  tmpV.set(x, y, z); const d = tmpV.distanceTo(cam.position); tmpV.project(cam);
  return { x: (tmpV.x * 0.5 + 0.5) * G.W, y: (-tmpV.y * 0.5 + 0.5) * G.H, s: camRef / Math.max(0.5, d), behind: tmpV.z > 1 };
}

/* ---------- frame ---------- */
const PAL_RED = { body: '#d63a48', dark: '#8e1f2b', helmet: '#a32633', gear: '#6e1620' };
const PAL_FAST = { body: '#f08a3c', dark: '#a8521a', helmet: '#c96a22', gear: '#7a3a10' };
const PAL_SHIELD = { body: '#b23a52', dark: '#5a2030', helmet: '#56627a', gear: '#3c465a' };
let lastT = 0;
function render() {
  const th = G.THEMES[G.theme], land = G.BR().land, key = G.theme + '|' + G.save.branch;
  if (key !== envKey) { buildEnv(th, land); envKey = key; }
  placeCamera();
  const pz = G.pz, sz = wz(pz), t = G.time, dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  sky.position.copy(cam.position); stars.position.copy(cam.position);
  /* light and shadow box follow the squad */
  const L = LIGHT[G.theme] || LIGHT[0];
  sun.position.set(G.px * RH + L.dir[0] * 40, L.dir[1] * 40, sz - 8 + L.dir[2] * 40); sun.target.position.set(G.px * RH, 0, sz - 8);
  /* scrolling world pieces stay aligned to world space */
  for (const [m, step] of env.scroll) m.position.z = Math.round((sz - 150) / step) * step;
  if (env.water) { env.water.position.set(0, -0.9, Math.round(sz / 50) * 50); env.water.material.uniforms.uT.value = t; }
  if (env.sea) { env.sea.position.z = sz - 380; env.sea.material.uniforms.uT.value = t; }
  for (const m of env.mtn) m.position.set(cam.position.x, 0, cam.position.z - m.userData.dist);
  /* props */
  const k0 = Math.floor((pz - 30) / 22), k1 = Math.floor((pz + 520) / 22);
  for (const [k, o] of env.props) if (k < k0 || k > k1) { env.root.remove(o); env.props.delete(k); }
  for (let k = k0; k <= k1; k++) if (!env.props.has(k)) env.props.set(k, propAt(k));
  for (const o of env.props.values()) if (o.userData.bob) { o.position.y = -0.95 + Math.sin(t * 1.6 + o.userData.k) * 0.12 * o.userData.bob; o.rotation.z = Math.sin(t * 1.2 + o.userData.k) * 0.05; }
  /* scatter */
  { let n = 0; const sc = env.scat, base = Math.floor((pz - 20) / 4);
    for (let q = base; q < base + 140 && n < 220; q++) for (let s = 0; s < 2 && n < 220; s++) {
      const r = hs(q, 40 + s); if (r > 0.75) continue;
      const side = s ? 1 : -1, x = side * (RH * 1.15 + hs(q, 50 + s) * RH * 6), z = wz(q * 4 + hs(q, 60 + s) * 4);
      if (env.land.water) { const a = 0.5 + 0.5 * Math.sin(t * 2 + q * 1.3 + s); dummy.position.set(x, -0.87, z); dummy.scale.set(0.5 + a * .5, 0.03, 0.15); }
      else { dummy.position.set(x, 0.2, z); dummy.scale.setScalar(0.7 + hs(q, 70 + s) * 0.8); }
      dummy.rotation.set(0, hs(q, 80) * 6, 0); dummy.updateMatrix(); sc.setMatrixAt(n++, dummy.matrix);
    }
    sc.count = n; sc.instanceMatrix.needsUpdate = true; }
  /* items */
  for (const tr of Object.values(troops)) tr.begin();
  const seen = new Set();
  for (const it of G.items) {
    const zr = it.z - pz;
    if (zr > 420 || zr < -30) continue;
    if ((it.type === 'foe' || it.type === 'barrel' || it.type === 'crate') && it.done && (it.hit || it.type !== 'foe')) continue;
    if ((it.type === 'gate' || it.type === 'mines') && zr < -2) continue;
    if (it.type === 'foe' && !it.big) {
      const run = !!it.active && G.state === 'run';
      if (it.kind === 'fast') crowd(troop(PAL_FAST), it.x, it.z, Math.ceil(it.n), run, true, 17);
      else if (it.kind === 'shield') crowd(troop(PAL_SHIELD), it.x, it.z, Math.ceil(it.n), run, true, 7);
      else crowd(troop(PAL_RED), it.x, it.z, Math.ceil(it.n), run, true, 11);
    }
    let o = objs.get(it);
    if (o === undefined) { o = makeObj(it); objs.set(it, o); if (o) S3.add(o.root); }
    if (!o) continue;
    seen.add(it); o.root.position.set(it.type === 'mines' || it.type === 'gate' ? 0 : it.x * RH, 0, wz(it.z)); o.update(it);
  }
  for (const [it, o] of objs) if (!seen.has(it)) { if (o) { S3.remove(o.root); o.root.traverse(m => { if (m.material && m.material.map && m.material.map !== blob.map && m.material.map !== glowM.map) m.material.map.dispose(); }); } objs.delete(it); }
  /* boss */
  const bz = wz(G.bossZ); bossZone.position.set(0, 0, bz);
  bossZone.visible = G.bossZ - pz < 460;
  if (G.boss > 0) crowd(troop(PAL_RED), 0, G.bossZ, Math.ceil(G.boss), G.state === 'battle', true, 11);
  if (G.bossMission && G.boss > 0) { if (!warlord) { warlord = makeGiant(GIANT_PAL); warlord.root.scale.setScalar(5.2 * TS); S3.add(warlord.root); } warlord.root.visible = true; warlord.root.position.set(0, 0, wz(G.bossZ + 8)); warlord.pose(G.state === 'battle'); }
  else if (warlord) warlord.root.visible = false;
  /* player squad */
  const alive = G.count > 0, run = G.state === 'run' || G.state === 'battle' || G.state === 'win';
  if (alive) crowd(troop(G.PAL_US, 160), G.px, pz, G.count, run, false, 11);
  for (const tr of Object.values(troops)) tr.end();
  const fx = G.px * RH + 0.15;
  flag.visible = pole.visible = poleTop.visible = squadShadow.visible = alive;
  pole.position.set(fx, 1.3, sz); poleTop.position.set(fx, 2.62, sz); flag.position.set(fx + 0.03, 2.25, sz);
  { const p = flagGeo.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const x = flagBase[i]; p[i + 2] = flagBase[i + 2] + Math.sin(t * 7 - x * 5) * 0.09 * x; p[i + 1] = flagBase[i + 1] - x * 0.06; } flagGeo.attributes.position.needsUpdate = true; flagGeo.computeVertexNormals(); }
  const rr = G.radius(G.count) * RH; squadShadow.position.set(G.px * RH, 0.03, sz - rr * 0.1); squadShadow.scale.setScalar(rr + 0.6);
  /* bullets */
  let bn = 0;
  for (const bl of G.bullets) {
    if (bn >= BCAP) break;
    const len = Math.max(0.3, bl.tail * ZS), r = Math.max(0.05, bl.r * RH * (bl.rocket ? 1.2 : 1.6));
    dummy.position.set(bl.x * RH, bl.rocket ? 0.55 : 0.47, wz(bl.z) + len / 2); dummy.rotation.set(0, Math.atan2(-bl.vx * RH, bl.spd * ZS), 0); dummy.scale.set(r, r, len); dummy.updateMatrix();
    bulletM.setMatrixAt(bn, dummy.matrix); bulletM.setColorAt(bn, bcol.set(bl.rocket ? '#d9d9c8' : bl.col).multiplyScalar(bl.rocket ? 1 : 2.2)); bn++;
  }
  bulletM.count = bn; bulletM.instanceMatrix.needsUpdate = true; if (bulletM.instanceColor) bulletM.instanceColor.needsUpdate = true;
  /* support */
  const dOn = G.droneT > 0 && alive;
  drones.forEach((d, j) => {
    d.visible = dOn; if (!dOn) return;
    const s = j ? 1 : -1; d.position.set(G.px * RH + s * 2.2, 3 + Math.sin(t * 5 + j) * .15, sz - 2); d.rotation.z = Math.sin(t * 3 + j) * .1;
    const b = beams[j]; b.visible = !!G.droneTg && Math.random() < 0.8;
    if (b.visible) { const pa = b.geometry.attributes.position.array; pa[0] = d.position.x; pa[1] = d.position.y - .1; pa[2] = d.position.z; pa[3] = G.droneTg.x * RH; pa[4] = .6; pa[5] = wz(G.droneTg.z); b.geometry.attributes.position.needsUpdate = true; }
  });
  if (!dOn) beams.forEach(b => b.visible = false);
  const aOn = G.artyT > 0 || G.artyShells > 0, pu = .5 + .5 * Math.sin(t * 18);
  artyRings.forEach((r, j) => { r.visible = aOn; if (aOn) { r.position.set((j - 1) * .55 * RH, .05, wz(G.artyZ + (j - 1) * 14)); r.material.opacity = .5 + pu * .4; r.scale.setScalar(1 + pu * .1); } });
  const isHelo = G.BR().air === 'helo', ac = isHelo ? craft.helo : craft.jet, other = isHelo ? craft.jet : craft.helo; other.visible = false;
  ac.visible = G.airAnim > 0;
  if (ac.visible) { const a = G.airAnim; ac.position.set(0, isHelo ? 7 : 10 - a * 2, sz + 14 - a * 150); ac.rotation.set(isHelo ? -.25 : -.05, 0, isHelo ? 0 : Math.sin(a * 6) * .15); if (isHelo) ac.userData.rot.rotation.y = t * 30; }
  /* explosions */
  let li = 0;
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt; const k = b.t / b.life;
    if (k >= 1) { S3.remove(b.m); b.m.material.dispose(); booms.splice(i, 1); continue; }
    b.m.scale.setScalar(b.r * (0.5 + Math.sqrt(k) * 1.1)); b.m.material.opacity = (1 - k) * (1 - k); b.m.material.color.setRGB(1.6, 0.9 - k * 0.5, 0.4 - k * 0.35);
    if (1 - k > li) { li = 1 - k; boomLight.position.copy(b.m.position).y += 2; }
  }
  boomLight.intensity = li * 60;
  renderer.render(S3, cam);
  watchdog();
}
function boom(sx, sy, scl) {
  if (booms.length > 14) return;
  ndc.set(sx / G.W * 2 - 1, -(sy / G.H) * 2 + 1); ray.setFromCamera(ndc, cam);
  if (!ray.ray.intersectPlane(groundPlane, tmpV)) return;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowM.map, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.position.copy(tmpV).y += 1; S3.add(m); booms.push({ m, t: 0, life: 0.5, r: 2.5 + scl * 3.5 });
}

/* ---------- 2D labels drawn over the 3D view ---------- */
function labels() {
  const pz = G.pz;
  for (const it of G.items) {
    const zr = it.z - pz; if (zr > 300 || zr < -2) continue;
    if (it.done && it.type !== 'gate') continue;
    if (it.type === 'foe') {
      const n = Math.ceil(it.n);
      if (it.big) {
        const p = toScreen(it.x * RH, 3.6, wz(it.z)), u = Math.max(16, 64 * p.s), bw = u * 1.9, fr = Math.max(0, Math.min(1, it.n / it.max)), by = p.y;
        G.ctx.fillStyle = 'rgba(10,14,30,.8)'; G.ctx.fillRect(p.x - bw / 2, by, bw, u * 0.22);
        G.ctx.fillStyle = '#ff4d5e'; G.ctx.fillRect(p.x - bw / 2, by, bw * fr, u * 0.22);
        G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth = 1.5; G.ctx.strokeRect(p.x - bw / 2, by, bw, u * 0.22);
        G.pill(String(n), p.x, by - u * 0.4, Math.max(11, u * 0.42), 'rgba(110,12,26,.95)', 'rgba(255,255,255,.85)');
      } else {
        const p = toScreen(it.x * RH, 1.25, wz(it.z)), sz = Math.max(10, G.roadHalf * 0.13 * p.s);
        if (it.kind === 'fast') G.pill(n + ' »', p.x, p.y, sz, 'rgba(214,100,16,.96)', 'rgba(255,255,255,.85)');
        else if (it.kind === 'shield') G.pill(String(n), p.x, p.y, sz, 'rgba(64,78,104,.96)', 'rgba(230,238,250,.9)');
        else G.pill(String(n), p.x, p.y, sz, 'rgba(170,24,44,.95)', 'rgba(255,255,255,.8)');
      }
    } else if (it.type === 'barrel') {
      const pr = it.prize, p = toScreen(it.x * RH, 1.75, wz(it.z)), u = Math.max(12, G.roadHalf * 0.26 * p.s);
      const txt = pr.k === 'troops' ? '+' + pr.v : pr.k === 'weapon' ? (G.WEAPONS[pr.w].tag || G.WEAPONS[pr.w].name) : G.BR().tag[pr.s];
      G.pill(txt, p.x, p.y, Math.max(10, u * 0.4), pr.k === 'troops' ? 'rgba(28,73,160,.95)' : pr.k === 'weapon' ? 'rgba(63,74,37,.95)' : 'rgba(154,115,8,.95)', 'rgba(255,255,255,.85)');
      const bw = u * 1.1, by = p.y + u * 0.32; G.ctx.fillStyle = 'rgba(10,14,30,.8)'; G.ctx.fillRect(p.x - bw / 2, by, bw, Math.max(3, u * 0.1));
      G.ctx.fillStyle = '#ffd23f'; G.ctx.fillRect(p.x - bw / 2, by, bw * Math.max(0, it.n / it.max), Math.max(3, u * 0.1));
    } else if (it.type === 'crate') {
      const p = toScreen(it.x * RH, 1.9, wz(it.z)), u = Math.max(10, G.roadHalf * 0.12 * p.s);
      G.pill(G.WEAPONS[it.w].tag || G.WEAPONS[it.w].name, p.x, p.y, u, 'rgba(63,74,37,.95)', 'rgba(255,210,63,.9)');
    }
  }
  if (G.boss > 0 && G.bossZ - pz < 300) {
    const n = Math.ceil(G.boss), p = toScreen(0, G.bossMission ? 4.6 : 1.35, wz(G.bossZ));
    if (G.bossMission) { const q = toScreen(0, 4.9, wz(G.bossZ + 8)); G.pill('WARLORD', q.x, q.y - 24, Math.max(10, 40 * q.s), 'rgba(20,20,26,.9)', 'rgba(255,210,63,.9)'); }
    G.pill(String(n), p.x, p.y, Math.max(11, G.roadHalf * 0.15 * p.s), 'rgba(170,24,44,.95)', 'rgba(255,255,255,.8)');
  }
  if (G.count > 0) {
    const p = toScreen(G.px * RH, 1.55 + G.radius(G.count) * 0.6, wz(pz));
    G.pill(String(G.count), p.x, p.y - 4, G.roadHalf * 0.17 * (1 + 0.35 * G.pop), G.pop > 0.05 && G.popBad ? 'rgba(170,24,44,.95)' : 'rgba(22,48,107,.95)', 'rgba(255,255,255,.85)');
  }
}

/* ---------- public api ---------- */
function resize() {
  if (!G.W || !G.H) return;
  renderer.setPixelRatio(Math.min(G.qDPR, window.devicePixelRatio || 1)); renderer.setSize(G.W, G.H, false);
  placeCamera();
}
function quality(step) { if (step >= 2) { lowQ = true; renderer.shadowMap.enabled = false; S3.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } }
function proj(x, zr) { const p = toScreen(x * RH, 0, wz(G.pz + zr)); return p; }

/* Software rendering (no GPU) cannot run the 3D scene at a playable rate: keep the 2D renderer there,
   and drop back to 2D at runtime if frames stay very slow. ?3d=force skips both checks for testing. */
function softwareGL() {
  try { const gl = renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); const r = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''; return /swiftshader|llvmpipe|softpipe|software/i.test(r); } catch (e) { return false; }
}
const force = /[?&]3d=force/.test(location.search), off = /[?&]3d=off/.test(location.search);
let slowFor = 0, lastWall = 0;
function watchdog() {
  const now = performance.now(), d = lastWall ? now - lastWall : 16; lastWall = now;
  if (force || G.state !== 'run' || d > 1500) return;
  slowFor = d > 90 ? slowFor + d : Math.max(0, slowFor - d * 2);
  if (slowFor > 3000) disable3D();
}
function disable3D() { G.R3.ok = false; glc.style.display = 'none'; G.resize(); }
if (renderer && renderer.getContext() && !off && (force || !softwareGL())) {
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.R3 = { ok: true, render, labels, proj, resize, boom, quality, above: (h) => toScreen(G.px * RH, h, wz(G.pz)).y, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fontGen++; });
  G.resize();
} else if (renderer) { glc.style.display = 'none'; }
