import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcdd8de, 140, 900);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-40, 6, 10);

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
const rand = mulberry32(7);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------------------
// Sky + sun + environment lighting
// ---------------------------------------------------------------------------
const sky = new Sky();
sky.scale.setScalar(4000);
const su = sky.material.uniforms;
su.turbidity.value = 4; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(215));
su.sunPosition.value.copy(sunDir);
scene.add(sky);

const pmrem = new THREE.PMREMGenerator(renderer);
const skyScene = new THREE.Scene();
const skyClone = new Sky(); skyClone.scale.setScalar(4000);
Object.assign(skyClone.material.uniforms.sunPosition.value, sunDir);
for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) skyClone.material.uniforms[k].value = su[k].value;
skyScene.add(skyClone);
scene.environment = pmrem.fromScene(skyScene, 0.04).texture;
scene.environmentIntensity = 0.55;

const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 300;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x8a6f52, 0.55));

// ---------------------------------------------------------------------------
// Procedural textures (drawn on canvas; no image files needed)
// ---------------------------------------------------------------------------
function canvasTex(size, draw, { srgb = true, w = size, h = size } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noise(g, w, h, amt, alpha = 0.08, dark = true) {
  for (let i = 0; i < amt; i++) {
    const v = dark ? Math.floor(rand() * 60) : 200 + Math.floor(rand() * 55);
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    const s = 1 + rand() * 3; g.fillRect(rand() * w, rand() * h, s, s);
  }
}
function star8(g, cx, cy, r, ri) {
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2; const rr = i % 2 ? ri : r; g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  g.closePath();
}

// carved stucco: interlaced 8-point stars + arabesque rosettes
function drawStucco(g, w, h, base = "#d8c4a1") {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const cell = w / 4;
  for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) {
    const cx = x * cell, cy = y * cell;
    g.lineWidth = 5; g.strokeStyle = "rgba(90,62,30,.35)";
    g.strokeRect(cx - cell * .3, cy - cell * .3, cell * .6, cell * .6);
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.strokeRect(-cell * .3, -cell * .3, cell * .6, cell * .6); g.restore();
    g.lineWidth = 2; g.strokeStyle = "rgba(255,245,225,.55)";
    star8(g, cx + 1.5, cy + 1.5, cell * .22, cell * .12); g.stroke();
    g.fillStyle = "rgba(120,86,46,.28)"; g.beginPath(); g.arc(cx + cell / 2, cy + cell / 2, cell * .09, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4; g.beginPath();
      g.ellipse(cx + cell / 2 + Math.cos(a) * cell * .15, cy + cell / 2 + Math.sin(a) * cell * .15, cell * .06, cell * .025, a, 0, 7);
      g.fillStyle = "rgba(255,248,230,.35)"; g.fill();
    }
  }
  noise(g, w, h, 9000, 0.12);
}
const texStucco = canvasTex(512, (g, w, h) => drawStucco(g, w, h));
const bumpStucco = canvasTex(512, (g, w, h) => drawStucco(g, w, h, "#9a9a9a"), { srgb: false });

// zellij tile dado
const texZellij = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#efe7d6"; g.fillRect(0, 0, w, h);
  const cols = ["#2e6b4f", "#2c4f7c", "#1e1d1b", "#c99a2e", "#2e6b4f", "#7a2f22"];
  const cell = w / 4; let n = 0;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const cx = x * cell, cy = y * cell;
    g.fillStyle = cols[(n++) % cols.length]; star8(g, cx, cy, cell * .42, cell * .26); g.fill();
    g.strokeStyle = "#3a2e22"; g.lineWidth = 3; g.stroke();
    g.fillStyle = cols[(n + 2) % cols.length]; g.save(); g.translate(cx + cell / 2, cy + cell / 2); g.rotate(Math.PI / 4);
    g.fillRect(-cell * .12, -cell * .12, cell * .24, cell * .24); g.strokeRect(-cell * .12, -cell * .12, cell * .24, cell * .24); g.restore();
  }
  g.fillStyle = "#3a2e22"; g.fillRect(0, h - 10, w, 10);
  noise(g, w, h, 4000, 0.1, false);
});

// marble floor
const texMarble = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#e9e4da"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(150,140,125,${0.05 + rand() * 0.12})`; g.lineWidth = 0.5 + rand() * 2;
    g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rand() - .5) * 160; y += (rand() - .3) * 120; g.quadraticCurveTo(x + (rand() - .5) * 80, y, x, y); }
    g.stroke();
  }
  g.strokeStyle = "rgba(120,110,95,.35)"; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  noise(g, w, h, 5000, 0.06);
});

// cedar star ceiling
const texCedar = canvasTex(1024, (g, w, h) => {
  g.fillStyle = "#4a2e17"; g.fillRect(0, 0, w, h);
  const cell = w / 10;
  for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++) {
    const cx = x * cell + (y % 2 ? cell / 2 : 0), cy = y * cell;
    g.fillStyle = "#6b4626"; star8(g, cx, cy, cell * .36, cell * .2); g.fill();
    g.strokeStyle = "#a07a45"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#c9a35a"; g.beginPath(); g.arc(cx, cy, cell * .05, 0, 7); g.fill();
    g.strokeStyle = "rgba(190,150,90,.6)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + cell * .36, cy); g.lineTo(cx + cell * .64, cy); g.stroke();
  }
  noise(g, w, h, 15000, 0.12);
});

// red-ochre exterior plaster ("the Red Castle")
const texPlaster = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#b9784f"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${120 + rand() * 80},${70 + rand() * 40},${40 + rand() * 30},${rand() * 0.18})`; g.beginPath(); g.arc(rand() * w, rand() * h, 6 + rand() * 40, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(80,45,25,.18)"; g.lineWidth = 2;
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y + rand() * 4); g.lineTo(w, y + rand() * 4); g.stroke(); }
  noise(g, w, h, 12000, 0.14);
});

const texWhite = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#e6dcc8"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 240; i++) { g.fillStyle = `rgba(${170 + rand() * 60},${150 + rand() * 50},${110 + rand() * 40},${rand() * 0.12})`; g.beginPath(); g.arc(rand() * w, rand() * h, 8 + rand() * 50, 0, 7); g.fill(); }
  noise(g, w, h, 9000, 0.08);
});

// terracotta roof tiles
const texRoof = canvasTex(256, (g, w, h) => {
  g.fillStyle = "#9c4a2c"; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    const grd = g.createLinearGradient(x, 0, x + 16, 0); grd.addColorStop(0, "#7a3620"); grd.addColorStop(.5, "#c0663f"); grd.addColorStop(1, "#7a3620");
    g.fillStyle = grd; g.fillRect(x, 0, 16, h);
  }
  g.fillStyle = "rgba(40,15,8,.35)"; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
  noise(g, w, h, 3000, 0.15);
});

const texGrass = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#6f7d43"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${60 + rand() * 70},${80 + rand() * 60},${30 + rand() * 30},${0.25 + rand() * .4})`; g.fillRect(rand() * w, rand() * h, 1, 2 + rand() * 4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(150,125,85,${rand() * .25})`; g.beginPath(); g.arc(rand() * w, rand() * h, 10 + rand() * 30, 0, 7); g.fill(); }
});
const texDirt = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#c2a982"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 20000; i++) { const v = 120 + rand() * 90; g.fillStyle = `rgba(${v},${v * .85},${v * .65},${rand() * .5})`; g.fillRect(rand() * w, rand() * h, 2, 2); }
});
const texHedge = canvasTex(256, (g, w, h) => {
  g.fillStyle = "#2c4a24"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${30 + rand() * 60},${70 + rand() * 70},${25 + rand() * 30},${0.6})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, 2 + rand() * 3, 1 + rand() * 2, rand() * 3, 0, 7); g.fill(); }
});
const texStone = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#c9b48c"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(90,70,40,.45)"; g.lineWidth = 3;
  for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 64) % 2 ? 0 : 64; x < w; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
  noise(g, w, h, 12000, 0.12);
});

