// ============================================================
//  Anya's Adventure — main game
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 800
const H = canvas.height;  // 500

// ── Input ────────────────────────────────────────────────────
const keys = {};
const justPressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.key]) justPressed[e.key] = true;
  keys[e.key] = true;
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

function consumeKey(key) {
  if (justPressed[key]) { justPressed[key] = false; return true; }
  return false;
}
function consumeAction() { return consumeKey('Enter') || consumeKey(' '); }

// ── Scene / fade ─────────────────────────────────────────────
let scene      = 'garden';
let fadeAlpha  = 0;
let fadeDir    = 0;   // 1 = fading out, -1 = fading in
let fadeTo     = null;

function triggerFade(toScene) {
  if (fadeDir !== 0) return;
  fadeDir = 1;
  fadeTo  = toScene;
}

function updateFade() {
  if (fadeDir === 0) return;
  fadeAlpha = Math.max(0, Math.min(1, fadeAlpha + fadeDir * 0.055));
  if (fadeAlpha >= 1 && fadeDir === 1) {
    scene = fadeTo;
    if (scene === 'castle') { princess.x = W / 2; princess.y = H - 70; }
    else                    { princess.x = W / 2; princess.y = H * 0.57 + princess.h; }
    fadeDir = -1;
  }
  if (fadeAlpha <= 0 && fadeDir === -1) { fadeAlpha = 0; fadeDir = 0; fadeTo = null; }
}

function drawFade() {
  if (fadeAlpha <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
  ctx.fillRect(0, 0, W, H);
}

// ── Princess ─────────────────────────────────────────────────
const princess = {
  x: W / 2, y: H - 140,
  w: 36, h: 54,
  speed: 3,
  facing: 1,
  frame: 0, frameTimer: 0,
  moving: false,
  crownStyle: 'default',
};

// ── Unicorn (garden only) ─────────────────────────────────────
const unicorn = {
  x: 180, y: H - 130,
  w: 52, h: 42,
  frame: 0, frameTimer: 0,
  dir: 1, speed: 0.6,
  wanderTimer: 0, wanderDuration: 120,
};

// ── Garden decorations ────────────────────────────────────────
const rawFlowers = [];
for (let i = 0; i < 28; i++) {
  rawFlowers.push({
    x: 30 + Math.random() * (W - 60),
    y: H - 80 + Math.random() * 30,
    color: ['#ff88cc','#ffdd44','#ff66aa','#cc88ff','#ff99bb'][i % 5],
    size: 5 + Math.random() * 5,
    stem: 8 + Math.random() * 10,
  });
}
const gardenFlowers = rawFlowers.filter(f => f.x < W/2 - 80 || f.x > W/2 + 80);

const bushes = [
  { x: 40,  y: H - 105, w: 55, h: 35 },
  { x: 120, y: H - 100, w: 45, h: 30 },
  { x: 660, y: H - 100, w: 50, h: 32 },
  { x: 720, y: H - 105, w: 55, h: 35 },
];

const gardenSigns = [
  { x: 90,  y: H - 175, label: '🌸 Rose\nGarden',    width: 90  },
  { x: 650, y: H - 175, label: '🦋 Butterfly\nMeadow', width: 110 },
];

// ── Castle crowns ─────────────────────────────────────────────
const castleCrowns = [
  { x: 175, y: 275, name: 'Ruby Crown',     style: 'ruby',     color: '#FFD700', gem: '#ff1133', taken: false },
  { x: 400, y: 265, name: 'Sapphire Crown', style: 'sapphire', color: '#C0C0C0', gem: '#2255ff', taken: false },
  { x: 625, y: 275, name: 'Rose Crown',     style: 'rose',     color: '#FFB6C1', gem: '#ff66aa', taken: false },
];

// ── Dialog / prompt ───────────────────────────────────────────
let dialog      = null;
let dialogTimer = 0;
let promptMsg   = null;

function showDialog(msg, dur = 200) { dialog = msg; dialogTimer = dur; }

// ── Tick (animations) ─────────────────────────────────────────
let tick = 0;

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r,       r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,   x + r, y,             r);
  ctx.closePath();
}

// ══════════════════════════════════════════════════════════════
//  GARDEN SCENE
// ══════════════════════════════════════════════════════════════
function drawGardenBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#87CEEB'); sky.addColorStop(1, '#d4f0ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.55);

  ctx.fillStyle = '#b8e8b0';
  ctx.beginPath(); ctx.ellipse(180, H*0.54, 180, 90, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.ellipse(620, H*0.52, 200,100, 0, Math.PI, 0); ctx.fill();

  const ground = ctx.createLinearGradient(0, H*0.5, 0, H);
  ground.addColorStop(0, '#5cb85c'); ground.addColorStop(0.4,'#4cae4c'); ground.addColorStop(1,'#3d8b3d');
  ctx.fillStyle = ground; ctx.fillRect(0, H*0.5, W, H*0.5);
}

