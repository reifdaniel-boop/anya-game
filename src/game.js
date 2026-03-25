// ============================================================
//  Anya's Adventure
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 800
const H = canvas.height;  // 500

// ── Castle interior constants (needed at startup) ─────────────
const CEIL_H = 90, WALL_L = 68, WALL_R = W - 68;

// ── Input ────────────────────────────────────────────────────
const keys = {}, justPressed = {};
window.addEventListener('keydown', e => { if (!keys[e.key]) justPressed[e.key] = true; keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });
function consumeAction() {
  if (justPressed['Enter']) { justPressed['Enter'] = false; return true; }
  if (justPressed[' '])     { justPressed[' ']     = false; return true; }
  return false;
}

// ── World / Camera (garden only) ─────────────────────────────
const WORLD_W = 3200;
const CASTLE_WX = 1350; // world-x centre of castle
const cam = { x: CASTLE_WX - W / 2 }; // start showing castle

function updateCamera() {
  const target = Math.max(0, Math.min(WORLD_W - W, princess.x - W / 2));
  cam.x += (target - cam.x) * 0.1;
}

// ── Scene / Fade ──────────────────────────────────────────────
let scene      = 'garden'; // 'garden' | 'castle'
let castleRoom = 'main';   // 'main' | 'library' | 'ballroom'
let fadeAlpha  = 0, fadeDir = 0, fadePending = null;