// lace arch panel: stucco colour map + a black/white mask for the lobed opening
function archPath(g, w, h) {
  g.beginPath(); g.moveTo(w * .06, h); g.lineTo(w * .06, h * .55);
  const lobes = 7, r = w * .44, cx = w / 2, cy = h * .58;
  for (let i = 0; i <= lobes; i++) {
    const a = Math.PI + i * Math.PI / lobes;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.85;
    if (i === 0) g.lineTo(px, py);
    else g.quadraticCurveTo(cx + Math.cos(a - Math.PI / lobes / 2) * r * 0.86, cy + Math.sin(a - Math.PI / lobes / 2) * r * 0.72, px, py);
  }
  g.lineTo(w * .94, h); g.closePath();
}
const texArch = canvasTex(512, (g, w, h) => {
  drawStucco(g, w, h, "#dcc9a6");
  g.strokeStyle = "rgba(120,86,46,.55)"; g.lineWidth = 10; archPath(g, w, h); g.stroke();
});
const texArchMask = canvasTex(512, (g, w, h) => {
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#000"; archPath(g, w, h); g.fill();
}, { srgb: false });

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const M = {
  stucco: new THREE.MeshStandardMaterial({ map: texStucco, bumpMap: bumpStucco, bumpScale: 1.5, roughness: 0.85 }),
  zellij: new THREE.MeshStandardMaterial({ map: texZellij, roughness: 0.25, metalness: 0.0, envMapIntensity: 1.2 }),
  marble: new THREE.MeshStandardMaterial({ map: texMarble, roughness: 0.35 }),
  cedar: new THREE.MeshStandardMaterial({ map: texCedar, roughness: 0.6, side: THREE.DoubleSide }),
  plaster: new THREE.MeshStandardMaterial({ map: texPlaster, roughness: 0.95 }),
  white: new THREE.MeshStandardMaterial({ map: texWhite, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ map: texRoof, roughness: 0.8 }),
  grass: new THREE.MeshStandardMaterial({ map: texGrass, roughness: 1 }),
  dirt: new THREE.MeshStandardMaterial({ map: texDirt, roughness: 1 }),
  hedge: new THREE.MeshStandardMaterial({ map: texHedge, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ map: texStone, roughness: 0.9 }),
  arch: new THREE.MeshStandardMaterial({ map: texArch, alphaMap: texArchMask, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }),
  column: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.3 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.7 }),
  window: new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe7b8, emissiveIntensity: 1.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }),
  waterFlat: new THREE.MeshStandardMaterial({ color: 0x4f7f86, roughness: 0.05, metalness: 0.2 }),
  jet: new THREE.MeshStandardMaterial({ color: 0xe9f5f7, transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x9fc6cc, emissiveIntensity: 0.2 }),
};

// world-scaled UVs so textures tile at a consistent size on any box
function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}
function box(w, h, d, mat, x, y, z, tile = 2, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, tile), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive; scene.add(m); return m;
}
function plane(w, d, mat, x, y, z, tile = 4) {
  const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}

// Wall along x (axis "x") or z (axis "z") with door openings. Decorated walls get a tile dado.
function wall(axis, fixed, from, to, { h = 9, t = 0.7, doors = [], mat = M.stucco, dado = true, lintel = mat } = {}) {
  const ds = [...doors].sort((a, b) => a.at - b.at);
  let cur = from; const segs = [];
  for (const d of ds) { segs.push([cur, d.at - d.w / 2]); cur = d.at + d.w / 2; }
  segs.push([cur, to]);
  const place = (a, b, y0, y1, m, thick) => {
    const L = b - a; if (L <= 0.01 || y1 - y0 <= 0.01) return;
    const c = (a + b) / 2, hy = y1 - y0;
    if (axis === "x") box(L, hy, thick, m, c, y0 + hy / 2, fixed); else box(thick, hy, L, m, fixed, y0 + hy / 2, c);
  };
  for (const [a, b] of segs) { place(a, b, 0, h, mat, t); if (dado) place(a, b, 0, 1.3, M.zellij, t + 0.06); }
  for (const d of ds) place(d.at - d.w / 2, d.at + d.w / 2, d.h, h, lintel, t);
}

// Lobed arcade: columns + lace arch panels between them
const colGeo = mergeGeometries([
  new THREE.CylinderGeometry(0.11, 0.13, 2.7, 14).translate(0, 1.35, 0),
  new THREE.BoxGeometry(0.34, 0.12, 0.34).translate(0, 0.06, 0),
  new THREE.CylinderGeometry(0.16, 0.11, 0.18, 14).translate(0, 2.78, 0),
  new THREE.BoxGeometry(0.3, 0.26, 0.3).translate(0, 3.0, 0),
]);
const archGeo = new THREE.PlaneGeometry(1, 1);
function arcade(points, { arch = true, archH = 1.5, capY = 3.13 } = {}) {
  const cols = new THREE.InstancedMesh(colGeo, M.column, points.length);
  cols.castShadow = cols.receiveShadow = true;
  const mtx = new THREE.Matrix4();
  points.forEach(([x, z], i) => { mtx.makeTranslation(x, 0, z); cols.setMatrixAt(i, mtx); });
  scene.add(cols);
  if (!arch) return;
  const spans = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[i + 1];
    const L = Math.hypot(x2 - x1, z2 - z1); if (L > 4.5 || L < 0.35) continue;
    spans.push([x1, z1, x2, z2, L]);
  }
  const arches = new THREE.InstancedMesh(archGeo, M.arch, spans.length);
  arches.castShadow = true;
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  spans.forEach(([x1, z1, x2, z2, L], i) => {
    e.set(0, -Math.atan2(z2 - z1, x2 - x1), 0); q.setFromEuler(e);
    p.set((x1 + x2) / 2, capY + archH / 2, (z1 + z2) / 2); s.set(L, archH, 1);
    mtx.compose(p, q, s); arches.setMatrixAt(i, mtx);
  });
  scene.add(arches);
}
function line(x1, z1, x2, z2, n) { const pts = []; for (let i = 0; i <= n; i++) pts.push([x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n]); return pts; }

function gableRoof(x, z, w, d, y, rise = 1.6, alongX = true) {
  // simple two-slope roof made from two tilted slabs
  const len = alongX ? w : d, span = alongX ? d : w;
  const slope = Math.hypot(span / 2, rise), ang = Math.atan2(rise, span / 2);
  for (const sgn of [-1, 1]) {
    const m = box(alongX ? len + 0.6 : slope + 0.3, 0.18, alongX ? slope + 0.3 : len + 0.6, M.roof, 0, 0, 0, 1.2);
    if (alongX) { m.rotation.x = sgn * ang; m.position.set(x, y + rise / 2, z + sgn * span / 4); }
    else { m.rotation.z = -sgn * ang; m.position.set(x + sgn * span / 4, y + rise / 2, z); }
  }
}
function crenels(x1, z1, x2, z2, y, mat = M.plaster) {
  const L = Math.hypot(x2 - x1, z2 - z1), n = Math.floor(L / 1.4);
  for (let i = 0; i <= n; i++) { const t = i / n; box(0.7, 0.9, 0.7, mat, x1 + (x2 - x1) * t, y + 0.45, z1 + (z2 - z1) * t, 2, { receive: false }); }
}

