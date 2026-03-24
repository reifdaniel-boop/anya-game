// ============================================================
//  Anya's Adventure — main game
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// ── Input ────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup',   e => keys[e.key] = false);

// ── Princess ─────────────────────────────────────────────────
const princess = {
  x: W / 2,
  y: H - 140,
  w: 36,
  h: 54,
  speed: 3,
  facing: 1,       // 1 = right, -1 = left
  frame: 0,
  frameTimer: 0,
  moving: false,
};

// ── Unicorn (companion, wanders) ─────────────────────────────
const unicorn = {
  x: 180,
  y: H - 130,
  w: 52,
  h: 42,
  frame: 0,
  frameTimer: 0,
  dir: 1,
  speed: 0.6,
  wanderTimer: 0,
  wanderDuration: 120,
};

// ── Flowers (decorative) ─────────────────────────────────────
const flowers = [];
for (let i = 0; i < 28; i++) {
  flowers.push({
    x: 30 + Math.random() * (W - 60),
    y: H - 80 + Math.random() * 30,
    color: ['#ff88cc', '#ffdd44', '#ff66aa', '#cc88ff', '#ff99bb'][Math.floor(Math.random() * 5)],
    size: 5 + Math.random() * 5,
    stem: 8 + Math.random() * 10,
  });
}

// Keep flowers off the path
const PATH_X = W / 2 - 70;
const PATH_W = 140;
const filteredFlowers = flowers.filter(f => f.x < PATH_X - 10 || f.x > PATH_X + PATH_W + 10);

// ── Bushes ───────────────────────────────────────────────────
const bushes = [
  { x: 40,  y: H - 105, w: 55, h: 35 },
  { x: 120, y: H - 100, w: 45, h: 30 },
  { x: 660, y: H - 100, w: 50, h: 32 },
  { x: 720, y: H - 105, w: 55, h: 35 },
];

// ── Dialog / sign messages ────────────────────────────────────
const signs = [
  { x: 90,  y: H - 175, label: '🌸 Rose\nGarden', width: 90 },
  { x: 650, y: H - 175, label: '🦋 Butterfly\nMeadow', width: 110 },
];

let dialog = null;
let dialogTimer = 0;

function showDialog(msg) {
  dialog = msg;
  dialogTimer = 200;
}

// ── Helpers ───────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Draw: sky & background gradient ──────────────────────────
function drawBackground() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#87CEEB');
  sky.addColorStop(1, '#d4f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.55);

  // Distant hills
  ctx.fillStyle = '#b8e8b0';
  ctx.beginPath();
  ctx.ellipse(180, H * 0.54, 180, 90, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(620, H * 0.52, 200, 100, 0, Math.PI, 0);
  ctx.fill();

  // Ground
  const ground = ctx.createLinearGradient(0, H * 0.5, 0, H);
  ground.addColorStop(0, '#5cb85c');
  ground.addColorStop(0.4, '#4cae4c');
  ground.addColorStop(1, '#3d8b3d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * 0.5, W, H * 0.5);
}

// ── Draw: castle ─────────────────────────────────────────────
function drawCastle() {
  const cx = W / 2;
  const baseY = H * 0.15;
  const bw = 180;
  const bh = 150;
  const bx = cx - bw / 2;

  // Main body
  ctx.fillStyle = '#e8ddd0';
  ctx.fillRect(bx, baseY, bw, bh);

  // Battlements (merlons)
  ctx.fillStyle = '#d4c9bc';
  const mw = 18, mh = 20, gap = 8;
  for (let mx = bx; mx < bx + bw - mw + 1; mx += mw + gap) {
    ctx.fillRect(mx, baseY - mh, mw, mh);
  }

  // Left tower
  ctx.fillStyle = '#ddd2c5';
  ctx.fillRect(bx - 28, baseY + 10, 50, bh - 10);
  drawTowerTop(bx - 3, baseY + 10, 50, '#b83c6e');

  // Right tower
  ctx.fillRect(bx + bw - 22, baseY + 10, 50, bh - 10);
  drawTowerTop(bx + bw - 22, baseY + 10, 50, '#b83c6e');

  // Center tower (taller)
  ctx.fillStyle = '#e8ddd0';
  ctx.fillRect(cx - 22, baseY - 50, 44, 60);
  drawTowerTop(cx - 22, baseY - 50, 44, '#9b1c4a');

  // Gate arch
  ctx.fillStyle = '#5a3825';
  ctx.beginPath();
  ctx.arc(cx, baseY + bh - 28, 24, Math.PI, 0);
  ctx.rect(cx - 24, baseY + bh - 28, 48, 28);
  ctx.fill();

  // Windows
  drawWindow(cx - 45, baseY + 40);
  drawWindow(cx + 28, baseY + 40);
  drawWindow(cx - 10, baseY + 30);

  // Flag
  drawFlag(cx + 11, baseY - 50 - 32, '#ff6699');
  drawFlag(bx - 3 + 18, baseY + 10 - 32, '#ff99cc');
  drawFlag(bx + bw - 22 + 18, baseY + 10 - 32, '#ff99cc');
}

function drawTowerTop(x, y, w, color) {
  // Cone roof
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - 30);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  // Merlons
  ctx.fillStyle = '#d4c9bc';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 4 + i * 14, y - 14, 10, 14);
  }
}