function triggerFade(pending) {
  if (fadeDir !== 0) return;
  fadeDir = 1; fadePending = pending;
}
function updateFade() {
  if (!fadeDir) return;
  fadeAlpha = Math.max(0, Math.min(1, fadeAlpha + fadeDir * 0.06));
  if (fadeAlpha >= 1 && fadeDir === 1) {
    const p = fadePending;
    if (p.type === 'toScene') {
      scene = p.scene;
      if (scene === 'castle') { princess.x = W / 2; princess.y = H - 70; castleRoom = 'main'; }
      else                    { princess.x = CASTLE_WX; princess.y = H * 0.57 + princess.h; cam.x = CASTLE_WX - W/2; }
    } else {
      castleRoom = p.room;
      princess.x = p.fromLeft ? W - 120 : 120;
      princess.y = 310;
    }
    fadeDir = -1;
  }
  if (fadeAlpha <= 0 && fadeDir === -1) { fadeAlpha = 0; fadeDir = 0; fadePending = null; }
}
function drawFade() {
  if (fadeAlpha <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`; ctx.fillRect(0, 0, W, H);
}

// ── Princess ──────────────────────────────────────────────────
const princess = {
  x: CASTLE_WX, y: H - 140,
  w: 36, h: 54, speed: 3,
  facing: 1, frame: 0, frameTimer: 0, moving: false,
  crownStyle: 'default',
};

// ── Unicorn (garden only) ─────────────────────────────────────
const unicorn = {
  x: CASTLE_WX - 180, y: H - 130,
  w: 52, h: 42, frame: 0, frameTimer: 0,
  dir: 1, speed: 0.6, wanderTimer: 0, wanderDuration: 120,
};

// ── Castle crowns (main hall only) ────────────────────────────
const castleCrowns = [
  { x: 175, y: 275, name: 'Ruby Crown',     style: 'ruby',     color: '#FFD700', gem: '#ff1133', taken: false },
  { x: 400, y: 265, name: 'Sapphire Crown', style: 'sapphire', color: '#C0C0C0', gem: '#2255ff', taken: false },
  { x: 625, y: 275, name: 'Rose Crown',     style: 'rose',     color: '#FFB6C1', gem: '#ff66aa', taken: false },
];

// ── Garden static decorations ─────────────────────────────────
const rng = (a, b) => a + Math.random() * (b - a);

// Flowers scattered across world (avoid castle path + lake water)
const gardenFlowers = [];
for (let i = 0; i < 160; i++) {
  const wx = rng(0, WORLD_W);
  const onPath = wx > 1290 && wx < 1410;
  if (onPath) continue;
  gardenFlowers.push({
    x: wx, y: H - 82 + rng(0, 28),
    color: ['#ff88cc','#ffdd44','#ff66aa','#cc88ff','#ff99bb','#ffaaee'][i%6],
    size: 5 + rng(0, 5), stem: 8 + rng(0, 10),
  });
}

// Butterflies (meadow area)
const butterflies = Array.from({length: 9}, (_, i) => ({
  bx: 1700 + rng(0, 560), by: 340 + rng(0, 80),
  color: ['#ff88cc','#ffcc44','#cc88ff','#44ddff','#ff6644'][i%5],
  phase: rng(0, Math.PI*2), speed: 0.3 + rng(0,0.5), range: 40 + rng(0,60),
}));

// Fireflies (forest area)
const fireflies = Array.from({length: 14}, () => ({
  x: 2350 + rng(0, 800), y: 310 + rng(0, 150), phase: rng(0, Math.PI*2),
}));

// Clouds (drift slowly)
const clouds = [
  {x:250,y:55,w:130},{x:700,y:38,w:95},{x:1100,y:72,w:150},
  {x:1600,y:44,w:110},{x:2050,y:65,w:130},{x:2550,y:40,w:100},{x:2900,y:58,w:90},
];

// Garden signs (world coords)
const gardenSigns = [
  { x: 370,  y: H-175, label:'✨ Magical\nLake',        width: 100 },
  { x: 875,  y: H-175, label:'🌹 Rose\nGarden',         width: 90  },
  { x: 1980, y: H-175, label:'🦋 Butterfly\nMeadow',   width: 110 },
  { x: 2730, y: H-175, label:'🌲 Enchanted\nForest',    width: 110 },
];

// Dialog / prompt
let dialog = null, dialogTimer = 0, promptMsg = null;
function showDialog(msg, dur = 200) { dialog = msg; dialogTimer = dur; }

let tick = 0;


// ── Ballroom confetti ─────────────────────────────────────────
const confetti = Array.from({length: 20}, () => ({
  x: 100 + rng(0, 600), y: rng(0, 100),
  color: ['#ff88cc','#ffdd44','#cc88ff','#44ddff','#ff9944'][Math.floor(rng(0,5))],
  phase: rng(0, Math.PI*2), speed: 0.4 + rng(0,0.5),
}));

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function roundRect(x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

// ═══════════════════════════════════════════════════════════
//  GARDEN SCENE DRAWING
// ═══════════════════════════════════════════════════════════
function drawGardenScene() {
  ctx.save();
  ctx.translate(-Math.round(cam.x), 0);

  drawWorldSky();
  drawWorldGround();
  drawLakeArea();
  drawRoseGarden();
  drawWorldCastle();
  drawFountain(CASTLE_WX, H - 68);
  drawButterflyMeadow();
  drawForestArea();
  drawWorldFlowers();
  drawWorldSigns();

  const drawPX = { ...princess };
  if (unicorn.x > princess.x) { drawUnicorn(unicorn); drawPrincess(drawPX); }
  else                         { drawPrincess(drawPX); drawUnicorn(unicorn); }

  ctx.restore();
}

function drawWorldSky() {
  const g = ctx.createLinearGradient(0,0,0,H*0.52);
  g.addColorStop(0,'#5baae0'); g.addColorStop(1,'#cce8ff');
  ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,H*0.52);
  // Sun
  const sunGlow = ctx.createRadialGradient(500,70,10,500,70,70);
  sunGlow.addColorStop(0,'rgba(255,240,100,0.6)'); sunGlow.addColorStop(1,'rgba(255,200,50,0)');
  ctx.fillStyle=sunGlow; ctx.beginPath(); ctx.arc(500,70,70,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffe866'; ctx.beginPath(); ctx.arc(500,70,28,0,Math.PI*2); ctx.fill();
  // Clouds
  clouds.forEach(c => {
    c.x += 0.025;
    if (c.x > WORLD_W + c.w) c.x = -c.w;
    ctx.fillStyle='rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.ellipse(c.x,c.y,c.w,22,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x-c.w*.3,c.y+8,c.w*.5,16,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x+c.w*.3,c.y+5,c.w*.4,18,0,0,Math.PI*2); ctx.fill();
  });
}

function drawWorldGround() {
  const g = ctx.createLinearGradient(0,H*0.5,0,H);
  g.addColorStop(0,'#5cb85c'); g.addColorStop(0.4,'#4cae4c'); g.addColorStop(1,'#3d8b3d');
  ctx.fillStyle=g; ctx.fillRect(0,H*0.5,WORLD_W,H*0.5);
  // Subtle hill variations
  ctx.fillStyle='rgba(80,180,80,0.3)';
  [[400,H*.49,260,55],[1000,H*.48,220,60],[1900,H*.5,300,50],[2600,H*.49,240,55]].forEach(([x,y,rx,ry]) => {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,Math.PI,0); ctx.fill();
  });
}

function drawLakeArea() {
  // Background trees by lake
  drawTree(130, H*0.5, 130, 16, '#3a6a3a');
  drawTree(580, H*0.5, 110, 13, '#3a6a3a');

  // Water body
  const lx=90, ly=255, lw=500, lh=175;
  const wg = ctx.createLinearGradient(lx,ly,lx,ly+lh);
  wg.addColorStop(0,'#5aaed4'); wg.addColorStop(0.5,'#3a8cb4'); wg.addColorStop(1,'#2a6a94');
  ctx.fillStyle=wg;
  ctx.beginPath(); ctx.ellipse(lx+lw/2,ly+lh/2,lw/2,lh/2,0,0,Math.PI*2); ctx.fill();

  // Ripples
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.2;
  for (let i=0;i<4;i++) {
    const ry = ly+55+i*32, rphase = Math.sin(tick*0.018+i*0.8)*12;
    ctx.beginPath(); ctx.moveTo(lx+90,ry); ctx.quadraticCurveTo(lx+lw/2,ry+rphase,lx+lw-90,ry); ctx.stroke();
  }
  // Shore/sand
  ctx.fillStyle='#d8c89a';
  ctx.beginPath(); ctx.ellipse(lx+lw/2,ly+lh-5,lw/2+18,16,0,0,Math.PI*2); ctx.fill();
  // Lily pads
  [[lx+180,ly+lh-40],[lx+300,ly+lh-65],[lx+420,ly+lh-45]].forEach(([px,py]) => {
    ctx.fillStyle='#4a9440'; ctx.beginPath(); ctx.ellipse(px,py,18,12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2a7420'; ctx.beginPath(); ctx.moveTo(px,py-12); ctx.lineTo(px+5,py); ctx.moveTo(px,py-12); ctx.lineTo(px-5,py); ctx.stroke && ctx.stroke();
    // Flower on pad
    ctx.fillStyle='#ffeeaa'; ctx.beginPath(); ctx.arc(px,py-2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffcc44'; ctx.beginPath(); ctx.arc(px,py-2,3,0,Math.PI*2); ctx.fill();
  });
  // Reeds
  [[lx+65,H*0.52],[lx+95,H*0.51],[lx+lw-70,H*0.52],[lx+lw-50,H*0.51]].forEach(([rx,ry]) => {
    ctx.strokeStyle='#5a7a30'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(rx,ry+60); ctx.quadraticCurveTo(rx+8,ry+30,rx,ry); ctx.stroke();
    ctx.fillStyle='#7a5a20'; ctx.beginPath(); ctx.ellipse(rx,ry-6,4,10,0,0,Math.PI*2); ctx.fill();
  });
  // Wooden bridge
  const bx=530,by=H*0.5+10,bw=80;
  ctx.fillStyle='#8B6914'; ctx.fillRect(bx,by,bw,14);
  for (let p=0;p<5;p++) { ctx.fillStyle='#7a5a10'; ctx.fillRect(bx+p*17,by-3,13,20); }
  ctx.strokeStyle='#5a3a08'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(bx-2,by); ctx.lineTo(bx+bw+2,by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx-2,by+14); ctx.lineTo(bx+bw+2,by+14); ctx.stroke();
  ctx.fillStyle='#5a3a08'; ctx.fillRect(bx-3,by-10,6,24); ctx.fillRect(bx+bw-3,by-10,6,24);
  // Rail posts
  for (let p=0;p<4;p++) {
    ctx.strokeStyle='#5a3a08'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(bx+p*26,by-10); ctx.lineTo(bx+p*26+20,by-10); ctx.stroke();
  }
  // Ducks
  drawDuck(lx+240, ly+lh-28, tick*0.008);
  drawDuck(lx+380, ly+lh-35, tick*0.006 + Math.PI);
}

function drawDuck(dx, dy, phase) {
  const bob = Math.sin(phase)*3;
  ctx.fillStyle='#f0f0f0';
  ctx.beginPath(); ctx.ellipse(dx,dy+bob,14,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e0e0e0';
  ctx.beginPath(); ctx.ellipse(dx+12,dy-6+bob,8,6,0.3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff8800';
  ctx.beginPath(); ctx.moveTo(dx+19,dy-6+bob); ctx.lineTo(dx+23,dy-4+bob); ctx.lineTo(dx+19,dy-3+bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(dx+15,dy-8+bob,1.5,0,Math.PI*2); ctx.fill();
  // Water reflection ripple
  ctx.strokeStyle='rgba(100,180,255,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.ellipse(dx,dy+bob+9,16,4,0,0,Math.PI*2); ctx.stroke();
}

function drawRoseGarden() {
  const gx=660;
  // Archway entrance
  ctx.fillStyle='#c0b0a0'; ctx.fillRect(gx,H*0.5-30,14,80); ctx.fillRect(gx+66,H*0.5-30,14,80);
  ctx.strokeStyle='#a09080'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(gx+37,H*0.5-30,37,Math.PI,0); ctx.stroke();
  ctx.strokeStyle='#cc4466'; ctx.lineWidth=1.5;
  for (let i=0;i<8;i++) {
    const a=(i/8)*Math.PI;
    ctx.beginPath(); ctx.arc(gx+37+Math.cos(a)*37,H*0.5-30+Math.sin(a)*37,4,0,Math.PI*2); ctx.fillStyle='#ff6688'; ctx.fill();
  }
  // Hedges (decorative maze pattern)
  const hedgeColor='#2d6a2d';
  [
    [gx+10,H*0.5,120,22],[gx+160,H*0.5,100,22],[gx+290,H*0.5,140,22],
    [gx+10,H*0.5,22,90], [gx+10,H*0.5+68,90,22],
    [gx+280,H*0.5,22,100],[gx+200,H*0.5+78,100,22],
    [gx+130,H*0.5+45,22,55],[gx+370,H*0.5,22,80],[gx+370,H*0.5+60,80,22],
  ].forEach(([hx,hy,hw,hh]) => {
    ctx.fillStyle=hedgeColor;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(hx,hy,hw,hh,6) : ctx.rect(hx,hy,hw,hh); ctx.fill();
    // Flowers on hedges
    ctx.fillStyle='#ff88aa';
    for (let d=0;d<Math.floor(Math.max(hw,hh)/25);d++) {
      const fx = hx+(hw>hh?d*24+8:rng(2,hw-4));
      const fy = hy+(hh>hw?d*24+8:rng(2,hh-4));
      ctx.beginPath(); ctx.arc(fx,fy,3.5,0,Math.PI*2); ctx.fill();
    }
  });
  // Stone path through garden
  ctx.fillStyle='#c8b8a0';
  for (let px=gx+36;px<gx+430;px+=28) {
    ctx.beginPath(); ctx.ellipse(px,H*0.5+15,10,6,0,0,Math.PI*2); ctx.fill();
  }
  drawTree(gx+240, H*0.5, 105, 13, '#4a8a4a');
}

function drawWorldCastle() {
  const cx=CASTLE_WX, baseY=H*0.15, bw=180, bh=150, bx=cx-bw/2;
  ctx.fillStyle='#e8ddd0'; ctx.fillRect(bx,baseY,bw,bh);
  ctx.fillStyle='#d4c9bc';
  for (let mx=bx;mx<bx+bw-17;mx+=26) ctx.fillRect(mx,baseY-20,18,20);
  ctx.fillStyle='#ddd2c5';
  ctx.fillRect(bx-28,baseY+10,50,bh-10); worldTowerTop(bx-3,baseY+10,50,'#b83c6e');
  ctx.fillRect(bx+bw-22,baseY+10,50,bh-10); worldTowerTop(bx+bw-22,baseY+10,50,'#b83c6e');
  ctx.fillStyle='#e8ddd0'; ctx.fillRect(cx-22,baseY-50,44,60); worldTowerTop(cx-22,baseY-50,44,'#9b1c4a');
  // Gate
  ctx.fillStyle='#3a2015';
  ctx.beginPath(); ctx.arc(cx,baseY+bh-28,24,Math.PI,0); ctx.rect(cx-24,baseY+bh-28,48,28); ctx.fill();
  const gg=ctx.createRadialGradient(cx,baseY+bh-10,2,cx,baseY+bh-10,28);
  gg.addColorStop(0,'rgba(255,210,80,0.45)'); gg.addColorStop(1,'rgba(255,180,40,0)');
  ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(cx,baseY+bh-10,28,Math.PI,0); ctx.rect(cx-28,baseY+bh-10,56,18); ctx.fill();
  worldWindow(cx-45,baseY+40); worldWindow(cx+28,baseY+40); worldWindow(cx-10,baseY+30);
  worldFlag(cx+11,baseY-82,'#ff6699'); worldFlag(bx+15,baseY-22,'#ff99cc'); worldFlag(bx+bw-4,baseY-22,'#ff99cc');
  // Beige path
  const pg=ctx.createLinearGradient(0,H*0.5,0,H);
  pg.addColorStop(0,'#d4b896'); pg.addColorStop(1,'#c8a878');
  ctx.fillStyle=pg;
  ctx.beginPath(); ctx.moveTo(cx-22,H*0.48); ctx.lineTo(cx+22,H*0.48); ctx.lineTo(cx+70,H); ctx.lineTo(cx-70,H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#b0946a'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
  ctx.beginPath(); ctx.moveTo(cx-22,H*0.48); ctx.lineTo(cx-70,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+22,H*0.48); ctx.lineTo(cx+70,H); ctx.stroke();
  ctx.setLineDash([]);
}
function worldTowerTop(x,y,w,color) {
  ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(x+w/2,y-30); ctx.lineTo(x,y); ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#d4c9bc'; for (let i=0;i<3;i++) ctx.fillRect(x+4+i*14,y-14,10,14);
}
function worldWindow(x,y) {
  ctx.fillStyle='#a0cce8'; ctx.beginPath(); ctx.arc(x+8,y+8,8,Math.PI,0); ctx.rect(x,y+8,16,12); ctx.fill();
  ctx.strokeStyle='#8a7060'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(x+8,y+8,8,Math.PI,0); ctx.moveTo(x,y+8); ctx.lineTo(x+16,y+8); ctx.stroke();
}
function worldFlag(x,y,color) {
  ctx.strokeStyle='#7a5c3a'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+32); ctx.stroke();
  ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+18,y+7); ctx.lineTo(x,y+14); ctx.closePath(); ctx.fill();
}

function drawFountain(fx, fy) {
  ctx.fillStyle='#c0b090';
  ctx.beginPath(); ctx.ellipse(fx,fy+22,50,16,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#4a9fd4';
  ctx.beginPath(); ctx.ellipse(fx,fy+20,43,12,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#c0b090'; ctx.fillRect(fx-7,fy-18,14,42);
  ctx.beginPath(); ctx.ellipse(fx,fy-20,20,7,0,0,Math.PI*2); ctx.fill();
  for (let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2, prog=((tick*0.025+i/6)%1);
    const sx=fx+Math.cos(a)*prog*13, sy=fy-20-Math.sin(prog*Math.PI)*32;
    ctx.fillStyle=`rgba(120,200,255,${0.65*(1-prog)})`;
    ctx.beginPath(); ctx.arc(sx,sy,2.5*(1-prog*.5),0,Math.PI*2); ctx.fill();
  }
}

function drawButterflyMeadow() {
  // Lighter grass hint
  ctx.fillStyle='rgba(120,210,100,0.18)';
  ctx.fillRect(1680,H*0.5,620,H*0.5);
  // Scattered rocks
  [[1750,H*0.5+55],[1920,H*0.5+40],[2150,H*0.5+60]].forEach(([rx,ry]) => {
    ctx.fillStyle='#aaa090';
    ctx.beginPath(); ctx.ellipse(rx,ry,22,12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ccc0b0';
    ctx.beginPath(); ctx.ellipse(rx-5,ry-4,10,6,0,0,Math.PI*2); ctx.fill();
  });
  // Butterflies
  butterflies.forEach(b => {
    const px = b.bx + Math.sin(tick*b.speed*.015+b.phase)*b.range;
    const py = b.by + Math.cos(tick*b.speed*.012+b.phase)*20;
    const wing = Math.abs(Math.sin(tick*0.12+b.phase))*18;
    ctx.fillStyle=b.color;
    ctx.beginPath(); ctx.ellipse(px-wing/2,py,wing/2+2,7,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px+wing/2,py,wing/2+2,7,-0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px,py,1.5,5,0,0,Math.PI*2); ctx.fill();
  });
}

function drawForestArea() {
  // Dark undergrowth
  ctx.fillStyle='rgba(30,70,30,0.35)'; ctx.fillRect(2340,H*0.5,860,H*0.5);
  // Trees
  [
    [2390,H*0.5,210,24,'#2a5a2a'],[2540,H*0.5,250,28,'#1e4a1e'],
    [2680,H*0.5,220,22,'#2a5a2a'],[2840,H*0.5,240,26,'#1e4a1e'],
    [3000,H*0.5,200,20,'#2a5a2a'],[3140,H*0.5,230,24,'#1e4a1e'],
    [2460,H*0.5,140,14,'#3a6a3a'],[2760,H*0.5,155,15,'#3a6a3a'],
  ].forEach(([x,y,h,tw,c]) => drawTree(x,y,h,tw,c));
  // Mushrooms
  [[2430,H*0.5+45],[2610,H*0.5+50],[2900,H*0.5+40],[3050,H*0.5+48]].forEach(([mx,my]) => {
    ctx.fillStyle='#cc3322'; ctx.beginPath(); ctx.arc(mx,my-14,18,Math.PI,0); ctx.fill();
    ctx.fillStyle='#e04433'; ctx.beginPath(); ctx.arc(mx,my-14,18,Math.PI+.3,-.3); ctx.fill();
    ctx.fillStyle='#f5f5f0'; ctx.fillRect(mx-6,my-14,12,16);
    // Spots
    ctx.fillStyle='rgba(255,255,255,0.7)';
    [[mx-8,my-18],[mx,my-22],[mx+7,my-16]].forEach(([sx,sy]) => {
      ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill();
    });
  });
  // Fireflies
  fireflies.forEach(f => {
    const alpha = (Math.sin(tick*0.06+f.phase)+1)/2;
    if (alpha > 0.3) {
      const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,10);
      g.addColorStop(0,`rgba(180,255,100,${alpha*.7})`); g.addColorStop(1,'rgba(100,220,50,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(220,255,150,${alpha})`; ctx.beginPath(); ctx.arc(f.x,f.y,2.5,0,Math.PI*2); ctx.fill();
    }
    f.x += Math.sin(tick*0.02+f.phase)*0.3;
    f.y += Math.cos(tick*0.015+f.phase)*0.2;
  });
}