// ---------------------------------------------------------------------------
// Ground, ravine, mountains
// ---------------------------------------------------------------------------
plane(160, 400, M.grass, -14, 0, 0, 8);            // west of ravine (palace hill)
plane(260, 400, M.grass, 225, 0, 0, 8);            // east (Generalife hill)
plane(24, 400, M.dirt, 82, -9, 0, 6);              // ravine floor
for (const [x, s] of [[68.5, 1], [95.5, -1]]) {   // ravine slopes
  const g = new THREE.PlaneGeometry(13.5, 400); const m = new THREE.Mesh(g, M.grass);
  m.rotation.order = "ZXY"; m.rotation.x = -Math.PI / 2; m.rotation.y = s * Math.atan2(9, 11);
  m.position.set(x + s * 1.5, -4.5, 0); m.receiveShadow = true; scene.add(m);
}
// footpaths
for (const [x, z, w, d] of [[59, 10, 14, 3], [100.5, 10, 13, 3], [107, 19, 3, 21]]) plane(w, d, M.dirt, x, 0.02, z, 3);
// stone bridge over the ravine
box(30, 0.6, 3.4, M.stone, 81, -0.3, 10, 2);
for (const x of [74, 81, 88]) box(1.6, 9, 3.4, M.stone, x, -4.8, 10, 2);
box(30, 0.9, 0.3, M.stone, 81, 0.45, 8.4, 2); box(30, 0.9, 0.3, M.stone, 81, 0.45, 11.6, 2);

// Sierra Nevada on the horizon
{
  const g = new THREE.ConeGeometry(1, 1, 7, 6);
  const pos = g.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 0.5; pos.setX(i, pos.getX(i) * (1 + (rand() - .5) * .25)); pos.setZ(i, pos.getZ(i) * (1 + (rand() - .5) * .25));
    const c = y > 0.72 ? [0.95, 0.96, 0.98] : y > 0.55 ? [0.7, 0.72, 0.74] : [0.42, 0.45, 0.42]; col.push(...c);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const mm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  for (const [x, z, r, h] of [[260, -520, 260, 150], [480, -460, 300, 190], [700, -560, 280, 170], [120, -620, 220, 120], [900, -420, 260, 140]]) {
    const m = new THREE.Mesh(g, mm); m.scale.set(r, h, r * .8); m.position.set(x, h / 2 - 8, z); scene.add(m);
  }
}

// ---------------------------------------------------------------------------
// STOP 1 · Mexuar  (x -36..-20, z -6..6)
// ---------------------------------------------------------------------------
plane(16, 12, M.marble, -28, 0.01, 0, 2);
wall("x", -6, -36, -20, { h: 7.5 });
wall("x", 6, -36, -20, { h: 7.5 });
wall("z", -36, -6, 6, { h: 7.5 });
wall("z", -20, -6, 6, { h: 7.5, doors: [{ at: 0, w: 2.4, h: 4 }] });
box(16.8, 0.4, 12.8, M.plaster, -28, 7.7, 0);                       // roof slab
gableRoof(-28, 0, 16.8, 12.8, 7.9, 1.8, true);
box(15.4, 0.12, 11.4, M.cedar, -28, 7.4, 0, 3, { cast: false });    // carved wooden ceiling
for (const [x, z] of [[-30.5, -2.5], [-25.5, -2.5], [-30.5, 2.5], [-25.5, 2.5]]) {
  const c = new THREE.Mesh(colGeo, M.column); c.scale.set(1.3, 1.6, 1.3); c.position.set(x, 0, z); c.castShadow = true; scene.add(c);
}
// gallery balcony along the west wall
box(2.2, 0.25, 11.4, M.wood, -34.8, 4.6, 0, 1);
for (let z = -5.2; z <= 5.2; z += 0.55) box(0.06, 0.9, 0.06, M.wood, -33.75, 5.2, z, 1);
box(0.1, 0.1, 11.4, M.wood, -33.75, 5.68, 0, 1);
// clerestory windows
for (const z of [-3.5, 0, 3.5]) box(0.1, 1.1, 1, M.window, -35.6, 6.3, z, 1, { cast: false });
const mexLight = new THREE.PointLight(0xffd9a8, 60, 22, 1.6); mexLight.position.set(-28, 6, 0); scene.add(mexLight);
// passage from Mexuar to the Court of the Myrtles
plane(4.6, 2.6, M.marble, -18, 0.01, 0, 2);
box(4.6, 4.2, 0.4, M.stucco, -18, 2.1, -1.5); box(4.6, 4.2, 0.4, M.stucco, -18, 2.1, 1.5); box(4.6, 0.3, 3.4, M.plaster, -18, 4.3, 0);

// ---------------------------------------------------------------------------
// STOP 2 · Court of the Myrtles (x -11.5..11.5, z -21..21)
// ---------------------------------------------------------------------------
for (const [w, d, x, z] of [[7.7, 42, -7.65, 0], [7.7, 42, 7.65, 0], [7.6, 4.7, 0, -18.65], [7.6, 4.7, 0, 18.65]]) plane(w, d, M.marble, x, 0.05, z, 2);
// reflecting pool with marble rim
const poolMirror = new Reflector(new THREE.PlaneGeometry(7, 32), {
  textureWidth: Math.floor(window.innerWidth * 0.6), textureHeight: Math.floor(window.innerHeight * 0.6), color: 0x8aa6a8, clipBias: 0.003,
});
poolMirror.rotation.x = -Math.PI / 2; poolMirror.position.set(0, 0.03, 0); scene.add(poolMirror);
box(7.6, 0.18, 0.3, M.marble, 0, 0.0, -16.15); box(7.6, 0.18, 0.3, M.marble, 0, 0.0, 16.15);
box(0.3, 0.18, 32.6, M.marble, -3.65, 0.0, 0); box(0.3, 0.18, 32.6, M.marble, 3.65, 0.0, 0);
// myrtle hedges
box(1.1, 1.15, 31, M.hedge, -4.6, 0.58, 0, 1); box(1.1, 1.15, 31, M.hedge, 4.6, 0.58, 0, 1);
// long side buildings
for (const s of [-1, 1]) {
  const xi = s * 11.5, xo = s * 16;
  wall("z", xi, -21, 21, { h: 10, mat: M.white, doors: s < 0 ? [{ at: 0, w: 2.6, h: 4.2 }] : [{ at: 19.5, w: 2.6, h: 4.2 }] });
  wall("z", xo, -21, 21, { h: 10, mat: M.plaster, dado: false, doors: s < 0 ? [{ at: 0, w: 2.6, h: 4.2 }] : [{ at: 19.5, w: 2.6, h: 4.2 }] });
  box(5.2, 0.4, 42.4, M.plaster, s * 13.75, 10.2, 0);
  gableRoof(s * 13.75, 0, 5.2, 42.4, 10.4, 1.5, false);
  // windows and latticed doors facing the court
  for (let z = -16; z <= 16; z += 4) {
    if (Math.abs(z) < 2 && s < 0) continue;
    box(0.1, 1.4, 1, M.dark, xi - s * 0.4, 6.6, z, 1, { cast: false });
    box(0.12, 2.6, 1.2, M.wood, xi - s * 0.36, 1.3 + 0.05, z, 1, { cast: false });
  }
}
// north and south porticos (7 lobed arches each)
for (const s of [-1, 1]) {
  const zc = s * 18.2;
  arcade(line(-8.4, zc, 8.4, zc, 7));
  box(18.2, 0.9, 0.5, M.stucco, 0, 5.15, zc);            // band above arches
  box(23, 0.35, 3.2, M.plaster, 0, 5.75, s * 19.6);      // portico roof
  plane(23, 2.8, M.marble, 0, 0.015, s * 19.6, 2);
}
wall("x", 21, -11.5, 11.5, { h: 12, mat: M.white });                    // south wall (towards Palace of Charles V)
box(23, 0.4, 0.8, M.plaster, 0, 12.2, 21);
// north pavilion on top of the portico, leading to the tower
box(23, 6, 0.6, M.stucco, 0, 9, -21.3);

