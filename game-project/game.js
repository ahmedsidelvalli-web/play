/* game.js - تحسين مظهر ورسوم المرحلة الأولى
   يركّز على: حركة اللاعب، اصطدام، حياة، مؤثرات بصرية (ظل، جسيمات)، واجهة احترافية.
   ضع index.html و style.css في نفس المجلد ثم افتح index.html في المتصفح.
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const DPR = window.devicePixelRatio || 1;
canvas.width = canvas.width * DPR;
canvas.height = canvas.height * DPR;
canvas.style.width = '960px';
canvas.style.height = '640px';
ctx.scale(DPR, DPR);

const uiTimer = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const overlay = document.getElementById('overlay');
const boxTitle = document.getElementById('boxTitle');
const boxMsg = document.getElementById('boxMsg');
const boxBtns = document.getElementById('boxBtns');

function setOverlay(title, msg, buttons){
  boxTitle.textContent = title;
  boxMsg.textContent = msg;
  boxBtns.innerHTML = '';
  buttons.forEach(b=>{
    const el = document.createElement('button');
    el.className = b.primary? 'btn':'btn ghost';
    el.textContent = b.text;
    el.onclick = b.onClick;
    boxBtns.appendChild(el);
  });
  overlay.classList.remove('hidden');
}
function hideOverlay(){ overlay.classList.add('hidden'); }

// ---- لعبة: حالات ومتحولات
const GAME_W = 960, GAME_H = 640;
const player = { x: GAME_W/2 - 28, y: GAME_H - 120, w: 56, h: 90, speed: 6, vx:0 };
let falling = [];
let lastSpawn = performance.now();
let spawnInterval = 1600;
let keys = {};
const MAX_HEALTH = 3;
let health = MAX_HEALTH;
let gameOver = false;
let startTime = performance.now();
let survivedSec = 0;
let difficulty = 1;

// مؤثرات جسيمات عند الاصطدام
let particles = [];

// انشئ قلوب الواجهة
function renderHearts(){
  heartsEl.innerHTML = '';
  for(let i=0;i<MAX_HEALTH;i++){
    const d = document.createElement('div');
    d.className = 'heart' + (i<health? ' full':'');
    heartsEl.appendChild(d);
  }
}

// ادخال لوحة المفاتيح
window.addEventListener('keydown', e => { keys[e.key] = true; if(gameOver && (e.key==='r' || e.key==='R')) restart(); });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// دالة توليد اجسام ساقطة مع اختلافات بصرية
function spawn(){
  const troll = Math.random();
  let type = 'stone';
  if(troll>0.75) type='heavy';
  else if(troll>0.4) type='weapon';
  const size = type==='heavy'? 56 : (type==='weapon'?44:36);
  falling.push({
    x: Math.random()*(GAME_W - size),
    y: -size - 10,
    w: size, h: size,
    type, rot: Math.random()*Math.PI*2,
    rotSpeed: (Math.random()-0.5)*0.06,
    speed: 2 + Math.random()*2 + difficulty*0.6
  });
}

// نظام جسيمات بسيط
function emit(x,y,count,color){
  for(let i=0;i<count;i++){
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*3,
      vy: (Math.random()-1.2)*3,
      life: 0.6 + Math.random()*0.6,
      age:0,
      color
    });
  }
}

// فحص اصطدامات
function checkCollisions(){
  for(let i=falling.length-1;i>=0;i--){
    const o=falling[i];
    if(player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y){
      // اصطدام
      falling.splice(i,1);
      health--;
      emit(player.x + player.w/2, player.y + player.h/2, 14, '#e74c3c');
      if(health<=0){ health=0; triggerGameOver(); return; }
      renderHearts();
    }
  }
}

// تهيئة النهاية
function triggerGameOver(){
  gameOver = true;
  setOverlay('لقد خسرت', 'اضغط إعادة المحاولة أو R للبدء من جديد', [
    {text:'إعادة المحاولة', primary:true, onClick:()=>{ hideOverlay(); restart(); }},
    {text:'حفظ ومتابعة لاحقاً', primary:false, onClick:()=>{ hideOverlay(); }}
  ]);
}

// إعادة تشغيل
function restart(){
  falling = [];
  particles = [];
  health = MAX_HEALTH;
  renderHearts();
  lastSpawn = performance.now();
  spawnInterval = 1600;
  gameOver = false;
  startTime = performance.now();
  survivedSec = 0;
  difficulty = 1;
}

// تحديث - منطق
function update(dt){
  if(gameOver) return;
  // حركة سلسة باستخدام سرعة مستهدفة
  const left = keys['ArrowLeft']||keys['a']||keys['A'];
  const right = keys['ArrowRight']||keys['d']||keys['D'];
  let targetV = 0;
  if(left) targetV = -player.speed;
  if(right) targetV = player.speed;
  player.vx += (targetV - player.vx) * 0.2;
  player.x += player.vx;
  // حدود الشاشة
  player.x = Math.max(10, Math.min(GAME_W - player.w - 10, player.x));

  // توليد اجسام بشكل متصاعد حسب الوقت والصعوبة
  if(performance.now() - lastSpawn > spawnInterval){
    spawn();
    lastSpawn = performance.now();
    // تقلل الفاصل تدريجياً
    spawnInterval = Math.max(400, spawnInterval - 12 - difficulty*0.5);
  }

  // تحديث الأجسام
  for(let o of falling){
    o.y += o.speed;
    o.rot += o.rotSpeed;
  }
  // إزالة الأجسام التي تجاوزت الأسفل
  falling = falling.filter(o => o.y < GAME_H + 80);

  // جسيمات
  for(let p of particles){
    p.vy += 9.8 * 0.02;
    p.x += p.vx;
    p.y += p.vy;
    p.age += dt;
  }
  particles = particles.filter(p => p.age < p.life);

  // فحص اصطدام
  checkCollisions();

  // تحديث الوقت والصعوبة
  survivedSec = Math.floor((performance.now() - startTime)/1000);
  uiTimer.textContent = 'النجاة: ' + String(survivedSec).padStart(2,'0') + 's';
  difficulty = 1 + survivedSec*0.06;
}

// رسم player مع ظل وتأثير توهج
function drawPlayer(){
  // ظل بيضاوي
  const sx = player.x + player.w/2, sy = player.y + player.h + 8;
  const grd = ctx.createRadialGradient(sx, sy, 8, sx, sy, player.w*0.9);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(sx, sy, player.w*0.7, 12, 0, 0, Math.PI*2);
  ctx.fill();

  // جسم اللاعب
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  ctx.fillStyle = '#2f9cff';
  roundRect(ctx, -player.w/2, -player.h/2, player.w, player.h, 10, true, false);
  // توهج خفيف
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(64,160,255,0.06)';
  roundRect(ctx, -player.w/2, -player.h/2, player.w, player.h, 10, true, false);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

// رسم falling objects مع دوران وظل
function drawFalling(){
  for(let o of falling){
    // ظل
    const cx = o.x + o.w/2, cy = o.y + o.h + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, o.w*0.5, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // الجسم الدوار
    ctx.save();
    ctx.translate(o.x + o.w/2, o.y + o.h/2);
    ctx.rotate(o.rot);
    if(o.type==='stone'){
      ctx.fillStyle = '#7d7d7d';
      roundRect(ctx, -o.w/2, -o.h/2, o.w, o.h, 8, true, false);
    } else if(o.type==='weapon'){
      // شكل رفيع مع شظايا
      ctx.fillStyle = '#cfcfcf';
      roundRect(ctx, -o.w/2, -o.h/2, o.w, o.h, 6, true, false);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(-o.w/4, -o.h/4, o.w/2, o.h/8);
    } else {
      ctx.fillStyle = '#6b0f0f';
      roundRect(ctx, -o.w/2, -o.h/2, o.w, o.h, 6, true, false);
    }
    ctx.restore();
  }
}

// رسم جسيمات
function drawParticles(){
  for(let p of particles){
    ctx.globalAlpha = 1 - (p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// رسم كامل المشهد
function draw(){
  // خلفية كدعم للغرفة
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(0,0,GAME_W,GAME_H);

  // اضاءة مركزية خافتة
  const g = ctx.createRadialGradient(GAME_W/2, GAME_H/3, 10, GAME_W/2, GAME_H/3, 500);
  g.addColorStop(0, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,GAME_W,GAME_H);

  // رسم الأرضية
  ctx.fillStyle = '#141414';
  roundRect(ctx, 0, GAME_H - 80, GAME_W, 80, 0, true, false);

  // العناصر
  drawFalling();
  drawPlayer();
  drawParticles();
}

// مستديرة helper
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if(typeof r==='undefined') r=6;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke){ ctx.strokeStyle = stroke===true?'#000':stroke; ctx.stroke(); }
}

// حلقة الرسم والتحديث
let last = performance.now();
function loop(now){
  const dt = (now - last)/1000;
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ابدأ
renderHearts();
restart();
requestAnimationFrame(loop);