function drawTree(wx, baseY, h, trunkW, color) {
  ctx.fillStyle='#5a3a1a'; ctx.fillRect(wx-trunkW/2,baseY-h*.38,trunkW,h*.38);
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.ellipse(wx,baseY-h*.55,h*.32,h*.26,0,0,Math.PI*2); ctx.fill();
  const lighter = color.replace(/\d+/g,(n,i)=>i>0?Math.min(255,+n+30):n);
  ctx.fillStyle=lighter||'#4a8a4a';
  ctx.beginPath(); ctx.ellipse(wx,baseY-h*.72,h*.24,h*.20,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.ellipse(wx,baseY-h*.84,h*.14,h*.12,0,0,Math.PI*2); ctx.fill();
}

function drawWorldFlowers() {
  gardenFlowers.forEach(f => {
    ctx.strokeStyle='#4a8c3f'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x,f.y-f.stem); ctx.stroke();
    for (let p=0;p<5;p++) {
      const a=(p/5)*Math.PI*2;
      ctx.fillStyle=f.color; ctx.beginPath(); ctx.arc(f.x+Math.cos(a)*f.size,f.y-f.stem+Math.sin(a)*f.size,f.size*.55,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#ffe566'; ctx.beginPath(); ctx.arc(f.x,f.y-f.stem,f.size*.4,0,Math.PI*2); ctx.fill();
  });
}

function drawWorldSigns() {
  gardenSigns.forEach(s => {
    ctx.fillStyle='#8B5E3C'; ctx.fillRect(s.x+s.width/2-4,s.y+30,8,30);
    ctx.fillStyle='#f5deb3'; ctx.strokeStyle='#8B5E3C'; ctx.lineWidth=2;
    roundRect(s.x,s.y,s.width,30,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#5a3825'; ctx.font='10px Georgia'; ctx.textAlign='center';
    s.label.split('\n').forEach((ln,i)=>ctx.fillText(ln,s.x+s.width/2,s.y+11+i*12));
    ctx.textAlign='left';
  });
}


// ─── Shared castle structure ──────────────────────────────
function drawCastleBase(floorStyle) {
  // Floor
  if (floorStyle === 'ballroom') {
    // Polished black/white
    for (let row=0;row*50<H;row++) for (let col=0;col*50<W;col++) {
      ctx.fillStyle=(row+col)%2===0?'#2a2a2a':'#f0ece0';
      ctx.fillRect(col*50,CEIL_H+row*50,50,50);
    }
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=.4;
  } else {
    for (let row=0;row*50<H;row++) for (let col=0;col*50<W;col++) {
      ctx.fillStyle=(row+col)%2===0?'#ede5d8':'#d8d0c4';
      ctx.fillRect(col*50,CEIL_H+row*50,50,50);
    }
    ctx.strokeStyle='#c4bdb4'; ctx.lineWidth=.4;
  }
  for (let x=0;x<=W;x+=50){ctx.beginPath();ctx.moveTo(x,CEIL_H);ctx.lineTo(x,H);ctx.stroke();}
  for (let y=CEIL_H;y<=H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // Walls
  const lg=ctx.createLinearGradient(0,0,WALL_L,0);
  lg.addColorStop(0,'#6a5a4a'); lg.addColorStop(1,'#b8a898');
  ctx.fillStyle=lg; ctx.fillRect(0,0,WALL_L,H);
  const rg=ctx.createLinearGradient(WALL_R,0,W,0);
  rg.addColorStop(0,'#b8a898'); rg.addColorStop(1,'#6a5a4a');
  ctx.fillStyle=rg; ctx.fillRect(WALL_R,0,W-WALL_R,H);
  ctx.strokeStyle='#5a4a3a'; ctx.lineWidth=.7;
  for (let row=0;row<14;row++) {
    const off=row%2===0?0:-16;
    for (let b=0;b<2;b++) { ctx.strokeRect(b*38+off-4,row*38+4,36,16); ctx.strokeRect(WALL_R+b*38+off,row*38+4,36,16); }
  }
  // Ceiling
  const cg=ctx.createLinearGradient(0,0,0,CEIL_H);
  cg.addColorStop(0,'#4a3a2a'); cg.addColorStop(1,'#7a6a5a');
  ctx.fillStyle=cg; ctx.fillRect(0,0,W,CEIL_H);
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2.5; ctx.strokeRect(WALL_L+8,CEIL_H-14,WALL_R-WALL_L-16,11);
  ctx.strokeStyle='#a08050'; ctx.lineWidth=1; ctx.strokeRect(WALL_L+3,CEIL_H-18,WALL_R-WALL_L-6,18);
  for (let i=0;i<4;i++) {
    const px=WALL_L+18+i*163;
    ctx.fillStyle='#3a2a1a'; ctx.fillRect(px,6,138,58);
    ctx.strokeStyle='#c8a878'; ctx.lineWidth=1.5; ctx.strokeRect(px+4,10,130,50);
    ctx.fillStyle='#c8a878'; ctx.beginPath(); ctx.arc(px+69,35,5,0,Math.PI*2); ctx.fill();
  }
}

function drawChandelier(cx, cy, numCandles, ringR) {
  const pulse=1+Math.sin(tick*.03)*.08;
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx,2); ctx.lineTo(cx,cy-18); ctx.stroke();
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,ringR,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#b89868'; ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();
  for (let i=0;i<numCandles;i++) {
    const a=(i/numCandles)*Math.PI*2, cx2=cx+Math.cos(a)*ringR, cy2=cy+Math.sin(a)*ringR;
    const gw=ctx.createRadialGradient(cx2,cy2-7,0,cx2,cy2-7,20*pulse);
    gw.addColorStop(0,'rgba(255,220,100,0.38)'); gw.addColorStop(1,'rgba(255,180,50,0)');
    ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(cx2,cy2-7,20*pulse,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fffde7'; ctx.fillRect(cx2-2.5,cy2-9,5,11);
    ctx.fillStyle=`rgba(255,200,50,${.85+Math.sin(tick*.1+i)*.15})`;
    ctx.beginPath(); ctx.ellipse(cx2,cy2-13,2.5,4.5,0,0,Math.PI*2); ctx.fill();
  }
  for (let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2+tick*.012, r=ringR+12+Math.sin(tick*.05+i)*7;
    const sx=cx+Math.cos(a)*r, sy=cy+Math.sin(a)*r*.38;
    const al=(Math.sin(tick*.07+i*1.3)+1)/2;
    ctx.fillStyle=`rgba(255,240,150,${al*.6})`; ctx.beginPath(); ctx.arc(sx,sy,1.8,0,Math.PI*2); ctx.fill();
  }
}

function drawSconces() {
  [{x:WALL_L+2,y:185,r:false},{x:WALL_L+2,y:345,r:false},{x:WALL_R-2,y:185,r:true},{x:WALL_R-2,y:345,r:true}]
  .forEach((s,idx) => {
    const d=s.r?-1:1, bx=s.x+d*6, pulse=.25+Math.sin(tick*.04+idx)*.1;
    ctx.fillStyle='#8a6a3a'; ctx.fillRect(s.x-3,s.y-3,14*d,7);
    const gw=ctx.createRadialGradient(bx,s.y-10,0,bx,s.y-10,28);
    gw.addColorStop(0,`rgba(255,220,100,${pulse+.1})`); gw.addColorStop(1,'rgba(255,180,50,0)');
    ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(bx,s.y-10,28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fffde7'; ctx.fillRect(bx-2.5,s.y-11,5,13);
    ctx.fillStyle=`rgba(255,200,50,${.85+Math.sin(tick*.08+idx*.7)*.15})`;
    ctx.beginPath(); ctx.ellipse(bx,s.y-16,2.5,4.5,0,0,Math.PI*2); ctx.fill();
  });
}

function drawSideDoor(side) {
  const dx = side==='left' ? 4 : WALL_R-40, dw=36, dy=248, dh=70;
  ctx.fillStyle='#4a2a10';
  ctx.beginPath(); ctx.arc(dx+dw/2,dy,dw/2+2,Math.PI,0); ctx.rect(dx-2,dy,dw+4,dh+2); ctx.fill();
  ctx.fillStyle='#7a5a2a';
  ctx.beginPath(); ctx.arc(dx+dw/2,dy,dw/2,Math.PI,0); ctx.rect(dx,dy,dw,dh); ctx.fill();
  ctx.strokeStyle='#4a2a10'; ctx.lineWidth=1.5;
  ctx.strokeRect(dx+4,dy+7,dw-8,dh/2-5); ctx.strokeRect(dx+4,dy+dh/2+3,dw-8,dh/2-10);
  const knobX=side==='left'?dx+dw-5:dx+4;
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(knobX,dy+dh/2+5,3,0,Math.PI*2); ctx.fill();
  const gx=side==='left'?WALL_L+40:WALL_R-40;
  const dg=ctx.createRadialGradient(gx,dy+dh/2,0,gx,dy+dh/2,35);
  dg.addColorStop(0,'rgba(255,210,100,0.18)'); dg.addColorStop(1,'rgba(255,210,100,0)');
  ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(gx,dy+dh/2,35,0,Math.PI*2); ctx.fill();
}

// ─── Main Hall ────────────────────────────────────────────
function drawMainHall() {
  drawCastleBase('stone');
  drawChandelier(W/2, CEIL_H-2, 8, 36);
  drawSconces();
  drawMainBanners();
  drawThrone();
  drawCastleBouquets();
  drawCrownPedestals();
  drawExitDoor();
  drawSideDoor('left');
  drawSideDoor('right');
  // Room label
  drawRoomLabel('✨ Grand Hall');
}

function drawMainBanners() {
  [{x:WALL_L+14,color:'#cc2080',gem:'#ff88cc'},{x:WALL_L+74,color:'#7722bb',gem:'#cc88ff'},
   {x:WALL_R-114,color:'#7722bb',gem:'#cc88ff'},{x:WALL_R-54,color:'#cc2080',gem:'#ff88cc'}]
  .forEach(b => {
    const bw=40,bh=88,by=CEIL_H-2;
    ctx.fillStyle=b.color;
    ctx.beginPath(); ctx.moveTo(b.x,by); ctx.lineTo(b.x+bw,by); ctx.lineTo(b.x+bw,by+bh);
    ctx.lineTo(b.x+bw/2,by+bh-14); ctx.lineTo(b.x,by+bh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(b.x+4,by+4); ctx.lineTo(b.x+bw-4,by+4); ctx.lineTo(b.x+bw-4,by+bh-14);
    ctx.lineTo(b.x+bw/2,by+bh-20); ctx.lineTo(b.x+4,by+bh-14); ctx.closePath(); ctx.stroke();
    ctx.fillStyle=b.gem; ctx.beginPath(); ctx.arc(b.x+bw/2,by+34,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFD700';
    for (let pt=0;pt<5;pt++) { const a=(pt/5)*Math.PI*2; ctx.beginPath(); ctx.arc(b.x+bw/2+Math.cos(a)*5.5,by+34+Math.sin(a)*5.5,1.8,0,Math.PI*2); ctx.fill(); }
  });
}

function drawThrone() {
  const tx=W/2-28,ty=CEIL_H+5,tw=56,th=74;
  ctx.fillStyle='#7a5a2a'; ctx.fillRect(tx+2,ty+th-12,10,12); ctx.fillRect(tx+tw-12,ty+th-12,10,12);
  ctx.fillStyle='#cc2080'; ctx.fillRect(tx,ty+th-22,tw,22);
  ctx.fillStyle='#ee60aa'; ctx.fillRect(tx+4,ty+th-19,tw-8,7);
  ctx.fillStyle='#8a6a3a'; ctx.fillRect(tx,ty,tw,th-20);
  ctx.strokeStyle='#c8a030'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(tx+tw/2,ty+10,tw/2-3,Math.PI,0); ctx.stroke();
  ctx.fillStyle='#ff4488'; ctx.beginPath(); ctx.arc(tx+tw/2,ty+12,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(tx+tw/2,ty+12,3.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#6a4a1a'; ctx.fillRect(tx-8,ty+th-42,11,20); ctx.fillRect(tx+tw-3,ty+th-42,11,20);
  ctx.fillStyle='#c8a030';
  ctx.beginPath(); ctx.arc(tx+3,ty-4,5.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx+tw-3,ty-4,5.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx+tw/2,ty-7,7,0,Math.PI*2); ctx.fill();
}

function drawCastleBouquets() {
  drawBouquet(120,420,1.0); drawBouquet(670,420,1.0);
  drawBouquet(158,305,.78); drawBouquet(638,305,.78);
}

function drawBouquet(cx,cy,s) {
  ctx.fillStyle='#8a6a9a';
  ctx.beginPath(); ctx.moveTo(cx-14*s,cy); ctx.lineTo(cx-18*s,cy+28*s); ctx.lineTo(cx+18*s,cy+28*s); ctx.lineTo(cx+14*s,cy); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#9a7aaa'; ctx.fillRect(cx-9*s,cy-7*s,18*s,9*s);
  ctx.fillStyle='#7a5a8a'; ctx.beginPath(); ctx.ellipse(cx,cy+28*s,18*s,5.5*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(cx,cy-7*s,9*s,3.5*s,0,0,Math.PI*2); ctx.stroke();
  [-10*s,0,10*s,-16*s,16*s].forEach((off,i) => {
    ctx.strokeStyle=i%2===0?'#4a8c3f':'#3d7a35'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(cx+off*.5,cy-7*s); ctx.quadraticCurveTo(cx+off*.3,cy-24*s,cx+off,cy-48*s); ctx.stroke();
  });
  const fc=['#ff88cc','#ff44aa','#cc44ff','#ffdd44','#ff66aa','#44bbff','#ff99bb','#ddaaff'];
  [{dx:-15*s,dy:-58*s},{dx:0,dy:-65*s},{dx:15*s,dy:-58*s},{dx:-24*s,dy:-48*s},{dx:24*s,dy:-48*s},
   {dx:-7*s,dy:-53*s},{dx:7*s,dy:-53*s},{dx:-18*s,dy:-39*s},{dx:18*s,dy:-39*s}]
  .forEach((fp,fi) => {
    const fx=cx+fp.dx,fy=cy+fp.dy,sz=(5+fi%3*1.5)*s;
    for (let p=0;p<5;p++) { const a=(p/5)*Math.PI*2; ctx.fillStyle=fc[fi%fc.length]; ctx.beginPath(); ctx.arc(fx+Math.cos(a)*sz,fy+Math.sin(a)*sz,sz*.6,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#ffe566'; ctx.beginPath(); ctx.arc(fx,fy,sz*.45,0,Math.PI*2); ctx.fill();
  });
  [-1,1].forEach(d => { ctx.save(); ctx.translate(cx+d*8*s,cy-33*s); ctx.rotate(d*.6); ctx.fillStyle='#4a8c3f'; ctx.beginPath(); ctx.ellipse(0,0,9*s,4.5*s,0,0,Math.PI*2); ctx.fill(); ctx.restore(); });
}

function drawCrownPedestals() {
  castleCrowns.forEach(c => {
    drawPedestal(c.x,c.y);
    if (!c.taken) {
      const r=22+Math.sin(tick*.05)*4;
      const gw=ctx.createRadialGradient(c.x,c.y-28,0,c.x,c.y-28,r);
      gw.addColorStop(0,'rgba(255,240,150,0.32)'); gw.addColorStop(1,'rgba(255,240,150,0)');
      ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(c.x,c.y-28,r,0,Math.PI*2); ctx.fill();
      drawCrownItem(c.x,c.y-18,c.style,c.color,c.gem);
    }
  });
}

function drawPedestal(cx,cy) {
  const g=ctx.createLinearGradient(cx-12,0,cx+12,0);
  g.addColorStop(0,'#8a7a6a'); g.addColorStop(.35,'#d4c8b8'); g.addColorStop(.65,'#d4c8b8'); g.addColorStop(1,'#8a7a6a');
  ctx.fillStyle=g; ctx.fillRect(cx-11,cy-4,22,33);
  ctx.fillStyle='#c4b8a8'; ctx.fillRect(cx-17,cy+27,34,7);
  ctx.fillStyle='#b0a498'; ctx.fillRect(cx-21,cy+33,42,6);
  ctx.fillStyle='#962060'; ctx.fillRect(cx-15,cy-12,30,10);
  ctx.fillStyle='#c04080'; ctx.fillRect(cx-12,cy-11,24,4);
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=1; ctx.strokeRect(cx-15,cy-12,30,10);
}

function drawCrownItem(cx,cy,style,color,gem) {
  ctx.save(); ctx.translate(cx,cy);
  if (style==='ruby') {
    ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(-13,8); ctx.lineTo(-13,0); ctx.lineTo(-7,-13); ctx.lineTo(0,-5); ctx.lineTo(7,-13); ctx.lineTo(13,0); ctx.lineTo(13,8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#c8a030'; ctx.lineWidth=1; ctx.stroke();
    [{x:-5,y:-3},{x:0,y:-3},{x:5,y:-3}].forEach(g => { ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(g.x,g.y,2.5,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle='#c8a030'; ctx.fillRect(-13,5,26,4);
  } else if (style==='sapphire') {
    ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(-13,8);
    for (let i=0;i<5;i++) { const ix=-13+i*6.5; ctx.lineTo(ix,0); ctx.lineTo(ix+2,-11+(i===2?-3:0)); ctx.lineTo(ix+4.5,0); }
    ctx.lineTo(13,8); ctx.closePath(); ctx.fill();
    [-8,0,8].forEach((gx,i) => { ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(gx,i===1?-9:-7,2.2,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle='#aaaacc'; ctx.fillRect(-13,5,26,4);
  } else if (style==='rose') {
    ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(-13,8); ctx.lineTo(-13,0); ctx.lineTo(-6,-9); ctx.lineTo(0,-3); ctx.lineTo(6,-9); ctx.lineTo(13,0); ctx.lineTo(13,8); ctx.closePath(); ctx.fill();
    [[-6,-2],[0,1],[6,-2]].forEach(([gx,gy]) => {
      for (let p=0;p<5;p++) { const a=(p/5)*Math.PI*2; ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(gx+Math.cos(a)*2.8,gy+Math.sin(a)*2.8,1.3,0,Math.PI*2); ctx.fill(); }
      ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(gx,gy,1.3,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle='#ee9988'; ctx.fillRect(-13,5,26,4);
  }
  ctx.restore();
}

function drawExitDoor() {
  const dx=W/2-28,dy=H-92,dw=56,dh=82;
  ctx.fillStyle='#5a3a18'; ctx.beginPath(); ctx.arc(dx+dw/2,dy-2,dw/2+5,Math.PI,0); ctx.rect(dx-5,dy-2,dw+10,dh+4); ctx.fill();
  ctx.fillStyle='#7a5a2a'; ctx.beginPath(); ctx.arc(dx+dw/2,dy,dw/2,Math.PI,0); ctx.rect(dx,dy,dw,dh); ctx.fill();
  ctx.strokeStyle='#5a3a18'; ctx.lineWidth=1.8;
  ctx.strokeRect(dx+4,dy+7,dw/2-7,dh/2-9); ctx.strokeRect(dx+dw/2+3,dy+7,dw/2-7,dh/2-9);
  ctx.strokeRect(dx+4,dy+dh/2+2,dw/2-7,dh/2-11); ctx.strokeRect(dx+dw/2+3,dy+dh/2+2,dw/2-7,dh/2-11);
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(dx+dw-9,dy+dh/2,4.5,0,Math.PI*2); ctx.fill();
}

// ─── Library ──────────────────────────────────────────────
function drawLibrary() {
  drawCastleBase('stone');
  // Warm amber overlay
  ctx.fillStyle='rgba(255,180,80,0.07)'; ctx.fillRect(0,0,W,H);
  drawChandelier(W/2,CEIL_H-2,6,30);
  drawSconces();
  drawBookShelves();
  drawFireplace();
  drawReadingChair();
  drawDesk();
  drawGlobe();
  drawSideDoor('right'); // right door leads back to main hall
  drawRoomLabel('📚 Royal Library');
}

function drawBookShelves() {
  // Full back wall bookshelves (y = CEIL_H to CEIL_H+140)
  const sx=WALL_L+5, sw=WALL_R-WALL_L-10, sy=CEIL_H+2, sh=140;
  ctx.fillStyle='#6a4a2a'; ctx.fillRect(sx,sy,sw,sh);
  // Shelves
  const shelfColors=['#5a3820','#6a4828','#5a3820'];
  for (let row=0;row<4;row++) {
    const ry=sy+row*34+2;
    ctx.fillStyle=shelfColors[row%3]; ctx.fillRect(sx+2,ry+28,sw-4,5);
    // Books
    let bx=sx+6;
    while (bx < sx+sw-20) {
      const bw=8+Math.floor(Math.random()*14), bh=18+Math.floor(Math.random()*12);
      const colors=['#c0302a','#2a6ac0','#2a9a2a','#c0902a','#7a2a9a','#c0602a','#2a8a8a','#8a2a2a'];
      ctx.fillStyle=colors[Math.floor(bx*7+row*3)%colors.length];
      ctx.fillRect(bx,ry+28-bh,bw,bh);
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=.5; ctx.strokeRect(bx,ry+28-bh,bw,bh);
      // Gold spine line
      ctx.strokeStyle='rgba(255,200,80,0.4)'; ctx.lineWidth=.8;
      ctx.beginPath(); ctx.moveTo(bx+3,ry+28-bh+2); ctx.lineTo(bx+3,ry+26); ctx.stroke();
      bx+=bw+1;
    }
  }
  // Frame
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2; ctx.strokeRect(sx,sy,sw,sh);
}

function drawFireplace() {
  const fx=WALL_L+5, fy=H-150, fw=90, fh=120;
  // Stone surround
  ctx.fillStyle='#9a8878'; ctx.fillRect(fx,fy,fw,fh);
  ctx.fillStyle='#3a2a1a'; ctx.fillRect(fx+14,fy+20,fw-28,fh-20);
  // Mantel
  ctx.fillStyle='#8a6a3a'; ctx.fillRect(fx-5,fy-12,fw+10,14); ctx.fillRect(fx-2,fy-22,fw+4,12);
  // Mantel items: small vase + candle
  ctx.fillStyle='#8844aa'; ctx.fillRect(fx+8,fy-38,10,16); ctx.fillStyle='#aa66cc'; ctx.fillRect(fx+10,fy-41,6,5);
  ctx.fillStyle='#fffde7'; ctx.fillRect(fx+fw-20,fy-38,6,16);
  ctx.fillStyle=`rgba(255,200,50,${.8+Math.sin(tick*.1)*.2})`; ctx.beginPath(); ctx.ellipse(fx+fw-17,fy-42,2.5,4,0,0,Math.PI*2); ctx.fill();
  // Fire (animated)
  const fire = [['#ff4400',20],['#ff8800',14],['#ffcc00',9]];
  fire.forEach(([c,h]) => {
    ctx.fillStyle=c;
    ctx.beginPath();
    ctx.moveTo(fx+14,fy+fh-2);
    ctx.quadraticCurveTo(fx+30+Math.sin(tick*.08)*6,fy+fh-h*1.8,fx+fw/2,fy+fh-h*2.5);
    ctx.quadraticCurveTo(fx+fw-30+Math.cos(tick*.07)*6,fy+fh-h*1.8,fx+fw-14,fy+fh-2);
    ctx.closePath(); ctx.fill();
  });
  // Glow
  const fg=ctx.createRadialGradient(fx+fw/2,fy+fh-20,5,fx+fw/2,fy+fh-20,80);
  fg.addColorStop(0,`rgba(255,120,20,${.18+Math.sin(tick*.05)*.06})`); fg.addColorStop(1,'rgba(255,80,0,0)');
  ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(fx+fw/2,fy+fh-20,80,0,Math.PI*2); ctx.fill();
  // Ash
  ctx.fillStyle='#888'; ctx.beginPath(); ctx.ellipse(fx+fw/2,fy+fh-4,25,5,0,0,Math.PI*2); ctx.fill();
}

function drawReadingChair() {
  const cx=240, cy=H-90;
  ctx.fillStyle='#7a2a2a'; // Chair back
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx-22,cy-70,44,50,8) : ctx.fillRect(cx-22,cy-70,44,50);
  ctx.fill();
  ctx.fillStyle='#993333'; ctx.fillRect(cx-18,cy-66,36,28); // cushion highlight
  ctx.fillStyle='#7a2a2a'; ctx.fillRect(cx-22,cy-22,44,24); // seat
  ctx.fillStyle='#993333'; ctx.fillRect(cx-18,cy-18,36,14);
  ctx.fillStyle='#5a1a1a'; // Legs
  ctx.fillRect(cx-20,cy+2,8,14); ctx.fillRect(cx+12,cy+2,8,14);
  ctx.fillStyle='#7a2a2a'; // Armrests
  ctx.fillRect(cx-26,cy-35,8,22); ctx.fillRect(cx+18,cy-35,8,22);
  // Book on armrest
  ctx.fillStyle='#2244aa'; ctx.fillRect(cx+16,cy-45,14,18); ctx.fillStyle='#4466cc'; ctx.fillRect(cx+18,cy-44,10,4);
}

function drawDesk() {
  const dx=340, dy=H-160, dw=130, dh=55;
  ctx.fillStyle='#6a4a2a'; ctx.fillRect(dx,dy,dw,dh);
  ctx.fillStyle='#8a6a3a'; ctx.fillRect(dx,dy,dw,10);
  // Legs
  ctx.fillStyle='#5a3a1a'; ctx.fillRect(dx+8,dy+dh,12,22); ctx.fillRect(dx+dw-20,dy+dh,12,22);
  // Open book
  ctx.fillStyle='#f5eedd'; ctx.fillRect(dx+20,dy-18,60,20);
  ctx.fillStyle='#e8d8cc'; ctx.fillRect(dx+20,dy-18,30,20);
  ctx.strokeStyle='#6a4a2a'; ctx.lineWidth=.8;
  for (let l=0;l<6;l++) { ctx.beginPath(); ctx.moveTo(dx+24,dy-14+l*3); ctx.lineTo(dx+46,dy-14+l*3); ctx.stroke(); }
  for (let l=0;l<6;l++) { ctx.beginPath(); ctx.moveTo(dx+53,dy-14+l*3); ctx.lineTo(dx+75,dy-14+l*3); ctx.stroke(); }
  ctx.strokeStyle='#6a4a2a'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(dx+50,dy-18); ctx.lineTo(dx+50,dy+2); ctx.stroke();
  // Quill
  ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(dx+90,dy-22); ctx.lineTo(dx+78,dy-8); ctx.stroke();
  ctx.fillStyle='#f0f0d8'; ctx.beginPath(); ctx.moveTo(dx+90,dy-22); ctx.lineTo(dx+98,dy-30); ctx.lineTo(dx+94,dy-20); ctx.closePath(); ctx.fill();
  // Inkwell
  ctx.fillStyle='#2a2a3a'; ctx.beginPath(); ctx.arc(dx+100,dy-8,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#111128'; ctx.beginPath(); ctx.arc(dx+100,dy-9,4,0,Math.PI*2); ctx.fill();
  // Candle
  ctx.fillStyle='#fffde7'; ctx.fillRect(dx+dw-18,dy-24,8,26);
  ctx.fillStyle=`rgba(255,200,50,${.8+Math.sin(tick*.09)*.2})`; ctx.beginPath(); ctx.ellipse(dx+dw-14,dy-28,2.5,4,0,0,Math.PI*2); ctx.fill();
  const cg=ctx.createRadialGradient(dx+dw-14,dy-24,0,dx+dw-14,dy-24,20);
  cg.addColorStop(0,'rgba(255,220,100,0.2)'); cg.addColorStop(1,'rgba(255,180,50,0)');
  ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(dx+dw-14,dy-24,20,0,Math.PI*2); ctx.fill();
}

function drawGlobe() {
  const gx=580, gy=H-130;
  ctx.fillStyle='#6a4a2a'; ctx.fillRect(gx-4,gy,8,30); // post
  ctx.fillStyle='#5a3a1a'; ctx.beginPath(); ctx.ellipse(gx,gy+28,18,5,0,0,Math.PI*2); ctx.fill();
  // Globe sphere
  const sg=ctx.createRadialGradient(gx-8,gy-8,5,gx,gy,35);
  sg.addColorStop(0,'#6aa8d4'); sg.addColorStop(0.5,'#4488b8'); sg.addColorStop(1,'#224470');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(gx,gy,35,0,Math.PI*2); ctx.fill();
  // Landmasses (simple shapes)
  ctx.fillStyle='#5aaa5a';
  ctx.beginPath(); ctx.ellipse(gx-8,gy-5,14,10,-.4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(gx+12,gy+8,10,14,.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(gx-14,gy+12,8,6,0,0,Math.PI*2); ctx.fill();
  // Meridian lines
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=.8;
  ctx.beginPath(); ctx.arc(gx,gy,35,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(gx,gy,35,10,0,0,Math.PI*2); ctx.stroke();
  // Highlight
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(gx-12,gy-12,10,0,Math.PI*2); ctx.fill();
  // Ring
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(gx,gy,38,12,-.3,0,Math.PI*2); ctx.stroke();
}

// ─── Ballroom ─────────────────────────────────────────────
function drawBallroom() {
  drawCastleBase('ballroom');
  // Rug over floor center
  ctx.fillStyle='rgba(140,20,80,0.35)'; ctx.fillRect(150,CEIL_H+50,500,320);
  ctx.strokeStyle='rgba(255,200,100,0.4)'; ctx.lineWidth=3; ctx.strokeRect(165,CEIL_H+63,470,294);
  drawChandelier(W/2,CEIL_H-2,12,48);
  drawSconces();
  drawMirrors();
  drawBallroomBanners();
  drawBallroomStage();
  drawBallroomFlowers();
  drawConfetti();
  drawSideDoor('left'); // left door leads back to main hall
  drawRoomLabel('💃 Royal Ballroom');
}

function drawMirrors() {
  [[WALL_L+5,150,55,160],[WALL_R-60,150,55,160]].forEach(([mx,my,mw,mh]) => {
    ctx.fillStyle='#8a6a3a'; ctx.fillRect(mx-4,my-4,mw+8,mh+8);
    ctx.strokeStyle='#c8a878'; ctx.lineWidth=2;
    ctx.strokeRect(mx-2,my-2,mw+4,mh+4); ctx.strokeRect(mx+3,my+3,mw-6,mh-6);
    // Mirror surface
    const mg=ctx.createLinearGradient(mx,my,mx+mw,my+mh);
    mg.addColorStop(0,'rgba(200,230,255,0.35)'); mg.addColorStop(0.4,'rgba(220,240,255,0.55)'); mg.addColorStop(1,'rgba(180,210,240,0.3)');
    ctx.fillStyle=mg; ctx.fillRect(mx,my,mw,mh);
    // Reflection highlights
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(mx+5,my+5,12,mh-10);
    ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(mx+mw-10,my+5,6,mh-10);
    // Top arch
    ctx.fillStyle='#8a6a3a'; ctx.beginPath(); ctx.arc(mx+mw/2,my+1,mw/2+3,Math.PI,0); ctx.fill();
    const ma=ctx.createLinearGradient(mx,my-6,mx+mw,my-6);
    ma.addColorStop(0,'rgba(200,230,255,0.3)'); ma.addColorStop(1,'rgba(220,240,255,0.45)');
    ctx.fillStyle=ma; ctx.beginPath(); ctx.arc(mx+mw/2,my,mw/2,Math.PI,0); ctx.fill();
  });
}

function drawBallroomBanners() {
  [{x:WALL_L+14,c:'#8800cc'},{x:WALL_L+70,c:'#cc0066'},{x:WALL_L+126,c:'#0066cc'},
   {x:WALL_R-54,c:'#8800cc'},{x:WALL_R-110,c:'#cc0066'},{x:WALL_R-166,c:'#0066cc'}]
  .forEach(b => {
    ctx.fillStyle=b.c;
    ctx.beginPath(); ctx.moveTo(b.x,CEIL_H-2); ctx.lineTo(b.x+36,CEIL_H-2); ctx.lineTo(b.x+36,CEIL_H+70); ctx.lineTo(b.x+18,CEIL_H+56); ctx.lineTo(b.x,CEIL_H+70); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,220,100,0.6)'; ctx.lineWidth=1; ctx.stroke();
    // Star
    ctx.fillStyle='rgba(255,220,100,0.7)'; ctx.beginPath(); ctx.arc(b.x+18,CEIL_H+25,5,0,Math.PI*2); ctx.fill();
  });
  // Garland swags
  for (let seg=0;seg<4;seg++) {
    const sx=WALL_L+20+seg*165, ex=sx+150;
    ctx.strokeStyle='rgba(255,200,50,0.5)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(sx,CEIL_H+8); ctx.quadraticCurveTo((sx+ex)/2,CEIL_H+38,ex,CEIL_H+8); ctx.stroke();
    // Gems on garland
    for (let g=0;g<4;g++) {
      const t=g/3, gx=sx+(ex-sx)*t, gy=CEIL_H+8+Math.sin(t*Math.PI)*30;
      ctx.fillStyle=['#ff88cc','#ffdd44','#cc88ff','#88ccff'][g];
      ctx.beginPath(); ctx.arc(gx,gy,4,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawBallroomStage() {
  const sx=240,sy=CEIL_H+8,sw=320,sh=110;
  ctx.fillStyle='#5a3a1a'; ctx.fillRect(sx,sy,sw,sh);
  ctx.fillStyle='#7a5a2a'; ctx.fillRect(sx,sy,sw,10); // top edge
  ctx.fillStyle='rgba(255,200,80,0.15)'; ctx.fillRect(sx,sy,sw,sh); // warm glow
  // Curtains
  ctx.fillStyle='#880044';
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(sx+28,sy+35,sx+20,sy+sh); ctx.lineTo(sx,sy+sh); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sx+sw,sy); ctx.quadraticCurveTo(sx+sw-28,sy+35,sx+sw-20,sy+sh); ctx.lineTo(sx+sw,sy+sh); ctx.closePath(); ctx.fill();
  // Curtain highlights
  ctx.fillStyle='rgba(255,100,150,0.2)';
  ctx.beginPath(); ctx.moveTo(sx+4,sy); ctx.quadraticCurveTo(sx+18,sy+25,sx+12,sy+sh); ctx.lineTo(sx+4,sy+sh); ctx.closePath(); ctx.fill();
  // Center star
  ctx.fillStyle='rgba(255,220,80,0.5)';
  for (let pt=0;pt<5;pt++) {
    const a=(pt/5)*Math.PI*2-Math.PI/2, r1=20, r2=8;
    const x1=sx+sw/2+Math.cos(a)*r1, y1=sy+sh/2+Math.sin(a)*r1;
    const a2=a+Math.PI/5, x2=sx+sw/2+Math.cos(a2)*r2, y2=sy+sh/2+Math.sin(a2)*r2;
    if (pt===0) ctx.beginPath(), ctx.moveTo(x1,y1); else ctx.lineTo(x1,y1);
    ctx.lineTo(x2,y2);
  }
  ctx.closePath(); ctx.fill();
}

function drawBallroomFlowers() {
  [[140,H-90,0.9],[640,H-90,0.9],[140,H-200,0.68],[640,H-200,0.68]].forEach(([x,y,s]) => drawBouquet(x,y,s));
}

function drawConfetti() {
  confetti.forEach(c => {
    const cx2=c.x, cy2=c.y+((tick*c.speed*.8)%H);
    const a=(Math.sin(tick*.04+c.phase)*.5);
    ctx.save(); ctx.translate(cx2,cy2); ctx.rotate(a);
    ctx.fillStyle=c.color+'cc';
    ctx.fillRect(-4,-2,8,4);
    ctx.restore();
  });
}

// ─── Room label ───────────────────────────────────────────
function drawRoomLabel(label) {
  ctx.fillStyle='rgba(255,248,215,0.82)'; ctx.strokeStyle='#c8a030'; ctx.lineWidth=1.5;
  roundRect(W/2-80,8,160,24,6); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#5a3800'; ctx.font='bold 12px Georgia'; ctx.textAlign='center';
  ctx.fillText(label,W/2,25); ctx.textAlign='left';
}

// ═══════════════════════════════════════════════════════════
//  PRINCESS DRAWING
// ═══════════════════════════════════════════════════════════
function drawPrincess(p) {
  const x=p.x-p.w/2, y=p.y-p.h, bob=p.moving?Math.sin(p.frame*.8)*2:0;
  ctx.save(); ctx.translate(x+p.w/2,y+p.h/2+bob);
  if (p.facing===-1) ctx.scale(-1,1);
  ctx.translate(-p.w/2,-p.h/2);
  drawPrincessCrown(p.crownStyle);
  ctx.fillStyle='#c8860a'; ctx.beginPath(); ctx.ellipse(18,10,11,13,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#b87708'; ctx.beginPath(); ctx.moveTo(7,8); ctx.quadraticCurveTo(2,22,4,38); ctx.quadraticCurveTo(6,44,8,42); ctx.quadraticCurveTo(8,28,10,16); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#FDDBB4'; ctx.beginPath(); ctx.ellipse(18,10,8,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#4a2800'; ctx.beginPath(); ctx.arc(15,9,1.5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(21,9,1.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c0704a'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(18,12,3,.1,Math.PI-.1); ctx.stroke();
  ctx.fillStyle='rgba(255,150,120,0.4)'; ctx.beginPath(); ctx.arc(13,12,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(23,12,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e040a0'; ctx.beginPath(); ctx.moveTo(10,19); ctx.lineTo(26,19); ctx.lineTo(30,54); ctx.lineTo(6,54); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#f070c0'; ctx.beginPath(); ctx.moveTo(14,19); ctx.lineTo(22,19); ctx.lineTo(20,40); ctx.lineTo(16,40); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#cc2080'; ctx.fillRect(11,19,14,12);
  ctx.fillStyle='#FDDBB4';
  const arm=p.moving?Math.sin(p.frame*.8)*6:0;
  ctx.save(); ctx.translate(9,22); ctx.rotate(arm*Math.PI/180); ctx.fillRect(-3,0,6,14); ctx.restore();
  ctx.save(); ctx.translate(27,22); ctx.rotate(-arm*Math.PI/180); ctx.fillRect(-3,0,6,14); ctx.restore();
  const leg=p.moving?Math.sin(p.frame*.8)*4:0;
  ctx.fillStyle='#FDDBB4';
  ctx.save(); ctx.translate(14,52); ctx.rotate(leg*Math.PI/180); ctx.fillRect(-4,0,8,10); ctx.restore();
  ctx.save(); ctx.translate(22,52); ctx.rotate(-leg*Math.PI/180); ctx.fillRect(-4,0,8,10); ctx.restore();
  ctx.fillStyle='#cc2080'; ctx.beginPath(); ctx.ellipse(14,62,6,3,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(22,62,6,3,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawPrincessCrown(style) {
  if (style==='default') {
    ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.moveTo(10,-4); ctx.lineTo(10,4); ctx.lineTo(13,1); ctx.lineTo(16,5); ctx.lineTo(19,1); ctx.lineTo(22,4); ctx.lineTo(26,4); ctx.lineTo(26,-4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff44aa'; ctx.beginPath(); ctx.arc(13,1,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#44aaff'; ctx.beginPath(); ctx.arc(19,1,2,0,Math.PI*2); ctx.fill();
  } else if (style==='ruby') {
    ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.moveTo(10,4); ctx.lineTo(10,-1); ctx.lineTo(13,-10); ctx.lineTo(18,-4); ctx.lineTo(23,-10); ctx.lineTo(26,-1); ctx.lineTo(26,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff1133'; [13,18,23].forEach(gx=>{ctx.beginPath();ctx.arc(gx,-2,2.3,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#c8a030'; ctx.fillRect(10,2,16,3);
  } else if (style==='sapphire') {
    ctx.fillStyle='#C0C0C0'; ctx.beginPath(); ctx.moveTo(10,4);
    for (let i=0;i<5;i++){const ix=10+i*3.2;ctx.lineTo(ix,-1);ctx.lineTo(ix+1.2,-8+(i===2?-3:0));ctx.lineTo(ix+2,-1);}
    ctx.lineTo(26,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#2255ff'; [12,18,24].forEach(gx=>{ctx.beginPath();ctx.arc(gx,gx===18?-3:-1,1.9,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#aaaacc'; ctx.fillRect(10,2,16,3);
  } else if (style==='rose') {
    ctx.fillStyle='#FFB6C1'; ctx.beginPath(); ctx.moveTo(10,4); ctx.lineTo(10,-1); ctx.lineTo(14,-8); ctx.lineTo(18,-2); ctx.lineTo(22,-8); ctx.lineTo(26,-1); ctx.lineTo(26,4); ctx.closePath(); ctx.fill();
    [[14,-1],[18,0],[22,-1]].forEach(([gx,gy])=>{
      for(let p=0;p<5;p++){const a=(p/5)*Math.PI*2;ctx.fillStyle='#ff66aa';ctx.beginPath();ctx.arc(gx+Math.cos(a)*2.3,gy+Math.sin(a)*2.3,1.1,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(gx,gy,1.1,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle='#ee9988'; ctx.fillRect(10,2,16,3);
  }
}

// ── Unicorn ───────────────────────────────────────────────────
function drawUnicorn(u) {
  const x=u.x-u.w/2,y=u.y-u.h,bob=Math.sin(u.frame*.5)*1.5;
  ctx.save();ctx.translate(x+u.w/2,y+u.h/2+bob);if(u.dir===-1)ctx.scale(-1,1);ctx.translate(-u.w/2,-u.h/2);
  ctx.fillStyle='#f5e6ff';ctx.beginPath();ctx.ellipse(26,22,22,14,-.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f0deff';ctx.beginPath();ctx.moveTo(36,12);ctx.lineTo(44,4);ctx.lineTo(48,10);ctx.lineTo(40,18);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f5e6ff';ctx.beginPath();ctx.ellipse(47,6,9,7,.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFD700';ctx.beginPath();ctx.moveTo(54,-4);ctx.lineTo(50,0);ctx.lineTo(58,2);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6a3aa2';ctx.beginPath();ctx.arc(51,5,2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(52,4.5,.7,0,Math.PI*2);ctx.fill();
  ['#ff99dd','#cc88ff','#88ccff','#ffeeaa'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(42-i*2,4+i*3,4,6,-.5+i*.2,0,Math.PI*2);ctx.fill();});
  ['#ff88cc','#dd88ff','#88ddff'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(5,16+i*2);ctx.quadraticCurveTo(-6,22+i*3,-2,34+i*2);ctx.quadraticCurveTo(2,40,5,36+i);ctx.quadraticCurveTo(0,28,6,20+i*2);ctx.closePath();ctx.fill();});
  const ls=Math.sin(u.frame*.7)*5;
  [{bx:14,by:30},{bx:22,by:30},{bx:30,by:30},{bx:38,by:30}].forEach((leg,i)=>{
    ctx.fillStyle='#ede0ff';ctx.save();ctx.translate(leg.bx+3,leg.by);ctx.rotate(((i%2===0?ls:-ls)*Math.PI)/180);ctx.fillRect(-3,0,6,12);ctx.restore();
    ctx.fillStyle='#d4b0f0';const hx=leg.bx+Math.sin(((i%2===0?ls:-ls)*Math.PI)/180)*8;ctx.beginPath();ctx.ellipse(hx+3,leg.by+13,5,3,0,0,Math.PI*2);ctx.fill();
  });
  ctx.restore();
}

// ── Dialog / prompt ───────────────────────────────────────────
function drawDialog() {
  if (!dialog) return;
  ctx.fillStyle='rgba(255,240,255,0.93)'; ctx.strokeStyle='#cc44aa'; ctx.lineWidth=2;
  roundRect(W/2-175,H/2-34,350,68,12); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#6a1a4a'; ctx.font='bold 14px Georgia'; ctx.textAlign='center';
  ctx.fillText(dialog,W/2,H/2+7); ctx.textAlign='left';
}
function drawPrompt(msg) {
  if (!msg) return;
  ctx.fillStyle='rgba(255,248,215,0.92)'; ctx.strokeStyle='#c8a030'; ctx.lineWidth=1.8;
  roundRect(W/2-180,H-48,360,36,8); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#5a3800'; ctx.font='13px Georgia'; ctx.textAlign='center';
  ctx.fillText(msg,W/2,H-24); ctx.textAlign='left';
}

// ═══════════════════════════════════════════════════════════
//  UPDATE
// ═══════════════════════════════════════════════════════════
function moveInput() {
  return {
    dx:(keys['ArrowRight']||keys['d']||keys['D']?1:0)-(keys['ArrowLeft']||keys['a']||keys['A']?1:0),
    dy:(keys['ArrowDown'] ||keys['s']||keys['S']?1:0)-(keys['ArrowUp']  ||keys['w']||keys['W']?1:0),
  };
}

function updatePrincessGarden() {
  const {dx,dy}=moveInput();
  princess.moving=dx!==0||dy!==0;
  if (dx!==0) princess.facing=dx;
  princess.x=Math.max(princess.w/2,Math.min(WORLD_W-princess.w/2,princess.x+dx*princess.speed));
  princess.y=Math.max(H*.55+princess.h,Math.min(H-10,princess.y+dy*princess.speed));
  if (princess.moving){princess.frameTimer++;if(princess.frameTimer>6){princess.frame++;princess.frameTimer=0;}}else princess.frame=0;

  const nearGate=Math.abs(princess.x-CASTLE_WX)<55&&princess.y<=H*.575+princess.h;
  promptMsg=nearGate?'Press ENTER to enter the castle ✨':null;
  if (nearGate&&!dialog&&consumeAction()&&fadeDir===0) {
    triggerFade({type:'toScene',scene:'castle'}); promptMsg=null;
  }
  if (!nearGate&&!dialog) {
    gardenSigns.forEach(s=>{
      if (Math.abs(princess.x-(s.x+s.width/2))<44&&Math.abs(princess.y-s.y-60)<60) showDialog(s.label.replace('\n',' '));
    });
  }
}

function updatePrincessCastle() {
  const {dx,dy}=moveInput();
  princess.moving=dx!==0||dy!==0;
  if (dx!==0) princess.facing=dx;
  princess.x=Math.max(WALL_L+princess.w/2,Math.min(WALL_R-princess.w/2,princess.x+dx*princess.speed));
  princess.y=Math.max(195,Math.min(H-18,princess.y+dy*princess.speed));
  if (princess.moving){princess.frameTimer++;if(princess.frameTimer>6){princess.frame++;princess.frameTimer=0;}}else princess.frame=0;

  promptMsg=null;
  if (dialog) return;

  // Crown interactions (main hall only)
  let crownNear=false;
  if (castleRoom==='main') {
    castleCrowns.forEach(c=>{
      if (Math.hypot(princess.x-c.x,princess.y-c.y)>82) return;
      crownNear=true;
      if (!c.taken && princess.crownStyle==='default') {
        promptMsg=`Press ENTER to wear the ${c.name} 👑`;
        if (consumeAction()) { c.taken=true; princess.crownStyle=c.style; showDialog(`✨ You are wearing the ${c.name}! ✨`,240); }
      } else if (!c.taken && princess.crownStyle!=='default') {
        promptMsg=`You're already wearing a crown!`;
      } else if (c.taken && princess.crownStyle===c.style) {
        promptMsg=`Press ENTER to return the ${c.name}`;
        if (consumeAction()) { c.taken=false; princess.crownStyle='default'; showDialog(`Crown returned to its pedestal. ✨`,180); }
      }
    });
  }

  if (crownNear) return;

  // Room door transitions
  const ROOM_LINKS={main:{left:'library',right:'ballroom'},library:{right:'main'},ballroom:{left:'main'}};
  const ROOM_NAMES={main:'Grand Hall',library:'Royal Library',ballroom:'Royal Ballroom'};
  const links=ROOM_LINKS[castleRoom]||{};

  if (links.left&&princess.x<105&&Math.abs(princess.y-310)<72) {
    promptMsg=`Press ENTER to enter the ${ROOM_NAMES[links.left]}`;
    if (consumeAction()&&fadeDir===0) triggerFade({type:'toRoom',room:links.left,fromLeft:false});
  } else if (links.right&&princess.x>695&&Math.abs(princess.y-310)<72) {
    promptMsg=`Press ENTER to enter the ${ROOM_NAMES[links.right]}`;
    if (consumeAction()&&fadeDir===0) triggerFade({type:'toRoom',room:links.right,fromLeft:true});
  } else if (castleRoom==='main'&&Math.abs(princess.x-W/2)<68&&princess.y>H-140) {
    promptMsg='Press ENTER to go back outside 🌸';
    if (consumeAction()&&fadeDir===0) triggerFade({type:'toScene',scene:'garden'});
  }
}

function updateUnicorn() {
  unicorn.wanderTimer++;
  if (unicorn.wanderTimer>unicorn.wanderDuration){
    unicorn.dir=Math.random()<.5?1:-1; unicorn.wanderDuration=80+Math.random()*200; unicorn.wanderTimer=0;
  }
  unicorn.x+=unicorn.dir*unicorn.speed;
  unicorn.x=Math.max(200,Math.min(WORLD_W-200,unicorn.x));
  if (unicorn.x<=200||unicorn.x>=WORLD_W-200) unicorn.dir*=-1;
  unicorn.frameTimer++;if(unicorn.frameTimer>8){unicorn.frame++;unicorn.frameTimer=0;}
  if (Math.abs(princess.x-unicorn.x)<65&&!dialog) showDialog('✨ Hello, Princess Anya! ✨');
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
function gameLoop() {
  ctx.clearRect(0,0,W,H);
  tick++;

  if (scene==='garden') {
    drawGardenScene();
    updatePrincessGarden();
    updateUnicorn();
    updateCamera();
  } else {
    if      (castleRoom==='main')     drawMainHall();
    else if (castleRoom==='library')  drawLibrary();
    else if (castleRoom==='ballroom') drawBallroom();
    drawPrincess(princess);
    updatePrincessCastle();
  }

  if (!dialog) drawPrompt(promptMsg);
  drawDialog();
  if (dialog){dialogTimer--;if(dialogTimer<=0)dialog=null;}

  updateFade();
  drawFade();

  Object.keys(justPressed).forEach(k=>{justPressed[k]=false;});
  requestAnimationFrame(gameLoop);
}

gameLoop();