// ---------------------------------------------------------------------------
// STOP 3 · Hall of the Ambassadors, inside the Comares Tower (x -6..6, z -33..-21)
// ---------------------------------------------------------------------------
plane(12, 12, M.marble, 0, 0.012, -27, 2);
wall("x", -21, -6.3, 6.3, { h: 15, doors: [{ at: 0, w: 2.6, h: 5 }], mat: M.stucco });
wall("x", -33, -6.3, 6.3, { h: 15 });
wall("z", -6.3, -33, -21, { h: 15 });
wall("z", 6.3, -33, -21, { h: 15 });
// tower exterior shell (taller, red plaster)
for (const [w, d, x, z] of [[14.4, 1, 0, -33.7], [1, 14.4, -7.2, -27], [1, 14.4, 7.2, -27]]) box(w, 26, d, M.plaster, x, 13, z, 3);
for (const x of [-4.25, 4.25]) box(5.9, 26, 1, M.plaster, x, 13, -20.3, 3);
box(2.6, 21, 1, M.plaster, 0, 15.5, -20.3, 3);
box(14.4, 0.6, 14.4, M.plaster, 0, 26.3, -27);
crenels(-7, -20.3, 7, -20.3, 26.6); crenels(-7, -33.7, 7, -33.7, 26.6); crenels(-7.2, -33.5, -7.2, -20.5, 26.6); crenels(7.2, -33.5, 7.2, -20.5, 26.6);
// carved cedar dome: an inverted pyramid of stars
{
  const g = new THREE.ConeGeometry(8.6, 4.5, 4, 1, true);
  { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); uv.setXY(i, (x * 0.7071 - z * 0.7071) * 0.45, (x * 0.7071 + z * 0.7071) * 0.45); } }
  const m = new THREE.Mesh(g, M.cedar); m.rotation.y = Math.PI / 4; m.position.set(0, 15 + 2.25, -27); scene.add(m);
  for (const z of [-33, -21]) box(12.6, 0.7, 0.8, M.wood, 0, 14.9, z, 2);
  for (const x of [-6, 6]) box(0.8, 0.7, 12.6, M.wood, x, 14.9, -27, 2);
  const lid = box(12.6, 0.3, 12.6, M.plaster, 0, 19.6, -27); lid.castShadow = true;
}
// window alcoves (three per side) and the sultan's throne niche
for (const s of [-1, 1]) for (const z of [-30.5, -27, -23.5]) {
  box(0.2, 3.2, 1.6, M.window, s * 6.0, 2.8, z, 1, { cast: false });
  box(0.2, 1.2, 1, M.window, s * 6.0, 11.5, z, 1, { cast: false });
}
for (const x of [-3.5, 3.5]) box(1.6, 3.2, 0.2, M.window, x, 2.8, -32.7, 1, { cast: false });
box(2.2, 4.2, 0.25, M.window, 0, 3.2, -32.7, 1, { cast: false });
box(2.4, 0.5, 1.4, M.wood, 0, 0.25, -31.8, 1);
const ambA = new THREE.PointLight(0xffd7a0, 45, 30, 1.6); ambA.position.set(0, 9, -27); scene.add(ambA);
const ambB = new THREE.SpotLight(0xffe9c8, 180, 30, 0.55, 0.7, 1.3); ambB.position.set(0, 3, -27); ambB.target.position.set(0, 18, -28); scene.add(ambB, ambB.target);

// ---------------------------------------------------------------------------
// STOP 4 · Court of the Lions (x 22.5..51.5, z 2..18)
// ---------------------------------------------------------------------------
plane(29, 16, M.dirt, 37, 0.01, 10, 3);
plane(29, 3, M.marble, 37, 0.015, 3.5, 2); plane(29, 3, M.marble, 37, 0.015, 16.5, 2);
plane(3, 10, M.marble, 24, 0.015, 10, 2); plane(3, 10, M.marble, 50, 0.015, 10, 2);
wall("x", 2, 22.5, 51.5, { h: 9, doors: [{ at: 37, w: 2.6, h: 4.4 }] });
wall("x", 18, 22.5, 51.5, { h: 9, doors: [{ at: 37, w: 2.4, h: 4.2 }] });
wall("z", 22.5, 2, 18, { h: 9, doors: [{ at: 10, w: 2.6, h: 4.2 }] });
wall("z", 51.5, 2, 18, { h: 9, doors: [{ at: 10, w: 2.6, h: 4.2 }] });
for (const [w, d, x, z] of [[30, 6, 37, -1], [30, 6, 37, 21], [6, 22, 19.5, 10], [6, 22, 54.5, 10]]) {
  if (z !== 21) continue; // north = Two Sisters; west/east stay open for the walking route
  box(w, 9, d, M.plaster, x, 4.5, z, 3);
  gableRoof(x, z, w, d, 9, 1.6, w > d);
}
// galleries: columns around the court (single and paired, like the real 124)
{
  const pts = [], x0 = 25.5, x1 = 48.5, z0 = 5, z1 = 15;
  const runs = [line(x0, z0, x1, z0, 18), line(x0, z1, x1, z1, 18), line(x0, z0, x0, z1, 8), line(x1, z0, x1, z1, 8)];
  for (const r of runs) arcade(r);
  for (const r of runs) for (let i = 0; i < r.length; i += 3) pts.push([r[i][0] + 0.32, r[i][1]]);
  arcade(pts, { arch: false });
  // gallery roofs
  for (const [w, d, x, z] of [[29, 3.4, 37, 3.5], [29, 3.4, 37, 16.5], [3.4, 10, 24, 10], [3.4, 10, 50, 10]]) {
    box(w, 0.35, d, M.cedar, x, 4.75, z, 2); gableRoof(x, z, w, d, 4.9, 0.9, w > d);
  }
  // pavilions projecting at the east and west ends
  for (const px of [27.6, 46.4]) {
    const c = [[px - 1.6, 8.4], [px + 1.6, 8.4], [px + 1.6, 11.6], [px - 1.6, 11.6], [px - 1.6, 8.4]];
    arcade(c); box(3.8, 0.4, 3.8, M.cedar, px, 4.8, 10, 2);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(3, 2.2, 4), M.roof); pyr.rotation.y = Math.PI / 4; pyr.position.set(px, 6.1, 10); pyr.castShadow = true; scene.add(pyr);
  }
}
// four water channels and the Lion Fountain
for (const [w, d, x, z] of [[9.5, 0.35, 31.5, 10], [9.5, 0.35, 42.5, 10], [0.35, 7, 37, 5.3], [0.35, 7, 37, 14.7]]) box(w, 0.05, d, M.waterFlat, x, 0.03, z, 1, { cast: false });
{
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.5, 0.35, 12), M.marble); basin.position.set(37, 1.25, 10); basin.castShadow = true; scene.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 24), M.waterFlat); water.position.set(37, 1.42, 10); scene.add(water);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.3, 12), M.marble); stem.position.set(37, 1.9, 10); stem.castShadow = true; scene.add(stem);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.2, 12), M.marble); top.position.set(37, 2.6, 10); scene.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.22, 8, 36), M.marble); ring.rotation.x = Math.PI / 2; ring.position.set(37, 0.12, 10); scene.add(ring);
  const ringWater = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.7, 36), M.waterFlat); ringWater.rotation.x = -Math.PI / 2; ringWater.position.set(37, 0.06, 10); scene.add(ringWater);
  // 12 lions
  const lion = new THREE.Group();
  const lm = new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.45 });
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, lm); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; lion.add(m); };
  add(new THREE.CapsuleGeometry(0.22, 0.45, 6, 12), 0, 0.62, 0, 1, 1, 1); lion.children[0].rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.26, 14, 12), 0, 0.85, 0.42, 1.1, 1.05, 0.9);
  add(new THREE.SphereGeometry(0.15, 12, 10), 0, 0.82, 0.62, 1, 0.85, 1);
  for (const [x, z] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.3], [0.14, -0.3]]) add(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 8), x, 0.25, z);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; const l = lion.clone();
    l.position.set(37 + Math.cos(a) * 1.25, 0, 10 + Math.sin(a) * 1.25); l.rotation.y = Math.PI / 2 - a; scene.add(l);
  }
}