function drawWindow(x, y) {
  ctx.fillStyle = '#a0cce8';
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 8, Math.PI, 0);
  ctx.rect(x, y + 8, 16, 12);
  ctx.fill();
  ctx.strokeStyle = '#8a7060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 8, Math.PI, 0);
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x + 16, y + 8);
  ctx.stroke();
}

function drawFlag(x, y, color) {
  ctx.strokeStyle = '#7a5c3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 32);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 18, y + 7);
  ctx.lineTo(x, y + 14);
  ctx.closePath();
  ctx.fill();
}

// ── Draw: beige path ─────────────────────────────────────────
function drawPath() {
  // Path stretches from castle gate down to bottom of screen
  const gradient = ctx.createLinearGradient(0, H * 0.5, 0, H);
  gradient.addColorStop(0, '#d4b896');
  gradient.addColorStop(1, '#c8a878');

  // Perspective trapezoid: narrow at top, wide at bottom
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, H * 0.48);
  ctx.lineTo(W / 2 + 22, H * 0.48);
  ctx.lineTo(W / 2 + 70, H);
  ctx.lineTo(W / 2 - 70, H);
  ctx.closePath();
  ctx.fill();

  // Path edges (stones / border)
  ctx.strokeStyle = '#b0946a';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, H * 0.48);
  ctx.lineTo(W / 2 - 70, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 + 22, H * 0.48);
  ctx.lineTo(W / 2 + 70, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Draw: bushes ─────────────────────────────────────────────
function drawBushes() {
  bushes.forEach(b => {
    ctx.fillStyle = '#3a7d44';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.3, b.y + b.h * 0.6, b.w * 0.35, b.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.6, b.y + b.h * 0.55, b.w * 0.38, b.h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.5, b.y + b.h * 0.4, b.w * 0.3, b.h * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a9455';
    ctx.fill();
    // Berries / small flowers on bush
    ctx.fillStyle = '#ff88cc';
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.6, b.y + b.h * 0.15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.8, b.y + b.h * 0.3, 3, 0, Math.PI * 2); ctx.fill();
  });
}