function drawCastle() {
  const cx = W/2, baseY = H*0.15, bw = 180, bh = 150, bx = cx - bw/2;

  ctx.fillStyle = '#e8ddd0'; ctx.fillRect(bx, baseY, bw, bh);

  ctx.fillStyle = '#d4c9bc';
  for (let mx = bx; mx < bx+bw-17; mx += 26) ctx.fillRect(mx, baseY-20, 18, 20);

  ctx.fillStyle = '#ddd2c5';
  ctx.fillRect(bx-28, baseY+10, 50, bh-10); drawTowerTop(bx-3, baseY+10, 50, '#b83c6e');
  ctx.fillRect(bx+bw-22, baseY+10, 50, bh-10); drawTowerTop(bx+bw-22, baseY+10, 50, '#b83c6e');
  ctx.fillStyle = '#e8ddd0';
  ctx.fillRect(cx-22, baseY-50, 44, 60); drawTowerTop(cx-22, baseY-50, 44, '#9b1c4a');

  // Gate (dark + warm glow to invite entry)
  ctx.fillStyle = '#3a2015';
  ctx.beginPath(); ctx.arc(cx, baseY+bh-28, 24, Math.PI, 0);
  ctx.rect(cx-24, baseY+bh-28, 48, 28); ctx.fill();
  const glow = ctx.createRadialGradient(cx, baseY+bh-10, 2, cx, baseY+bh-10, 28);
  glow.addColorStop(0,'rgba(255,210,80,0.45)'); glow.addColorStop(1,'rgba(255,180,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, baseY+bh-10, 28, Math.PI, 0);
  ctx.rect(cx-28, baseY+bh-10, 56, 18); ctx.fill();

  drawWindow(cx-45, baseY+40); drawWindow(cx+28, baseY+40); drawWindow(cx-10, baseY+30);
  drawFlag(cx+11, baseY-82, '#ff6699');
  drawFlag(bx+15, baseY-22,  '#ff99cc');
  drawFlag(bx+bw-4, baseY-22,'#ff99cc');
}

function drawTowerTop(x, y, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x+w/2,y-30); ctx.lineTo(x,y); ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d4c9bc';
  for (let i = 0; i < 3; i++) ctx.fillRect(x+4+i*14, y-14, 10, 14);
}
function drawWindow(x, y) {
  ctx.fillStyle = '#a0cce8';
  ctx.beginPath(); ctx.arc(x+8,y+8,8,Math.PI,0); ctx.rect(x,y+8,16,12); ctx.fill();
  ctx.strokeStyle='#8a7060'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(x+8,y+8,8,Math.PI,0); ctx.moveTo(x,y+8); ctx.lineTo(x+16,y+8); ctx.stroke();
}
function drawFlag(x, y, color) {
  ctx.strokeStyle='#7a5c3a'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+32); ctx.stroke();
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+18,y+7); ctx.lineTo(x,y+14); ctx.closePath(); ctx.fill();
}