// ---------------------------------------------------------------------------
// STOP 5 · Hall of the Two Sisters with its muqarnas dome (x 32..42, z -9..2)
// ---------------------------------------------------------------------------
plane(10, 11, M.marble, 37, 0.012, -3.5, 2);
wall("z", 31.7, -9.3, 2, { h: 13 }); wall("z", 42.3, -9.3, 2, { h: 13 });
wall("x", -9.3, 31.7, 42.3, { h: 13, doors: [{ at: 37, w: 2.4, h: 4 }] });
box(11.3, 4, 0.7, M.stucco, 37, 11, 2);
for (const [w, d, x, z] of [[11.4, 0.8, 37, -9.9], [0.8, 12, 31, -3.6], [0.8, 12, 43, -3.6]]) box(w, 15, d, M.plaster, x, 7.5, z, 3);
box(4, 6, 4, M.plaster, 37, 3, -12.2, 2);                // Mirador de Lindaraja block
box(1.4, 2.6, 0.2, M.window, 37, 1.9, -9.6, 1, { cast: false });
// central fountain + the two marble slabs
const sf = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 24), M.marble); sf.position.set(37, 0.06, -3.6); scene.add(sf);
const sfw = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.13, 24), M.waterFlat); sfw.position.set(37, 0.08, -3.6); scene.add(sfw);
box(1.2, 0.03, 2.4, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }), 35.6, 0.03, -3.6, 1, { cast: false });
box(1.2, 0.03, 2.4, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }), 38.4, 0.03, -3.6, 1, { cast: false });
// octagonal drum with windows
{
  const R = 5, cy = -3.6;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const seg = box(2 * R * Math.tan(Math.PI / 8) + 0.05, 4, 0.5, M.stucco, 37 + Math.cos(a) * R, 11, cy + Math.sin(a) * R, 1.5);
    seg.rotation.y = -a + Math.PI / 2;
    const w = box(0.9, 1.3, 0.1, M.window, 37 + Math.cos(a) * (R - 0.28), 10.6, cy + Math.sin(a) * (R - 0.28), 1, { cast: false });
    w.rotation.y = -a + Math.PI / 2;
  }
  for (const [x, z] of [[33.2, -7.7], [40.8, -7.7], [33.2, 0.5], [40.8, 0.5]]) { const q = box(3.2, 4.2, 3.2, M.stucco, x, 11, z, 1.5); q.rotation.y = Math.PI / 4; }
  const shell = new THREE.Mesh(new THREE.SphereGeometry(5.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a4a38, side: THREE.DoubleSide, roughness: 1 }));
  shell.scale.set(1, 0.9, 1); shell.position.set(37, 12.9, cy); scene.add(shell);
  // muqarnas: thousands of small cells in rings, tilting inward as they rise
  const cellGeo = new THREE.ConeGeometry(0.27, 0.36, 6, 1, true).translate(0, 0.18, 0);
  const tiers = 13, cells = [];
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const r = 4.7 * Math.cos(k * Math.PI / 2 * 0.96) + 0.25;
    const y = 12.9 + Math.sin(k * Math.PI / 2) * 4.2;
    const n = Math.max(8, Math.round(2 * Math.PI * r / 0.46 / 8) * 8);
    for (let i = 0; i < n; i++) cells.push([r, y, i / n * Math.PI * 2 + (t % 2) * Math.PI / n, k, t]);
  }
  const inst = new THREE.InstancedMesh(cellGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), cells.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  cells.forEach(([r, y, a, k, t], i) => {
    const p = new THREE.Vector3(37 + Math.cos(a) * r, y, cy + Math.sin(a) * r);
    const dir = p.clone().sub(new THREE.Vector3(37, y - 3.2 + k * 2.4, cy)).normalize();   // niche opens toward the room
    q.setFromUnitVectors(Y, dir);
    mtx.compose(p, q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, mtx);
    const tint = t % 3 === 0 ? 0xcfe0e6 : t % 3 === 1 ? 0xf1e2c4 : 0xe5cf9f; col.set(tint).multiplyScalar(0.85 + rand() * 0.25); inst.setColorAt(i, col);
  });
  scene.add(inst);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.stucco); cap.position.set(37, 16.9, cy); cap.material.side = THREE.DoubleSide; scene.add(cap);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 8), M.roof); roof.position.set(37, 19, cy); roof.castShadow = true; scene.add(roof);
  const sl = new THREE.PointLight(0xffe2b0, 30, 26, 1.6); sl.position.set(37, 6, cy); scene.add(sl);
  const up = new THREE.SpotLight(0xfff0d0, 110, 24, 0.6, 0.6, 1.3); up.position.set(37, 1, cy); up.target.position.set(37, 18, cy); scene.add(up, up.target);
}