// ── Draw: flowers ─────────────────────────────────────────────
function drawFlowers() {
  filteredFlowers.forEach(f => {
    // Stem
    ctx.strokeStyle = '#4a8c3f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x, f.y - f.stem);
    ctx.stroke();
    // Petals
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      const px = f.x + Math.cos(angle) * f.size;
      const py = f.y - f.stem + Math.sin(angle) * f.size;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(px, py, f.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = '#ffe566';
    ctx.beginPath();
    ctx.arc(f.x, f.y - f.stem, f.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Draw: signs ───────────────────────────────────────────────
function drawSigns() {
  signs.forEach(s => {
    // Post
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(s.x + s.width / 2 - 4, s.y + 30, 8, 30);
    // Board
    ctx.fillStyle = '#f5deb3';
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 2;
    roundRect(s.x, s.y, s.width, 30, 5);
    ctx.fill();
    ctx.stroke();
    // Text
    ctx.fillStyle = '#5a3825';
    ctx.font = '10px Georgia';
    ctx.textAlign = 'center';
    const lines = s.label.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, s.x + s.width / 2, s.y + 11 + i * 12));
    ctx.textAlign = 'left';
  });
}

// ── Draw: princess (pixel art style) ─────────────────────────
function drawPrincess(p) {
  const x = p.x - p.w / 2;
  const y = p.y - p.h;
  const bob = p.moving ? Math.sin(p.frame * 0.8) * 2 : 0;

  ctx.save();
  ctx.translate(x + p.w / 2, y + p.h / 2 + bob);
  if (p.facing === -1) ctx.scale(-1, 1);
  ctx.translate(-(p.w / 2), -(p.h / 2));

  // Crown
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.lineTo(10, 4);
  ctx.lineTo(13, 1);
  ctx.lineTo(16, 5);
  ctx.lineTo(19, 1);
  ctx.lineTo(22, 4);
  ctx.lineTo(26, 4);
  ctx.lineTo(26, -4);
  ctx.closePath();
  ctx.fill();
  // Crown gems
  ctx.fillStyle = '#ff44aa';
  ctx.beginPath(); ctx.arc(13, 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#44aaff';
  ctx.beginPath(); ctx.arc(19, 1, 2, 0, Math.PI * 2); ctx.fill();

  // Hair (long, flowing)
  ctx.fillStyle = '#c8860a';
  ctx.beginPath();
  ctx.ellipse(18, 10, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair flowing back
  ctx.fillStyle = '#b87708';
  ctx.beginPath();
  ctx.moveTo(7, 8);
  ctx.quadraticCurveTo(2, 22, 4, 38);
  ctx.quadraticCurveTo(6, 44, 8, 42);
  ctx.quadraticCurveTo(8, 28, 10, 16);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = '#FDDBB4';
  ctx.beginPath();
  ctx.ellipse(18, 10, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#4a2800';
  ctx.beginPath(); ctx.arc(15, 9, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(21, 9, 1.5, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.strokeStyle = '#c0704a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(18, 12, 3, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Cheeks
  ctx.fillStyle = 'rgba(255,150,120,0.4)';
  ctx.beginPath(); ctx.arc(13, 12, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(23, 12, 3, 0, Math.PI * 2); ctx.fill();

  // Dress body
  ctx.fillStyle = '#e040a0';
  ctx.beginPath();
  ctx.moveTo(10, 19);
  ctx.lineTo(26, 19);
  ctx.lineTo(30, 54);
  ctx.lineTo(6, 54);
  ctx.closePath();
  ctx.fill();
  // Dress highlights
  ctx.fillStyle = '#f070c0';
  ctx.beginPath();
  ctx.moveTo(14, 19);
  ctx.lineTo(22, 19);
  ctx.lineTo(20, 40);
  ctx.lineTo(16, 40);
  ctx.closePath();
  ctx.fill();

  // Bodice
  ctx.fillStyle = '#cc2080';
  ctx.fillRect(11, 19, 14, 12);

  // Arms
  ctx.fillStyle = '#FDDBB4';
  const armSwing = p.moving ? Math.sin(p.frame * 0.8) * 6 : 0;
  // Left arm
  ctx.save();
  ctx.translate(9, 22);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.fillRect(-3, 0, 6, 14);
  ctx.restore();
  // Right arm
  ctx.save();
  ctx.translate(27, 22);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.fillRect(-3, 0, 6, 14);
  ctx.restore();

  // Legs (under dress, slight peek)
  const legSwing = p.moving ? Math.sin(p.frame * 0.8) * 4 : 0;
  ctx.fillStyle = '#FDDBB4';
  ctx.save();
  ctx.translate(14, 52);
  ctx.rotate((legSwing * Math.PI) / 180);
  ctx.fillRect(-4, 0, 8, 10);
  ctx.restore();
  ctx.save();
  ctx.translate(22, 52);
  ctx.rotate((-legSwing * Math.PI) / 180);
  ctx.fillRect(-4, 0, 8, 10);
  ctx.restore();

  // Shoes
  ctx.fillStyle = '#cc2080';
  ctx.beginPath(); ctx.ellipse(14, 62, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(22, 62, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── Draw: unicorn ─────────────────────────────────────────────
function drawUnicorn(u) {
  const x = u.x - u.w / 2;
  const y = u.y - u.h;
  const bob = Math.sin(u.frame * 0.5) * 1.5;

  ctx.save();
  ctx.translate(x + u.w / 2, y + u.h / 2 + bob);
  if (u.dir === -1) ctx.scale(-1, 1);
  ctx.translate(-(u.w / 2), -(u.h / 2));

  // Body
  ctx.fillStyle = '#f5e6ff';
  ctx.beginPath();
  ctx.ellipse(26, 22, 22, 14, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = '#f0deff';
  ctx.beginPath();
  ctx.moveTo(36, 12);
  ctx.lineTo(44, 4);
  ctx.lineTo(48, 10);
  ctx.lineTo(40, 18);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = '#f5e6ff';
  ctx.beginPath();
  ctx.ellipse(47, 6, 9, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Horn
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(54, -4);
  ctx.lineTo(50, 0);
  ctx.lineTo(58, 2);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#6a3aa2';
  ctx.beginPath();
  ctx.arc(51, 5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(52, 4.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Mane
  const maneColors = ['#ff99dd', '#cc88ff', '#88ccff', '#ffeeaa'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = maneColors[i];
    ctx.beginPath();
    ctx.ellipse(42 - i * 2, 4 + i * 3, 4, 6, -0.5 + i * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail
  const tailColors = ['#ff88cc', '#dd88ff', '#88ddff'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = tailColors[i];
    ctx.beginPath();
    ctx.moveTo(5, 16 + i * 2);
    ctx.quadraticCurveTo(-6, 22 + i * 3, -2, 34 + i * 2);
    ctx.quadraticCurveTo(2, 40, 5, 36 + i);
    ctx.quadraticCurveTo(0, 28, 6, 20 + i * 2);
    ctx.closePath();
    ctx.fill();
  }

  // Legs
  const legSwing = Math.sin(u.frame * 0.7) * 5;
  ctx.fillStyle = '#ede0ff';
  const legPositions = [
    { bx: 14, by: 30 }, { bx: 22, by: 30 },
    { bx: 30, by: 30 }, { bx: 38, by: 30 },
  ];
  legPositions.forEach((leg, i) => {
    ctx.save();
    ctx.translate(leg.bx + 3, leg.by);
    ctx.rotate(((i % 2 === 0 ? legSwing : -legSwing) * Math.PI) / 180);
    ctx.fillRect(-3, 0, 6, 12);
    ctx.restore();
    // Hooves
    ctx.fillStyle = '#d4b0f0';
    ctx.beginPath();
    const hx = leg.bx + Math.sin(((i % 2 === 0 ? legSwing : -legSwing) * Math.PI) / 180) * 8;
    ctx.ellipse(hx + 3, leg.by + 13, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ede0ff';
  });

  ctx.restore();
}

// ── Draw: dialog box ──────────────────────────────────────────
function drawDialog() {
  if (!dialog) return;
  ctx.fillStyle = 'rgba(255,240,255,0.92)';
  ctx.strokeStyle = '#cc44aa';
  ctx.lineWidth = 2;
  roundRect(W / 2 - 140, H / 2 - 30, 280, 60, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6a1a4a';
  ctx.font = 'bold 14px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(dialog, W / 2, H / 2 + 6);
  ctx.textAlign = 'left';
}

// ── Update: princess movement ─────────────────────────────────
function updatePrincess() {
  const dx = (keys['ArrowRight'] || keys['d'] || keys['D'] ? 1 : 0)
           - (keys['ArrowLeft']  || keys['a'] || keys['A'] ? 1 : 0);
  const dy = (keys['ArrowDown']  || keys['s'] || keys['S'] ? 1 : 0)
           - (keys['ArrowUp']    || keys['w'] || keys['W'] ? 1 : 0);

  princess.moving = dx !== 0 || dy !== 0;

  if (dx !== 0) princess.facing = dx;

  princess.x = Math.max(princess.w / 2, Math.min(W - princess.w / 2, princess.x + dx * princess.speed));
  princess.y = Math.max(H * 0.55 + princess.h, Math.min(H - 10, princess.y + dy * princess.speed));

  if (princess.moving) {
    princess.frameTimer++;
    if (princess.frameTimer > 6) { princess.frame++; princess.frameTimer = 0; }
  } else {
    princess.frame = 0;
  }

  // Sign interaction
  signs.forEach(s => {
    const dist = Math.abs(princess.x - (s.x + s.width / 2));
    if (dist < 40 && Math.abs(princess.y - s.y - 60) < 60) {
      if (!dialog) showDialog(s.label.replace('\n', ' '));
    }
  });
}

// ── Update: unicorn wander ────────────────────────────────────
function updateUnicorn() {
  unicorn.wanderTimer++;
  if (unicorn.wanderTimer > unicorn.wanderDuration) {
    unicorn.dir = Math.random() < 0.5 ? 1 : -1;
    unicorn.wanderDuration = 80 + Math.random() * 160;
    unicorn.wanderTimer = 0;
  }

  unicorn.x += unicorn.dir * unicorn.speed;
  unicorn.x = Math.max(80, Math.min(W - 120, unicorn.x));
  if (unicorn.x <= 80 || unicorn.x >= W - 120) unicorn.dir *= -1;

  unicorn.frameTimer++;
  if (unicorn.frameTimer > 8) { unicorn.frame++; unicorn.frameTimer = 0; }

  // Greeting when princess is close
  const dist = Math.abs(princess.x - unicorn.x);
  if (dist < 60 && !dialog) {
    showDialog('✨ Hello, Princess Anya! ✨');
  }
}

// ── Update: dialog timer ──────────────────────────────────────
function updateDialog() {
  if (dialog) {
    dialogTimer--;
    if (dialogTimer <= 0) dialog = null;
  }
}

// ── Main loop ─────────────────────────────────────────────────
function gameLoop() {
  ctx.clearRect(0, 0, W, H);

  drawBackground();
  drawCastle();
  drawPath();
  drawBushes();
  drawFlowers();
  drawSigns();

  // Draw unicorn behind princess if it's to the right
  if (unicorn.x > princess.x) {
    drawUnicorn(unicorn);
    drawPrincess(princess);
  } else {
    drawPrincess(princess);
    drawUnicorn(unicorn);
  }

  drawDialog();

  updatePrincess();
  updateUnicorn();
  updateDialog();

  requestAnimationFrame(gameLoop);
}

gameLoop();