function drawPath() {
  const g = ctx.createLinearGradient(0,H*0.5,0,H);
  g.addColorStop(0,'#d4b896'); g.addColorStop(1,'#c8a878');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(W/2-22,H*0.48); ctx.lineTo(W/2+22,H*0.48);
  ctx.lineTo(W/2+70,H);      ctx.lineTo(W/2-70,H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#b0946a'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
  ctx.beginPath(); ctx.moveTo(W/2-22,H*0.48); ctx.lineTo(W/2-70,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W/2+22,H*0.48); ctx.lineTo(W/2+70,H); ctx.stroke();
  ctx.setLineDash([]);
}

function drawGardenBushes() {
  bushes.forEach(b => {
    ctx.fillStyle='#3a7d44';
    ctx.beginPath(); ctx.ellipse(b.x+b.w*.3,b.y+b.h*.6,b.w*.35,b.h*.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(b.x+b.w*.6,b.y+b.h*.55,b.w*.38,b.h*.55,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a9455';
    ctx.beginPath(); ctx.ellipse(b.x+b.w*.5,b.y+b.h*.4,b.w*.3,b.h*.45,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff88cc';
    [.3,.6,.8].forEach(t => { ctx.beginPath(); ctx.arc(b.x+b.w*t,b.y+b.h*.2,3,0,Math.PI*2); ctx.fill(); });
  });
}

function drawGardenFlowers() {
  gardenFlowers.forEach(f => {
    ctx.strokeStyle='#4a8c3f'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x,f.y-f.stem); ctx.stroke();
    for (let p=0;p<5;p++) {
      const a=(p/5)*Math.PI*2;
      ctx.fillStyle=f.color;
      ctx.beginPath(); ctx.arc(f.x+Math.cos(a)*f.size,f.y-f.stem+Math.sin(a)*f.size,f.size*.55,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#ffe566';
    ctx.beginPath(); ctx.arc(f.x,f.y-f.stem,f.size*.4,0,Math.PI*2); ctx.fill();
  });
}

function drawGardenSigns() {
  gardenSigns.forEach(s => {
    ctx.fillStyle='#8B5E3C'; ctx.fillRect(s.x+s.width/2-4,s.y+30,8,30);
    ctx.fillStyle='#f5deb3'; ctx.strokeStyle='#8B5E3C'; ctx.lineWidth=2;
    roundRect(s.x,s.y,s.width,30,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#5a3825'; ctx.font='10px Georgia'; ctx.textAlign='center';
    s.label.split('\n').forEach((ln,i) => ctx.fillText(ln,s.x+s.width/2,s.y+11+i*12));
    ctx.textAlign='left';
  });
}

// ══════════════════════════════════════════════════════════════
//  CASTLE INTERIOR
// ══════════════════════════════════════════════════════════════
const CEIL_H = 90;
const WALL_L = 68;
const WALL_R = W - 68;

function drawCastleInterior() {
  drawCastleFloor();
  drawCastleWalls();
  drawCastleCeiling();
  drawChandelier();
  drawWallSconces();
  drawCastleBanners();
  drawThrone();
  drawCastleBouquets();
  drawCrownPedestals();
  drawExitDoor();
}

function drawCastleFloor() {
  const ts = 50;
  for (let row = 0; row * ts < H; row++) {
    for (let col = 0; col * ts < W; col++) {
      ctx.fillStyle = (row+col)%2===0 ? '#ede5d8' : '#d8d0c4';
      ctx.fillRect(col*ts, CEIL_H+row*ts, ts, ts);
    }
  }
  ctx.strokeStyle='#c4bdb4'; ctx.lineWidth=0.5;
  for (let x=0;x<=W;x+=ts) { ctx.beginPath(); ctx.moveTo(x,CEIL_H); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=CEIL_H;y<=H;y+=ts) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawCastleWalls() {
  // Left wall
  const lg = ctx.createLinearGradient(0,0,WALL_L,0);
  lg.addColorStop(0,'#6a5a4a'); lg.addColorStop(1,'#b8a898');
  ctx.fillStyle=lg; ctx.fillRect(0,0,WALL_L,H);
  // Right wall
  const rg = ctx.createLinearGradient(WALL_R,0,W,0);
  rg.addColorStop(0,'#b8a898'); rg.addColorStop(1,'#6a5a4a');
  ctx.fillStyle=rg; ctx.fillRect(WALL_R,0,W-WALL_R,H);
  // Brick lines on walls
  for (let row=0;row<14;row++) {
    const off = row%2===0 ? 0 : -16;
    ctx.strokeStyle='#5a4a3a'; ctx.lineWidth=0.7;
    for (let b=0;b<2;b++) {
      ctx.strokeRect(b*38+off-4, row*38+4, 36, 16);
      ctx.strokeRect(WALL_R+b*38+off, row*38+4, 36, 16);
    }
  }
}

function drawCastleCeiling() {
  const cg = ctx.createLinearGradient(0,0,0,CEIL_H);
  cg.addColorStop(0,'#4a3a2a'); cg.addColorStop(1,'#7a6a5a');
  ctx.fillStyle=cg; ctx.fillRect(0,0,W,CEIL_H);
  // Ornate border
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2.5;
  ctx.strokeRect(WALL_L+8, CEIL_H-14, WALL_R-WALL_L-16, 11);
  ctx.strokeStyle='#a08050'; ctx.lineWidth=1;
  ctx.strokeRect(WALL_L+3, CEIL_H-18, WALL_R-WALL_L-6, 18);
  // Coffered panels
  for (let i=0;i<4;i++) {
    const px = WALL_L+18+i*163;
    ctx.fillStyle='#3a2a1a'; ctx.fillRect(px,6,138,58);
    ctx.strokeStyle='#c8a878'; ctx.lineWidth=1.5; ctx.strokeRect(px+4,10,130,50);
    ctx.fillStyle='#c8a878';
    ctx.beginPath(); ctx.arc(px+69,35,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#a08050'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(px+69,35,9,0,Math.PI*2); ctx.stroke();
  }
}

function drawChandelier() {
  const cx = W/2, cy = CEIL_H-2;
  const pulse = 1+Math.sin(tick*0.03)*0.08;
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,2); ctx.lineTo(cx,cy-18); ctx.stroke();
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,36,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#b89868';
  ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();

  for (let i=0;i<8;i++) {
    const a = (i/8)*Math.PI*2;
    const cx2 = cx+Math.cos(a)*36, cy2 = cy+Math.sin(a)*36;
    const glow = ctx.createRadialGradient(cx2,cy2-7,0,cx2,cy2-7,20*pulse);
    glow.addColorStop(0,'rgba(255,220,100,0.38)'); glow.addColorStop(1,'rgba(255,180,50,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx2,cy2-7,20*pulse,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fffde7'; ctx.fillRect(cx2-2.5,cy2-9,5,11);
    ctx.fillStyle=`rgba(255,200,50,${0.85+Math.sin(tick*0.1+i)*.15})`;
    ctx.beginPath(); ctx.ellipse(cx2,cy2-13,2.5,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,200,0.7)';
    ctx.beginPath(); ctx.ellipse(cx2,cy2-14,1.2,2.5,0,0,Math.PI*2); ctx.fill();
  }
  // Hanging sparkles
  for (let i=0;i<6;i++) {
    const a = (i/6)*Math.PI*2+tick*0.012;
    const r = 48+Math.sin(tick*0.05+i)*7;
    const sx=cx+Math.cos(a)*r, sy=cy+Math.sin(a)*r*0.38;
    const al=(Math.sin(tick*0.07+i*1.3)+1)/2;
    ctx.fillStyle=`rgba(255,240,150,${al*0.6})`;
    ctx.beginPath(); ctx.arc(sx,sy,1.8,0,Math.PI*2); ctx.fill();
  }
}

function drawWallSconces() {
  [
    {x:WALL_L+2,  y:185, right:false},
    {x:WALL_L+2,  y:345, right:false},
    {x:WALL_R-2,  y:185, right:true },
    {x:WALL_R-2,  y:345, right:true },
  ].forEach((s,idx) => {
    const dir = s.right ? -1 : 1;
    const bx  = s.x + dir*6;
    const pulse = 0.25+Math.sin(tick*0.04+idx)*0.1;
    ctx.fillStyle='#8a6a3a'; ctx.fillRect(s.x-3, s.y-3, 14*dir, 7);
    const gw = ctx.createRadialGradient(bx,s.y-10,0,bx,s.y-10,28);
    gw.addColorStop(0,`rgba(255,220,100,${pulse+0.1})`); gw.addColorStop(1,'rgba(255,180,50,0)');
    ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(bx,s.y-10,28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fffde7'; ctx.fillRect(bx-2.5,s.y-11,5,13);
    ctx.fillStyle=`rgba(255,200,50,${0.85+Math.sin(tick*0.08+idx*.7)*.15})`;
    ctx.beginPath(); ctx.ellipse(bx,s.y-16,2.5,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,200,0.7)';
    ctx.beginPath(); ctx.ellipse(bx,s.y-17,1.2,2.5,0,0,Math.PI*2); ctx.fill();
  });
}

function drawCastleBanners() {
  [
    {x:WALL_L+14, color:'#cc2080', gem:'#ff88cc'},
    {x:WALL_L+74, color:'#7722bb', gem:'#cc88ff'},
    {x:WALL_R-114,color:'#7722bb', gem:'#cc88ff'},
    {x:WALL_R-54, color:'#cc2080', gem:'#ff88cc'},
  ].forEach(b => {
    const bw=40,bh=88,by=CEIL_H-2;
    ctx.fillStyle=b.color;
    ctx.beginPath(); ctx.moveTo(b.x,by); ctx.lineTo(b.x+bw,by);
    ctx.lineTo(b.x+bw,by+bh); ctx.lineTo(b.x+bw/2,by+bh-14); ctx.lineTo(b.x,by+bh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(b.x+4,by+4); ctx.lineTo(b.x+bw-4,by+4);
    ctx.lineTo(b.x+bw-4,by+bh-14); ctx.lineTo(b.x+bw/2,by+bh-20); ctx.lineTo(b.x+4,by+bh-14);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle=b.gem;
    ctx.beginPath(); ctx.arc(b.x+bw/2,by+34,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFD700';
    for (let pt=0;pt<5;pt++) {
      const a=(pt/5)*Math.PI*2;
      ctx.beginPath(); ctx.arc(b.x+bw/2+Math.cos(a)*5.5,by+34+Math.sin(a)*5.5,1.8,0,Math.PI*2); ctx.fill();
    }
  });
}

function drawThrone() {
  const tx=W/2-28, ty=CEIL_H+5, tw=56, th=74;
  ctx.fillStyle='#7a5a2a'; ctx.fillRect(tx+2,ty+th-12,10,12); ctx.fillRect(tx+tw-12,ty+th-12,10,12);
  ctx.fillStyle='#cc2080'; ctx.fillRect(tx,ty+th-22,tw,22);
  ctx.fillStyle='#ee60aa'; ctx.fillRect(tx+4,ty+th-19,tw-8,7);
  ctx.fillStyle='#8a6a3a'; ctx.fillRect(tx,ty,tw,th-20);
  ctx.strokeStyle='#c8a030'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(tx+tw/2,ty+10,tw/2-3,Math.PI,0); ctx.stroke();
  ctx.fillStyle='#ff4488'; ctx.beginPath(); ctx.arc(tx+tw/2,ty+12,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(tx+tw/2,ty+12,3.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#6a4a1a';
  ctx.fillRect(tx-8,ty+th-42,11,20); ctx.fillRect(tx+tw-3,ty+th-42,11,20);
  ctx.fillStyle='#c8a030';
  ctx.beginPath(); ctx.arc(tx+3,ty-4,5.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx+tw-3,ty-4,5.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx+tw/2,ty-7,7,0,Math.PI*2); ctx.fill();
}

function drawCastleBouquets() {
  drawBouquet(120, 420, 1.0);
  drawBouquet(670, 420, 1.0);
  drawBouquet(158, 305, 0.78);
  drawBouquet(638, 305, 0.78);
}

function drawBouquet(cx, cy, s) {
  // Vase
  ctx.fillStyle='#8a6a9a';
  ctx.beginPath();
  ctx.moveTo(cx-14*s,cy); ctx.lineTo(cx-18*s,cy+28*s);
  ctx.lineTo(cx+18*s,cy+28*s); ctx.lineTo(cx+14*s,cy);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#9a7aaa'; ctx.fillRect(cx-9*s,cy-7*s,18*s,9*s);
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(cx-5*s,cy+4*s,5*s,16*s);
  ctx.fillStyle='#7a5a8a';
  ctx.beginPath(); ctx.ellipse(cx,cy+28*s,18*s,5.5*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c8a878'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.ellipse(cx,cy-7*s,9*s,3.5*s,0,0,Math.PI*2); ctx.stroke();
  // Stems
  [-10*s,0,10*s,-16*s,16*s].forEach((off,i) => {
    ctx.strokeStyle=i%2===0?'#4a8c3f':'#3d7a35'; ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(cx+off*.5,cy-7*s);
    ctx.quadraticCurveTo(cx+off*.3,cy-24*s, cx+off,cy-48*s);
    ctx.stroke();
  });
  // Flowers
  const fc=['#ff88cc','#ff44aa','#cc44ff','#ffdd44','#ff66aa','#44bbff','#ff99bb','#ddaaff'];
  [
    {dx:-15*s,dy:-58*s},{dx:0,dy:-65*s},{dx:15*s,dy:-58*s},
    {dx:-24*s,dy:-48*s},{dx:24*s,dy:-48*s},
    {dx:-7*s, dy:-53*s},{dx:7*s, dy:-53*s},
    {dx:-18*s,dy:-39*s},{dx:18*s,dy:-39*s},
  ].forEach((fp,fi) => {
    const fx=cx+fp.dx, fy=cy+fp.dy, sz=(5+fi%3*1.5)*s;
    for (let p=0;p<5;p++) {
      const a=(p/5)*Math.PI*2;
      ctx.fillStyle=fc[fi%fc.length];
      ctx.beginPath(); ctx.arc(fx+Math.cos(a)*sz,fy+Math.sin(a)*sz,sz*.6,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#ffe566'; ctx.beginPath(); ctx.arc(fx,fy,sz*.45,0,Math.PI*2); ctx.fill();
  });
  // Leaves
  [-1,1].forEach(d => {
    ctx.save(); ctx.translate(cx+d*8*s,cy-33*s); ctx.rotate(d*0.6);
    ctx.fillStyle='#4a8c3f';
    ctx.beginPath(); ctx.ellipse(0,0,9*s,4.5*s,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

function drawCrownPedestals() {
  castleCrowns.forEach(c => {
    drawPedestal(c.x, c.y);
    if (!c.taken) {
      // Glow
      const r = 22+Math.sin(tick*0.05)*4;
      const gw = ctx.createRadialGradient(c.x,c.y-28,0,c.x,c.y-28,r);
      gw.addColorStop(0,'rgba(255,240,150,0.32)'); gw.addColorStop(1,'rgba(255,240,150,0)');
      ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(c.x,c.y-28,r,0,Math.PI*2); ctx.fill();
      drawCrownItem(c.x, c.y-18, c.style, c.color, c.gem);
    }
  });
}

function drawPedestal(cx, cy) {
  const g = ctx.createLinearGradient(cx-12,0,cx+12,0);
  g.addColorStop(0,'#8a7a6a'); g.addColorStop(0.35,'#d4c8b8');
  g.addColorStop(0.65,'#d4c8b8'); g.addColorStop(1,'#8a7a6a');
  ctx.fillStyle=g; ctx.fillRect(cx-11,cy-4,22,33);
  ctx.fillStyle='#c4b8a8'; ctx.fillRect(cx-17,cy+27,34,7);
  ctx.fillStyle='#b0a498'; ctx.fillRect(cx-21,cy+33,42,6);
  // Velvet cushion
  ctx.fillStyle='#962060'; ctx.fillRect(cx-15,cy-12,30,10);
  ctx.fillStyle='#c04080'; ctx.fillRect(cx-12,cy-11,24,4);
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=1; ctx.strokeRect(cx-15,cy-12,30,10);
}

function drawCrownItem(cx, cy, style, color, gem) {
  ctx.save(); ctx.translate(cx, cy);
  if (style==='ruby') {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(-13,8); ctx.lineTo(-13,0); ctx.lineTo(-7,-13);
    ctx.lineTo(0,-5); ctx.lineTo(7,-13); ctx.lineTo(13,0); ctx.lineTo(13,8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#c8a030'; ctx.lineWidth=1; ctx.stroke();
    [{x:-5,y:-3},{x:0,y:-3},{x:5,y:-3}].forEach(g => {
      ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(g.x,g.y,2.5,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle='#c8a030'; ctx.fillRect(-13,5,26,4);
  } else if (style==='sapphire') {
    ctx.fillStyle=color;
    ctx.beginPath(); ctx.moveTo(-13,8);
    for (let i=0;i<5;i++) {
      const ix=-13+i*6.5;
      ctx.lineTo(ix,0); ctx.lineTo(ix+2,-11+(i===2?-3:0)); ctx.lineTo(ix+4.5,0);
    }
    ctx.lineTo(13,8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#9090aa'; ctx.lineWidth=0.8; ctx.stroke();
    [-8,0,8].forEach((gx,i) => {
      ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(gx,i===1?-9:-7,2.2,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle='#aaaacc'; ctx.fillRect(-13,5,26,4);
  } else if (style==='rose') {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(-13,8); ctx.lineTo(-13,0); ctx.lineTo(-6,-9);
    ctx.lineTo(0,-3); ctx.lineTo(6,-9); ctx.lineTo(13,0); ctx.lineTo(13,8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#cc8888'; ctx.lineWidth=0.8; ctx.stroke();
    [[-6,-2],[0,1],[6,-2]].forEach(([gx,gy]) => {
      for (let p=0;p<5;p++) {
        const a=(p/5)*Math.PI*2;
        ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(gx+Math.cos(a)*2.8,gy+Math.sin(a)*2.8,1.3,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(gx,gy,1.3,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle='#ee9988'; ctx.fillRect(-13,5,26,4);
  }
  ctx.restore();
}

function drawExitDoor() {
  const dx=W/2-28, dy=H-92, dw=56, dh=82;
  ctx.fillStyle='#5a3a18';
  ctx.beginPath(); ctx.arc(dx+dw/2,dy-2,dw/2+5,Math.PI,0); ctx.rect(dx-5,dy-2,dw+10,dh+4); ctx.fill();
  ctx.fillStyle='#7a5a2a';
  ctx.beginPath(); ctx.arc(dx+dw/2,dy,dw/2,Math.PI,0); ctx.rect(dx,dy,dw,dh); ctx.fill();
  ctx.strokeStyle='#5a3a18'; ctx.lineWidth=1.8;
  ctx.strokeRect(dx+4,dy+7,dw/2-7,dh/2-9);
  ctx.strokeRect(dx+dw/2+3,dy+7,dw/2-7,dh/2-9);
  ctx.strokeRect(dx+4,dy+dh/2+2,dw/2-7,dh/2-11);
  ctx.strokeRect(dx+dw/2+3,dy+dh/2+2,dw/2-7,dh/2-11);
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(dx+dw-9,dy+dh/2,4.5,0,Math.PI*2); ctx.fill();
  // Subtle green glow above door = "exit here"
  const eg = ctx.createRadialGradient(dx+dw/2,dy-8,0,dx+dw/2,dy-8,22);
  eg.addColorStop(0,'rgba(80,220,80,0.14)'); eg.addColorStop(1,'rgba(80,220,80,0)');
  ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(dx+dw/2,dy-8,22,0,Math.PI*2); ctx.fill();
}

// ══════════════════════════════════════════════════════════════
//  PRINCESS DRAWING
// ══════════════════════════════════════════════════════════════
function drawPrincess(p) {
  const x = p.x - p.w/2;
  const y = p.y - p.h;
  const bob = p.moving ? Math.sin(p.frame*0.8)*2 : 0;
  ctx.save();
  ctx.translate(x+p.w/2, y+p.h/2+bob);
  if (p.facing===-1) ctx.scale(-1,1);
  ctx.translate(-p.w/2, -p.h/2);

  drawPrincessCrown(p.crownStyle);

  ctx.fillStyle='#c8860a';
  ctx.beginPath(); ctx.ellipse(18,10,11,13,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#b87708';
  ctx.beginPath(); ctx.moveTo(7,8); ctx.quadraticCurveTo(2,22,4,38); ctx.quadraticCurveTo(6,44,8,42);
  ctx.quadraticCurveTo(8,28,10,16); ctx.closePath(); ctx.fill();

  ctx.fillStyle='#FDDBB4'; ctx.beginPath(); ctx.ellipse(18,10,8,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#4a2800';
  ctx.beginPath(); ctx.arc(15,9,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(21,9,1.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c0704a'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(18,12,3,0.1,Math.PI-0.1); ctx.stroke();
  ctx.fillStyle='rgba(255,150,120,0.4)';
  ctx.beginPath(); ctx.arc(13,12,3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(23,12,3,0,Math.PI*2); ctx.fill();

  ctx.fillStyle='#e040a0';
  ctx.beginPath(); ctx.moveTo(10,19); ctx.lineTo(26,19); ctx.lineTo(30,54); ctx.lineTo(6,54); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#f070c0';
  ctx.beginPath(); ctx.moveTo(14,19); ctx.lineTo(22,19); ctx.lineTo(20,40); ctx.lineTo(16,40); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#cc2080'; ctx.fillRect(11,19,14,12);

  ctx.fillStyle='#FDDBB4';
  const armSwing = p.moving ? Math.sin(p.frame*0.8)*6 : 0;
  ctx.save(); ctx.translate(9,22); ctx.rotate(armSwing*Math.PI/180); ctx.fillRect(-3,0,6,14); ctx.restore();
  ctx.save(); ctx.translate(27,22); ctx.rotate(-armSwing*Math.PI/180); ctx.fillRect(-3,0,6,14); ctx.restore();

  const legSwing = p.moving ? Math.sin(p.frame*0.8)*4 : 0;
  ctx.fillStyle='#FDDBB4';
  ctx.save(); ctx.translate(14,52); ctx.rotate(legSwing*Math.PI/180); ctx.fillRect(-4,0,8,10); ctx.restore();
  ctx.save(); ctx.translate(22,52); ctx.rotate(-legSwing*Math.PI/180); ctx.fillRect(-4,0,8,10); ctx.restore();

  ctx.fillStyle='#cc2080';
  ctx.beginPath(); ctx.ellipse(14,62,6,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(22,62,6,3,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawPrincessCrown(style) {
  if (style==='default') {
    ctx.fillStyle='#FFD700';
    ctx.beginPath();
    ctx.moveTo(10,-4); ctx.lineTo(10,4); ctx.lineTo(13,1); ctx.lineTo(16,5);
    ctx.lineTo(19,1); ctx.lineTo(22,4); ctx.lineTo(26,4); ctx.lineTo(26,-4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff44aa'; ctx.beginPath(); ctx.arc(13,1,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#44aaff'; ctx.beginPath(); ctx.arc(19,1,2,0,Math.PI*2); ctx.fill();
  } else if (style==='ruby') {
    ctx.fillStyle='#FFD700';
    ctx.beginPath();
    ctx.moveTo(10,4); ctx.lineTo(10,-1); ctx.lineTo(13,-10);
    ctx.lineTo(18,-4); ctx.lineTo(23,-10); ctx.lineTo(26,-1); ctx.lineTo(26,4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff1133';
    [13,18,23].forEach(gx => { ctx.beginPath(); ctx.arc(gx,-2,2.3,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle='#c8a030'; ctx.fillRect(10,2,16,3);
  } else if (style==='sapphire') {
    ctx.fillStyle='#C0C0C0';
    ctx.beginPath(); ctx.moveTo(10,4);
    for (let i=0;i<5;i++) {
      const ix=10+i*3.2;
      ctx.lineTo(ix,-1); ctx.lineTo(ix+1.2,-8+(i===2?-3:0)); ctx.lineTo(ix+2,-1);
    }
    ctx.lineTo(26,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#2255ff';
    [12,18,24].forEach(gx => { ctx.beginPath(); ctx.arc(gx,gx===18?-3:-1,1.9,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle='#aaaacc'; ctx.fillRect(10,2,16,3);
  } else if (style==='rose') {
    ctx.fillStyle='#FFB6C1';
    ctx.beginPath();
    ctx.moveTo(10,4); ctx.lineTo(10,-1); ctx.lineTo(14,-8);
    ctx.lineTo(18,-2); ctx.lineTo(22,-8); ctx.lineTo(26,-1); ctx.lineTo(26,4);
    ctx.closePath(); ctx.fill();
    [[14,-1],[18,0],[22,-1]].forEach(([gx,gy]) => {
      for (let p=0;p<5;p++) {
        const a=(p/5)*Math.PI*2;
        ctx.fillStyle='#ff66aa'; ctx.beginPath(); ctx.arc(gx+Math.cos(a)*2.3,gy+Math.sin(a)*2.3,1.1,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(gx,gy,1.1,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle='#ee9988'; ctx.fillRect(10,2,16,3);
  }
}

// ── Unicorn ───────────────────────────────────────────────────
function drawUnicorn(u) {
  const x=u.x-u.w/2, y=u.y-u.h;
  const bob=Math.sin(u.frame*0.5)*1.5;
  ctx.save(); ctx.translate(x+u.w/2,y+u.h/2+bob);
  if (u.dir===-1) ctx.scale(-1,1);
  ctx.translate(-u.w/2,-u.h/2);
  ctx.fillStyle='#f5e6ff'; ctx.beginPath(); ctx.ellipse(26,22,22,14,-0.1,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f0deff'; ctx.beginPath(); ctx.moveTo(36,12); ctx.lineTo(44,4); ctx.lineTo(48,10); ctx.lineTo(40,18); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#f5e6ff'; ctx.beginPath(); ctx.ellipse(47,6,9,7,0.3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.moveTo(54,-4); ctx.lineTo(50,0); ctx.lineTo(58,2); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#6a3aa2'; ctx.beginPath(); ctx.arc(51,5,2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(52,4.5,.7,0,Math.PI*2); ctx.fill();
  ['#ff99dd','#cc88ff','#88ccff','#ffeeaa'].forEach((c,i) => {
    ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(42-i*2,4+i*3,4,6,-0.5+i*0.2,0,Math.PI*2); ctx.fill();
  });
  ['#ff88cc','#dd88ff','#88ddff'].forEach((c,i) => {
    ctx.fillStyle=c; ctx.beginPath();
    ctx.moveTo(5,16+i*2); ctx.quadraticCurveTo(-6,22+i*3,-2,34+i*2);
    ctx.quadraticCurveTo(2,40,5,36+i); ctx.quadraticCurveTo(0,28,6,20+i*2);
    ctx.closePath(); ctx.fill();
  });
  const ls=Math.sin(u.frame*0.7)*5;
  [{bx:14,by:30},{bx:22,by:30},{bx:30,by:30},{bx:38,by:30}].forEach((leg,i) => {
    ctx.fillStyle='#ede0ff';
    ctx.save(); ctx.translate(leg.bx+3,leg.by); ctx.rotate(((i%2===0?ls:-ls)*Math.PI)/180);
    ctx.fillRect(-3,0,6,12); ctx.restore();
    ctx.fillStyle='#d4b0f0';
    const hx=leg.bx+Math.sin(((i%2===0?ls:-ls)*Math.PI)/180)*8;
    ctx.beginPath(); ctx.ellipse(hx+3,leg.by+13,5,3,0,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

// ── Dialog & prompt ───────────────────────────────────────────
function drawDialog() {
  if (!dialog) return;
  ctx.fillStyle='rgba(255,240,255,0.93)'; ctx.strokeStyle='#cc44aa'; ctx.lineWidth=2;
  roundRect(W/2-170,H/2-34,340,68,12); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#6a1a4a'; ctx.font='bold 14px Georgia'; ctx.textAlign='center';
  ctx.fillText(dialog,W/2,H/2+7);
  ctx.textAlign='left';
}

function drawPrompt(msg) {
  if (!msg) return;
  ctx.fillStyle='rgba(255,248,215,0.92)'; ctx.strokeStyle='#c8a030'; ctx.lineWidth=1.8;
  roundRect(W/2-175,H-48,350,36,8); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#5a3800'; ctx.font='13px Georgia'; ctx.textAlign='center';
  ctx.fillText(msg,W/2,H-24);
  ctx.textAlign='left';
}

// ══════════════════════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════════════════════
function moveInput() {
  return {
    dx: (keys['ArrowRight']||keys['d']||keys['D'] ? 1:0)-(keys['ArrowLeft']||keys['a']||keys['A'] ? 1:0),
    dy: (keys['ArrowDown'] ||keys['s']||keys['S'] ? 1:0)-(keys['ArrowUp']  ||keys['w']||keys['W'] ? 1:0),
  };
}

function updatePrincessGarden() {
  const {dx,dy} = moveInput();
  princess.moving = dx!==0||dy!==0;
  if (dx!==0) princess.facing=dx;
  princess.x = Math.max(princess.w/2, Math.min(W-princess.w/2, princess.x+dx*princess.speed));
  princess.y = Math.max(H*0.55+princess.h, Math.min(H-10, princess.y+dy*princess.speed));
  if (princess.moving) { princess.frameTimer++; if (princess.frameTimer>6){princess.frame++;princess.frameTimer=0;} }
  else princess.frame=0;

  const nearGate = princess.y <= H*0.575+princess.h && Math.abs(princess.x-W/2)<55;
  promptMsg = nearGate ? 'Press ENTER to enter the castle ✨' : null;
  if (nearGate && !dialog && consumeAction() && fadeDir===0) {
    triggerFade('castle'); promptMsg=null;
  }

  if (!dialog) {
    gardenSigns.forEach(s => {
      if (Math.abs(princess.x-(s.x+s.width/2))<40 && Math.abs(princess.y-s.y-60)<60)
        showDialog(s.label.replace('\n',' '));
    });
  }
}

function updatePrincessCastle() {
  const {dx,dy} = moveInput();
  princess.moving = dx!==0||dy!==0;
  if (dx!==0) princess.facing=dx;
  princess.x = Math.max(WALL_L+princess.w/2, Math.min(WALL_R-princess.w/2, princess.x+dx*princess.speed));
  princess.y = Math.max(195, Math.min(H-18, princess.y+dy*princess.speed));
  if (princess.moving) { princess.frameTimer++; if (princess.frameTimer>6){princess.frame++;princess.frameTimer=0;} }
  else princess.frame=0;

  promptMsg=null;
  if (!dialog) {
    // Crown interactions
    let crownNear=false;
    castleCrowns.forEach(c => {
      if (c.taken) return;
      if (Math.hypot(princess.x-c.x, princess.y-c.y)<82) {
        crownNear=true;
        promptMsg=`Press ENTER to wear the ${c.name} 👑`;
        if (consumeAction()) {
          c.taken=true; princess.crownStyle=c.style;
          showDialog(`✨ You are wearing the ${c.name}! ✨`, 240);
        }
      }
    });
    // Exit door
    if (!crownNear && Math.abs(princess.x-W/2)<68 && princess.y>H-140) {
      promptMsg='Press ENTER to go back outside 🌸';
      if (consumeAction() && fadeDir===0) { triggerFade('garden'); promptMsg=null; }
    }
  }
}

function updateUnicorn() {
  unicorn.wanderTimer++;
  if (unicorn.wanderTimer>unicorn.wanderDuration) {
    unicorn.dir=Math.random()<.5?1:-1;
    unicorn.wanderDuration=80+Math.random()*160;
    unicorn.wanderTimer=0;
  }
  unicorn.x+=unicorn.dir*unicorn.speed;
  unicorn.x=Math.max(80,Math.min(W-120,unicorn.x));
  if (unicorn.x<=80||unicorn.x>=W-120) unicorn.dir*=-1;
  unicorn.frameTimer++; if(unicorn.frameTimer>8){unicorn.frame++;unicorn.frameTimer=0;}
  if (Math.abs(princess.x-unicorn.x)<60 && !dialog) showDialog('✨ Hello, Princess Anya! ✨');
}

// ══════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════
function gameLoop() {
  ctx.clearRect(0,0,W,H);
  tick++;

  if (scene==='garden') {
    drawGardenBackground();
    drawCastle();
    drawPath();
    drawGardenBushes();
    drawGardenFlowers();
    drawGardenSigns();
    if (unicorn.x>princess.x) { drawUnicorn(unicorn); drawPrincess(princess); }
    else                       { drawPrincess(princess); drawUnicorn(unicorn); }
    updatePrincessGarden();
    updateUnicorn();
  } else {
    drawCastleInterior();
    drawPrincess(princess);
    updatePrincessCastle();
  }

  if (!dialog) drawPrompt(promptMsg);
  drawDialog();
  if (dialog) { dialogTimer--; if(dialogTimer<=0) dialog=null; }

  updateFade();
  drawFade();

  // Clear just-pressed flags at end of frame
  Object.keys(justPressed).forEach(k => { justPressed[k]=false; });

  requestAnimationFrame(gameLoop);
}

gameLoop();