// ---------------------------------------------------------------------------
// STOP 6 · Generalife, Patio de la Acequia (x 108.5..121.5, z -24..24)
// ---------------------------------------------------------------------------
plane(5.5, 48, M.dirt, 111.25, 0.05, 0, 3); plane(5.5, 48, M.dirt, 118.75, 0.05, 0, 3); plane(1.6, 1.2, M.dirt, 115, 0.01, 23.6, 3); plane(1.6, 1.2, M.dirt, 115, 0.01, -23.6, 3);
const acequia = new Reflector(new THREE.PlaneGeometry(1.6, 46), {
  textureWidth: Math.floor(window.innerWidth * 0.5), textureHeight: Math.floor(window.innerHeight * 0.5), color: 0x7d9ea0, clipBias: 0.003,
});
acequia.rotation.x = -Math.PI / 2; acequia.position.set(115, 0.03, 0); scene.add(acequia);
box(0.25, 0.25, 46.5, M.marble, 114.05, 0.02, 0); box(0.25, 0.25, 46.5, M.marble, 115.95, 0.02, 0);
// hedged flower beds
for (const s of [-1, 1]) {
  const xc = 115 + s * 3.6;
  box(3.4, 0.6, 44, M.hedge, xc, 0.3, 0, 1);
  box(0.4, 1.0, 44, M.hedge, 115 + s * 1.6, 0.5, 0, 1);
}
{
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 1400);
  const mtx = new THREE.Matrix4(), col = new THREE.Color(), pal = [0xc23b4b, 0xe46a8f, 0xf2f0ea, 0xe8913a, 0xb04ab0, 0xd8c23a];
  for (let i = 0; i < 1400; i++) {
    const s = i % 2 ? 1 : -1; mtx.makeTranslation(115 + s * (2.1 + rand() * 3), 0.62 + rand() * 0.12, -21.5 + rand() * 43);
    flowers.setMatrixAt(i, mtx); flowers.setColorAt(i, col.set(pal[Math.floor(rand() * pal.length)]));
  }
  scene.add(flowers);
}
// arching fountain jets
const jets = [];
{
  const geos = [];
  for (let z = -21.5; z <= 21.5; z += 1.3) for (const s of [-1, 1]) {
    const p0 = new THREE.Vector3(115 + s * 1.05, 0.1, z), p2 = new THREE.Vector3(115 + s * 0.05, 0.05, z + 0.25);
    const p1 = new THREE.Vector3(115 + s * 0.55, 1.6, z + 0.12);
    geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 14, 0.025, 5, false));
  }
  const m = new THREE.Mesh(mergeGeometries(geos), M.jet); scene.add(m); jets.push(m);
}
// arcades and pavilions
wall("z", 108.5, -24, 24, { h: 5.5, mat: M.plaster, dado: false });
for (let z = -20; z <= 20; z += 5) box(0.12, 1.4, 1.2, M.dark, 108.9, 3.4, z, 1, { cast: false });
arcade(line(121.2, -22, 121.2, 22, 18));
box(0.6, 1, 44.5, M.stucco, 121.2, 4.7, 0); box(3, 0.35, 45, M.plaster, 122.5, 5.4, 0); gableRoof(122.5, 0, 3, 45, 5.6, 0.8, false);
for (const s of [-1, 1]) {
  const zc = s * 26.5;
  arcade(line(111, zc - s * 2.2, 119, zc - s * 2.2, 5));
  box(13, 9, 4, M.plaster, 115, 4.5 + 0.0, zc + s * 0.3, 3).position.y = 4.5;
  box(9, 1, 0.5, M.stucco, 115, 4.7, zc - s * 2.2);
  gableRoof(115, zc + s * 0.3, 13, 4.4, 9, 1.6, true);
  for (const x of [112, 115, 118]) box(1.1, 1.6, 0.1, M.dark, x, 6.6, zc - s * 1.7, 1, { cast: false });
}
// open the south pavilion so the guide can walk in
scene.children.filter(o => o.isMesh && Math.abs(o.position.x - 115) < 0.01 && Math.abs(o.position.z - 26.8) < 0.01).forEach(o => scene.remove(o));
box(4.5, 9, 4, M.plaster, 110.75, 4.5, 26.8, 3); box(4.5, 9, 4, M.plaster, 119.25, 4.5, 26.8, 3); box(4, 4.6, 4, M.plaster, 115, 6.7, 26.8, 3);

// ---------------------------------------------------------------------------
// Context: outer walls and towers, Alcazaba, Palace of Charles V, trees
// ---------------------------------------------------------------------------
box(46, 17, 46, M.stone, 0, 8.5, 46, 3);                     // Palace of Charles V (square block)
for (const [x, z, w, d, h] of [[-62, 6, 12, 12, 24], [-60, -22, 10, 10, 18], [-48, 30, 9, 9, 16], [-78, -6, 14, 14, 20]]) {
  box(w, h, d, M.plaster, x, h / 2, z, 3); crenels(x - w / 2, z - d / 2, x + w / 2, z - d / 2, h); crenels(x - w / 2, z + d / 2, x + w / 2, z + d / 2, h);
}
box(1.6, 9, 60, M.plaster, -54, 4.5, -2, 3); box(40, 9, 1.6, M.plaster, -34, 4.5, -38, 3); box(60, 9, 1.6, M.plaster, 10, 4.5, -40, 3);
for (const [x, z] of [[-34, -38], [-10, -40], [22, -40], [58, -24], [60, 30]]) { box(6, 13, 6, M.plaster, x, 6.5, z, 3); crenels(x - 3, z - 3, x + 3, z - 3, 13); }
box(1.6, 9, 50, M.plaster, 60, 4.5, 4, 3);
{
  const cyp = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 8, 9).translate(0, 4.6, 0), new THREE.MeshStandardMaterial({ color: 0x24391f, roughness: 1 }), 220);
  cyp.castShadow = true;
  const mtx = new THREE.Matrix4(); let n = 0;
  const put = (x, z, s = 1) => { if (n < 220) { mtx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s)); cyp.setMatrixAt(n++, mtx); } };
  for (let z = -22; z <= 22; z += 4) { put(106.6, z, 0.9); put(124.8, z, 0.9); }
  for (let i = 0; i < 70; i++) put(96 + rand() * 60, -60 + rand() * 120, 0.8 + rand() * 0.6);
  for (let i = 0; i < 60; i++) { const x = -60 + rand() * 130, z = 50 + rand() * 70; put(x, z, 0.8 + rand() * 0.6); }
  for (let i = 0; i < 40; i++) put(62 + rand() * 4, -40 + rand() * 90, 0.8 + rand() * 0.5);
  cyp.count = n; scene.add(cyp);
}

// ---------------------------------------------------------------------------
// Performance: merge static meshes that share a material into one draw call
// ---------------------------------------------------------------------------
{
  const groups = new Map();
  for (const o of [...scene.children]) {
    if (!o.isMesh || o.isInstancedMesh || o instanceof Reflector || !o.material.isMeshStandardMaterial || o.material === M.jet) continue;
    const key = o.material.uuid + "|" + o.castShadow + "|" + Object.keys(o.geometry.attributes).sort().join(",") + "|" + !!o.geometry.index;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { o.updateMatrixWorld(true); return o.geometry.clone().applyMatrix4(o.matrixWorld); });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material);
    m.castShadow = list[0].castShadow; m.receiveShadow = true;
    scene.add(m);
    list.forEach(o => scene.remove(o));
  }
}

// ---------------------------------------------------------------------------
// The tour guide (procedural animated character)
// ---------------------------------------------------------------------------
function makeGuide() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc58c64, roughness: 0.6 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x4b3417, roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0xb6a07a, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.5 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.9 });
  const mk = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const torso = mk(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), jacket, 0, 1.28, 0); torso.scale.set(1.15, 1, 0.75);
  mk(new THREE.BoxGeometry(0.16, 0.36, 0.05), shirt, 0, 1.36, 0.14);
  mk(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin, 0, 1.66, 0);
  const head = mk(new THREE.SphereGeometry(0.13, 20, 16), skin, 0, 1.8, 0.01); head.scale.set(0.92, 1.08, 1);
  const hr = mk(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.83, -0.01); hr.scale.set(0.95, 1, 1.02);
  for (const x of [-0.045, 0.045]) mk(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a120c }), x, 1.82, 0.125);
  // lanyard + badge
  mk(new THREE.BoxGeometry(0.08, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xcdbfa8 }), 0.06, 1.2, 0.16);
  const limb = (len, r, mat, x, y, endMat, endGeo) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); g.add(pivot);
    const upper = mk(new THREE.CapsuleGeometry(r, len, 4, 10), mat, 0, -len / 2 - r, 0, pivot);
    const end = mk(endGeo, endMat, 0, -len - r * 2.2, 0, pivot);
    return { pivot, upper, end };
  };
  const legL = limb(0.72, 0.075, pants, -0.1, 0.98, shoe, new THREE.BoxGeometry(0.11, 0.08, 0.26).translate(0, 0, 0.05));
  const legR = limb(0.72, 0.075, pants, 0.1, 0.98, shoe, new THREE.BoxGeometry(0.11, 0.08, 0.26).translate(0, 0, 0.05));
  const armL = limb(0.5, 0.055, jacket, -0.27, 1.56, skin, new THREE.SphereGeometry(0.05, 10, 8));
  const armR = limb(0.5, 0.055, jacket, 0.27, 1.56, skin, new THREE.SphereGeometry(0.05, 10, 8));
  g.userData = { legL, legR, armL, armR, torso, head, phase: 0 };
  return g;
}
const guide = makeGuide();
scene.add(guide);

function animateGuide(dt, speed, pointing) {
  const u = guide.userData;
  u.phase += dt * speed * 4.2;
  const amp = Math.min(1, speed / 1.4) * 0.55;
  const s = Math.sin(u.phase);
  u.legL.pivot.rotation.x = s * amp; u.legR.pivot.rotation.x = -s * amp;
  u.armL.pivot.rotation.x = -s * amp * 0.8; u.armR.pivot.rotation.x = pointing ? -2.3 : s * amp * 0.8;
  u.armR.pivot.rotation.z = pointing ? 0.15 : 0;
  guide.children.forEach(c => { if (c === u.torso) c.position.y = 1.28 + Math.abs(Math.cos(u.phase)) * 0.03 * (amp > 0.05 ? 1 : 0); });
  if (speed < 0.05) { u.legL.pivot.rotation.x *= 0.8; u.legR.pivot.rotation.x *= 0.8; }
}

// ---------------------------------------------------------------------------
// Tour route and stops
// ---------------------------------------------------------------------------
const STOPS = [
  { name: "Mexuar", sub: "Council hall · where the sultan heard petitions",
    look: ["Zellij tile dado", "Carved wooden ceiling", "Gallery balcony", "Four columns"],
    script: "Our tour begins where the sultan did business. Ministers met here and the sultan heard petitions and gave justice. Look at the bands of star-pattern tiles and the carved wooden ceiling above.",
    cam: [-21.6, 2.1, 0.2], look3: [-36, 3.6, 0] },
  { name: "Court of the Myrtles", sub: "Comares Palace · Yusuf I, 1300s",
    look: ["Reflecting pool", "Myrtle hedges", "Lobed arcades", "Comares Tower"],
    script: "The long, still pool works like a mirror, doubling the arcades and the Comares Tower so the palace seems to float. Clipped myrtle hedges line both sides.",
    cam: [0, 1.6, 20.3], look3: [0, 6.5, -30] },
  { name: "Hall of the Ambassadors", sub: "Throne room · inside the Comares Tower",
    look: ["Cedar star ceiling", "Stucco walls", "Window alcoves", "Throne niche"],
    script: "Look up! This is the largest hall in the palaces, where the sultan received foreign ambassadors. The cedar ceiling of thousands of wooden stars represents the seven heavens.",
    cam: [2.2, 1.3, -22.6], look3: [-0.5, 16.5, -28.5] },
  { name: "Court of the Lions", sub: "Private palace · Muhammad V, late 1300s",
    look: ["124 marble columns", "Fountain of 12 lions", "Four water channels", "Lace-like arches"],
    script: "This was the sultan’s private palace. Slender marble columns hold up arches carved like lace. Twelve lions carry the fountain, and four channels divide the court like a paradise garden.",
    cam: [26.5, 2.4, 14.2], look3: [38, 1.4, 9.5] },
  { name: "Hall of the Two Sisters", sub: "Private hall · north of the Court of the Lions",
    look: ["Muqarnas dome", "Twin marble slabs", "Poetry on the walls", "Window to Lindaraja"],
    script: "Look up again at one of the most famous muqarnas domes in the world: thousands of honeycomb cells that break the light into a glowing pattern. The two marble floor slabs give the room its name.",
    cam: [38.6, 1.2, -0.4], look3: [37, 14.5, -4.2] },
  { name: "Generalife", sub: "Summer palace · Patio de la Acequia",
    look: ["Water channel", "Arching fountain jets", "Flower gardens", "Arcades"],
    script: "Across the ravine is the sultans’ summer retreat. The Patio de la Acequia is a long water channel lined with arching jets, flowers and arcades, fed by the Royal Canal.",
    cam: [115, 2.3, 27.4], look3: [114.6, 0.8, -14] },
];

// waypoints: [x, z, stopIndex?, fast?]
const ROUTE = [
  [-31.5, 3.4, 0],
  [-24, 0], [-18, 0], [-13.8, 0], [-8, 0], [-8, 17.3], [-1.6, 17.3, 1],
  [-6, 16], [-7.5, -15], [-2.4, -16.8], [-2.4, -19.6], [0, -21.4], [0, -24.6, 2],
  [0, -21.4], [2.4, -19.6], [2.4, -16.8], [6.9, -15], [6.9, 17.2], [7.2, 19.6], [13.8, 19.6], [19, 19.6], [19, 10.6], [22.5, 10.6], [25.6, 10.6], [28, 12.6, 3],
  [31, 7.2], [37.8, 6.4], [37.8, 3.6], [37.2, 1.2], [37, -1.2], [36, -1.6, 4],
  [37.2, 1.2], [37.8, 3.6], [37.8, 6.2], [43.5, 7.2], [44.5, 10.6], [51.5, 10.6], [56, 10.6, null, 1], [66, 10.4, null, 1], [96, 10.4, null, 1], [104, 10.4, null, 1], [107, 15, null, 1], [107, 29.5, null, 1], [115, 29.5], [115, 25.5], [112.6, 23.6, 5],
];
const stopWaypoint = STOPS.map((_, i) => ROUTE.findIndex(w => w[2] === i));

const state = {
  seg: 0, pos: new THREE.Vector3(ROUTE[0][0], 0, ROUTE[0][1]), yaw: Math.PI, mode: "intro",
  stop: -1, waitT: 0, playing: false, free: false, visited: new Set(),
};
guide.position.copy(state.pos);
guide.rotation.y = 0.6;

const WALK = 1.45, FAST = 6.5;
function stepRoute(dt) {
  if (state.seg >= ROUTE.length - 1) return 0;
  const tgt = ROUTE[state.seg + 1];
  const to = new THREE.Vector3(tgt[0], 0, tgt[1]);
  const d = to.clone().sub(state.pos); d.y = 0;
  const dist = d.length();
  const fast = tgt[3] || ROUTE[state.seg][3];
  const v = fast ? FAST : WALK;
  if (dist < v * dt) {
    state.pos.copy(to); state.seg++;
    if (tgt[2] != null) arriveAt(tgt[2]);
    return v;
  }
  d.normalize(); state.pos.addScaledVector(d, v * dt);
  const desired = Math.atan2(d.x, d.z);
  state.yaw = lerpAngle(state.yaw, desired, 1 - Math.exp(-dt * 8));
  return v;
}
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const stopsEl = $("stops");
STOPS.forEach((s, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button data-i="${i}" title="${s.name}"><b>${i + 1}</b><span>${s.name}</span></button>`;
  stopsEl.appendChild(li);
});
stopsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) jumpTo(Number(b.dataset.i)); });

function renderCard() {
  const i = state.stop;
  stopsEl.querySelectorAll("button").forEach((b, k) => { b.classList.toggle("on", k === i && state.mode === "stop"); b.classList.toggle("done", state.visited.has(k)); });
  const main = $("btn-main");
  if (state.mode === "intro") return;
  if (state.mode === "end") {
    $("card-eyebrow").textContent = "TOUR COMPLETE";
    $("card-title").textContent = "Thanks for visiting!";
    $("card-sub").textContent = "Roadrunners Realty · ready to schedule your private showing";
    $("card-look").innerHTML = "";
    $("card-script").textContent = "You walked from the council hall through the royal palaces and out to the summer gardens. Click any stop above to revisit it.";
    main.textContent = "Restart"; return;
  }
  if (state.mode === "walk") {
    const next = STOPS[nextStopIndex()];
    $("card-eyebrow").textContent = "WALKING…";
    $("card-title").textContent = next ? `To ${next.name}` : "Walking";
    $("card-sub").textContent = next ? `Next: stop ${nextStopIndex() + 1} of ${STOPS.length}` : "";
    $("card-look").innerHTML = "";
    $("card-script").textContent = "Follow our guide through the palace.";
    main.textContent = state.playing ? "Pause" : "Resume"; return;
  }
  const s = STOPS[i];
  $("card-eyebrow").textContent = `STOP ${i + 1} OF ${STOPS.length}`;
  $("card-title").textContent = s.name;
  $("card-sub").textContent = s.sub;
  $("card-look").innerHTML = s.look.map(l => `<li>${l}</li>`).join("");
  $("card-script").textContent = s.script;
  main.textContent = i === STOPS.length - 1 ? "Finish" : "Continue";
}
function nextStopIndex() { for (let k = state.seg + 1; k < ROUTE.length; k++) if (ROUTE[k][2] != null) return ROUTE[k][2]; return -1; }

function arriveAt(i) {
  state.mode = "stop"; state.stop = i; state.waitT = 0; state.visited.add(i);
  renderCard();
}
function continueTour() {
  if (state.mode === "intro") { state.mode = "stop"; state.stop = 0; state.visited.add(0); state.playing = true; renderCard(); return; }
  if (state.mode === "end") { jumpTo(0); return; }
  if (state.mode === "stop") {
    if (state.stop === STOPS.length - 1) { state.mode = "end"; renderCard(); return; }
    state.mode = "walk"; state.playing = true; renderCard(); return;
  }
  if (state.mode === "walk") { state.playing = !state.playing; renderCard(); }
}
function jumpTo(i) {
  const w = stopWaypoint[i]; state.seg = w; state.pos.set(ROUTE[w][0], 0, ROUTE[w][1]);
  const prev = ROUTE[Math.max(0, w - 1)]; state.yaw = Math.atan2(ROUTE[w][0] - prev[0], ROUTE[w][1] - prev[1]);
  state.playing = true; arriveAt(i); snapCamera = true;
}
$("btn-main").addEventListener("click", continueTour);
$("btn-next").addEventListener("click", () => { const n = state.mode === "intro" ? 0 : state.mode === "stop" ? state.stop + 1 : nextStopIndex(); if (n >= 0 && n < STOPS.length) jumpTo(n); });
$("btn-prev").addEventListener("click", () => { const n = state.mode === "stop" ? state.stop - 1 : state.mode === "walk" ? nextStopIndex() - 1 : state.mode === "end" ? STOPS.length - 1 : 0; jumpTo(Math.max(0, n)); });
$("btn-cam").addEventListener("click", toggleFree);
window.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") $("btn-next").click();
  if (e.key === "ArrowLeft") $("btn-prev").click();
  if (e.key === " " && e.target === document.body) { e.preventDefault(); continueTour(); }
  if (e.key.toLowerCase() === "c") toggleFree();
});

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, canvas);
controls.enabled = false; controls.enableDamping = true; controls.maxDistance = 60; controls.minDistance = 1.5;
function toggleFree() {
  state.free = !state.free; controls.enabled = state.free;
  $("btn-cam").classList.toggle("on", state.free); $("btn-cam").textContent = state.free ? "Follow guide" : "Free look";
  $("hint").classList.toggle("show", state.free);
  if (state.free) controls.target.copy(guide.position).add(new THREE.Vector3(0, 1.5, 0));
}
let snapCamera = true;
const camLook = new THREE.Vector3(-28, 2, 0);
const introCam = { pos: new THREE.Vector3(-8, 46, 78), look: new THREE.Vector3(20, 0, -4), t: 0 };

function updateCamera(dt) {
  if (state.free) { controls.target.lerp(guide.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-dt * 3)); controls.update(); return; }
  let pos, look, k;
  if (state.mode === "intro") {
    introCam.t += dt * 0.05;
    const a = introCam.t;
    pos = new THREE.Vector3(30 + Math.cos(a) * 95, 42, 6 + Math.sin(a) * 95); look = new THREE.Vector3(30, 0, 0); k = 1;
  } else if (state.mode === "stop" || state.mode === "end") {
    const s = STOPS[state.stop]; pos = new THREE.Vector3(...s.cam); look = new THREE.Vector3(...s.look3); k = 1.6;
  } else {
    const fwd = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const fast = ROUTE[state.seg + 1] && (ROUTE[state.seg + 1][3] || ROUTE[state.seg][3]);
    const back = fast ? 9 : 4.2, up = fast ? 4.5 : 2.1;
    pos = guide.position.clone().addScaledVector(fwd, -back).add(new THREE.Vector3(0, up, 0));
    look = guide.position.clone().addScaledVector(fwd, 3).add(new THREE.Vector3(0, 1.4, 0)); k = 2.6;
  }
  const t = snapCamera ? 1 : 1 - Math.exp(-dt * k); snapCamera = false;
  camera.position.lerp(pos, t); camLook.lerp(look, t); camera.lookAt(camLook);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  update(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(tick);
}
function update(dt) {
  let speed = 0;
  if (state.mode === "walk" && state.playing) {
    speed = stepRoute(dt);
    guide.position.copy(state.pos);
  }
  if (state.mode === "stop") {
    const s = STOPS[state.stop];
    const face = Math.atan2(s.look3[0] - guide.position.x, s.look3[2] - guide.position.z);
    state.yaw = lerpAngle(state.yaw, face, 1 - Math.exp(-dt * 3));
    state.waitT += dt;
    if ($("auto").checked && state.playing && state.waitT > 16 && state.stop < STOPS.length - 1) continueTour();
  }
  guide.rotation.y = state.mode === "intro" ? guide.rotation.y : state.yaw;
  animateGuide(dt, speed > 3 ? speed * 0.45 : speed, state.mode === "stop");
  // keep the sun's shadow box centred on the guide
  sun.position.copy(guide.position).addScaledVector(sunDir, 120); sun.target.position.copy(guide.position);
  jets.forEach(j => { j.material.opacity = 0.45 + Math.sin(performance.now() / 160) * 0.08; });
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderCard();
requestAnimationFrame(() => { $("loading").classList.add("done"); tick(); });
window.__tour = { state, jumpTo, STOPS, camera, guide, update, continueTour, renderer, scene, M }; // for debugging in the console
