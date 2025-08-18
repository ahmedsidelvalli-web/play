// game.js — كاملة: لعبة أنمي (الشرير على الحافة)
// انسخ هذا الملف كاملاً واستبدل به أي ملف game.js سابق ثم افتح index.html

// ---------------------- إعداد الكانفاس ----------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function resize(){
  const w = Math.floor(window.innerWidth), h = Math.floor(window.innerHeight);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// ---------------------- أدوات مساعدة ----------------------
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function aabb(x1,y1,w1,h1, x2,y2,w2,h2){ return !(x2 > x1+w1 || x2+w2 < x1 || y2 > y1+h1 || y2+h2 < y1); }
function roundRect(c,x,y,w,h,r,fill,stroke){
  r = Math.min(r, w/2, h/2);
  c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r);
  c.closePath();
  if(fill) c.fill();
  if(stroke) { c.strokeStyle = stroke===true ? '#000' : stroke; c.stroke(); }
}

// ---------------------- مدخلات التحكم ----------------------
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// ---------------------- تحميل صور اختيارية ----------------------
const IMAGES = {};
const imageFiles = {
  player: 'sprites/player.png',
  stone:  'sprites/stone.png',
  weapon: 'sprites/weapon.png',
  heavy:  'sprites/heavy.png',
  villain:'sprites/villain1.png'
};
let imagesToLoad = Object.keys(imageFiles).length, imagesLoaded = 0, assetsReady = false;
function loadImages(cb){
  Object.entries(imageFiles).forEach(([k,src])=>{
    const img = new Image();
    img.src = src;
    img.onload = ()=>{ IMAGES[k] = img; done(); };
    img.onerror = ()=>{ /* لا تعطل التشغيل إذا لم توجد الصور */ done(); };
  });
  function done(){ imagesLoaded++; if(imagesLoaded>=imagesToLoad){ assetsReady=true; cb && cb(); } }
}

// ---------------------- عالم اللعبة ----------------------
const world = { gravity: 1400, floorH: 80 };
const uiHearts = document.getElementById('hearts');
const uiTimer  = document.getElementById('timer');
const banner   = document.getElementById('banner');

const player = {
  x: 140, y: 0, w: 68, h: 110,
  vx: 0, vy: 0, speed: 380, jump: 640,
  onGround: false, face: 1, dashCD: 0,
  hp: 5, hpMax: 5
};

const falling = []; // الحجارة/الأشياء
const anim = { t: 0 };

// الشرير (Boss) والمرحلة
let boss = null, beams = [], timeAlive = 0, levelIndex = 0;
const LEVELS = [
  { surviveSeconds: 45, moveSpeed: 120, rockCooldown: 1.6, powerUnlockAt: 18, powerCooldown: 6, powerChargeTime: 1.0, beamDuration: 0.85 }
];

// ---------------------- بدء / إعادة تهيئة ----------------------
function restart(){
  player.x = 140; player.y = 120; player.vx = 0; player.vy = 0;
  player.hp = player.hpMax;
  falling.length = 0; beams.length = 0; timeAlive = 0;
  initBoss();
  renderHearts();
}

function initBoss(){
  const cfg = LEVELS[levelIndex];
  // بوضع اعتماداً على أبعاد الـ canvas الحالية (بـ DPR مقاس)
  boss = { x: (canvas.width / DPR) * 0.5 - 60, y: 20, w: 120, h: 110, dir: 1,
           cfg, timers: { rock: 0, power: 0, charge: 0 }, phase: 'rocks' };
}

// ---------------------- واجهة القلوب والمؤقت ----------------------
function renderHearts(){
  let html = '';
  for(let i=0;i<player.hpMax;i++){
    const full = i < player.hp;
    html += `<span style="display:inline-block;width:22px;height:22px;margin-inline-end:4px;border-radius:6px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg, ${full?'rgba(255,0,170,.75)':'rgba(108,201,255,.25)'} , rgba(0,0,0,.25)); box-shadow:0 0 8px ${full?'rgba(255,0,170,.5)':'transparent'}"></span>`;
  }
  uiHearts.innerHTML = html;
}

// ---------------------- تحديث المنطق ----------------------
function update(dt){
  anim.t += dt;
  // --- حركة اللاعب
  const left  = keys['ArrowLeft'] || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];
  const up    = keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '];
  const dash  = keys['Shift'];

  const ax = (right ? 1 : 0) - (left ? 1 : 0);
  player.vx = ax * player.speed;
  if (up && player.onGround) { player.vy = -player.jump; player.onGround = false; }
  if (dash && player.dashCD <= 0) { player.vx *= 1.8; player.dashCD = 0.8; }
  player.dashCD = Math.max(0, player.dashCD - dt);

  // جاذبية واصطدام بالأرض
  player.vy += world.gravity * dt;
  player.x += player.vx * dt; player.y += player.vy * dt;
  const floorY = canvas.height / DPR - world.floorH - player.h;
  if (player.y >= floorY) { player.y = floorY; player.vy = 0; player.onGround = true; }
  player.x = clamp(player.x, 16, (canvas.width / DPR) - player.w - 16);
  player.face = (player.vx >= 0) ? 1 : -1;

  // --- تحديث الأشياء الساقطة
  for (let i = falling.length - 1; i >= 0; i--){
    const o = falling[i];
    o.vy += world.gravity * dt * 0.8; // أسرع قليلاً أو أقل حسب النوع
    o.x += o.vx * dt; o.y += o.vy * dt; o.rot += (o.vr || 0) * dt;
    if (o.y > canvas.height / DPR + 200) falling.splice(i,1);
    if (aabb(player.x, player.y, player.w, player.h, o.x, o.y, o.w, o.h)){
      hitPlayer(1); falling.splice(i,1);
    }
  }

  // --- تحديث البوس والأشعة
  updateBoss(dt); updateBeams(dt);

  // --- تحديث واجهة الوقت المتبقي
  const remain = Math.max(0, (LEVELS[levelIndex].surviveSeconds - timeAlive));
  uiTimer.textContent = `النجاة: ${Math.floor(remain)}s`;
}

// نقصان صحة اللاعب
function hitPlayer(dmg){
  if (player.hp <= 0) return;
  player.hp = Math.max(0, player.hp - dmg);
  renderHearts();
  // رد فعل بصري
  player.vy = -220; player.x += (Math.random() < 0.5 ? -1 : 1) * 24;
  if (player.hp <= 0){
    showBanner('خسرت!', 'أعد المحاولة', () => { restart(); hideBanner(); });
  }
}

// ---------------------- ذكاء الشرير (Boss) ----------------------
function updateBoss(dt){
  if (!boss) return;
  const cfg = boss.cfg;
  timeAlive += dt;

  // حركة على الحافة
  boss.x += boss.dir * cfg.moveSpeed * dt;
  const leftBound = 20, rightBound = canvas.width / DPR - boss.w - 20;
  if (boss.x <= leftBound) { boss.x = leftBound; boss.dir = 1; }
  if (boss.x >= rightBound){ boss.x = rightBound; boss.dir = -1; }

  // رمي الحجارة
  boss.timers.rock -= dt;
  if (boss.timers.rock <= 0){
    throwRockAtPlayer();
    boss.timers.rock = cfg.rockCooldown;
  }

  // فتح القوة (الشعاع)
  if (timeAlive >= cfg.powerUnlockAt){
    boss.timers.power -= dt;
    if (boss.phase === 'rocks' && boss.timers.power <= 0){
      boss.phase = 'charging';
      boss.timers.charge = cfg.powerChargeTime;
    }
    if (boss.phase === 'charging'){
      boss.timers.charge -= dt;
      if (boss.timers.charge <= 0){
        const px = player.x + player.w / 2;
        spawnBeam(px, cfg.beamDuration);
        boss.phase = 'beam';
      }
    } else if (boss.phase === 'beam'){
      if (beams.length === 0){
        boss.phase = 'rocks';
        boss.timers.power = cfg.powerCooldown;
      }
    }
  }

  // تحقق من الفوز بالمرحلة
  if (timeAlive >= cfg.surviveSeconds){
    showBanner('نجوت!', 'المرحلة التالية', () => {
      // زيادة صعوبة بسيطة ثم إعادة التشغيل
      timeAlive = 0;
      LEVELS[0].rockCooldown = Math.max(0.9, LEVELS[0].rockCooldown * 0.9);
      restart();
      hideBanner();
    });
  }
}

// ---------------------- إنشاء حجر موجه نحو اللاعب ----------------------
function throwRockAtPlayer(){
  if (!boss) return;
  const px = player.x + player.w / 2;
  const bx = boss.x + boss.w / 2;
  const toward = Math.sign(px - bx) || (Math.random() < 0.5 ? -1 : 1);
  const speedX = 120 * toward;
  const baseY = boss.y + boss.h;
  // نولد حجر مع سرعة ابتدائية صغيرة ثم تتسارع بالجاذبية
  falling.push({
    x: bx - 22,
    y: baseY,
    w: 44, h: 44,
    vx: speedX,
    vy: -60 + Math.random() * 40,
    vr: (Math.random() - 0.5) * 5,
    rot: 0,
    type: 'stone'
  });
}

// ---------------------- الأشعة (القوة) ----------------------
function spawnBeam(centerX, duration){
  beams.push({ x: centerX - 50, y: 0, w: 100, h: canvas.height / DPR, t: 0, duration });
}

function updateBeams(dt){
  for (let i = beams.length - 1; i >= 0; i--){
    const b = beams[i];
    b.t += dt;
    // إذا انتهت مدة الشعاع - ازلها
    if (b.t >= b.duration){ beams.splice(i,1); continue; }
    // تؤثر الأشعة ضررًا في المرحلة الأخيرة من تشغيلها
    if (b.t > b.duration * 0.35){
      if (aabb(player.x, player.y, player.w, player.h, b.x, b.y, b.w, b.h)){
        // تضرر اللاعب مرة واحدة كل إطار ممكن، لضبط الدمار يمكن إضافة تبريد
        hitPlayer(1);
      }
    }
  }
}

// ---------------------- الرسم ----------------------
function draw(){
  const W = canvas.width / DPR, H = canvas.height / DPR;

  // خلفية أنمي مظلمة
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#0b0b16'); grad.addColorStop(1,'#141433');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  // هالة لونية مركزية
  const rad = ctx.createRadialGradient(W*0.5, H*0.28, 20, W*0.5, H*0.28, Math.max(W,H)*0.7);
  rad.addColorStop(0, 'rgba(255,0,170,0.10)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad; ctx.fillRect(0,0,W,H);

  // الأرضية
  ctx.fillStyle = '#101022'; ctx.fillRect(0, H - world.floorH, W, world.floorH);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x=0;x<W;x+=28) ctx.fillRect(x, H - world.floorH, 16, 2);

  // منصة الحافة
  ctx.fillStyle = '#1e1e2c'; ctx.fillRect(0, 16, W, 12);

  // اجسام ساقطة
  drawFalling();

  // اللاعب
  drawPlayer();

  // الشرير و الاشعة
  drawBoss();
  drawBeams();
}

// رسم اللاعب (صورة إن وُجدت، وإلا سيلويت أنمي)
function drawPlayer(){
  const x = player.x, y = player.y, w = player.w, h = player.h;
  // ظل
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x + w/2, y + h + 10, w * 0.5, 10, 0, 0, Math.PI*2); ctx.fill();

  const bob = Math.sin(anim.t * 10 + (player.vx !== 0 ? Math.PI/2 : 0)) * 4;
  const tilt = clamp(player.vx / 400, -0.25, 0.25);

  ctx.save();
  ctx.translate(x + w/2, y + h/2 + bob);
  ctx.rotate(tilt);

  if (IMAGES.player){
    const img = IMAGES.player;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
    g.addColorStop(0, '#1d1d30'); g.addColorStop(1, '#2a2a45');
    ctx.fillStyle = g;
    roundRect(ctx, -w/2, -h/2, w, h, 16, true, false);
    ctx.fillStyle = 'rgba(255,0,170,0.35)'; ctx.fillRect(-6, -h*0.28, 12, 8);
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(108,201,255,0.12)';
  roundRect(ctx, -w/2, -h/2, w, h, 16, true, false);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// رسم الأشياء الساقطة (صور أو أشكال أنمي)
function drawFalling(){
  for (const o of falling){
    // ظل
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(o.x + o.w/2, o.y + o.h + 6, o.w * 0.5, 6, 0, 0, Math.PI*2); ctx.fill();

    ctx.save();
    ctx.translate(o.x + o.w/2, o.y + o.h/2);
    ctx.rotate(o.rot || 0);
    if (IMAGES[o.type]){
      const img = IMAGES[o.type];
      const s = Math.min(o.w / img.width, o.h / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
    } else {
      const col = o.type === 'stone' ? '#8a8aa0' : (o.type === 'weapon' ? '#cfd2e8' : '#71324a');
      ctx.fillStyle = col;
      roundRect(ctx, -o.w/2, -o.h/2, o.w, o.h, 10, true, false);
    }
    ctx.restore();
  }
}

// رسم الشرير
function drawBoss(){
  if (!boss) return;
  const x = boss.x, y = boss.y, w = boss.w, h = boss.h;
  // ظل
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x + w/2, y + h, w * 0.45, 7, 0, 0, Math.PI*2); ctx.fill();

  if (IMAGES.villain){
    ctx.drawImage(IMAGES.villain, x, y, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#151525'); g.addColorStop(1, '#232346');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 18, true, false);

    if (boss.phase === 'charging'){
      const pulse = 0.5 + 0.5 * Math.sin((boss.cfg.powerChargeTime - boss.timers.charge) * 10);
      ctx.fillStyle = `rgba(255,0,170,${0.25 + 0.35 * pulse})`;
      ctx.beginPath(); ctx.arc(x + w/2, y + h * 0.35, 10 + 6 * pulse, 0, Math.PI*2); ctx.fill();
    }
  }
}

// رسم الأشعة
function drawBeams(){
  for (const b of beams){
    const pct = b.t / b.duration;
    if (pct <= 0.35){
      ctx.fillStyle = 'rgba(255,70,70,0.25)'; ctx.fillRect(b.x, 0, b.w, canvas.height / DPR);
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(255,0,170,0.18)'; ctx.fillRect(b.x - 6, 0, b.w + 12, canvas.height / DPR);
      ctx.fillStyle = 'rgba(255,0,170,0.72)'; ctx.fillRect(b.x, 0, b.w, canvas.height / DPR);
      for (let i=0;i<6;i++){
        const rx = b.x + Math.random() * b.w, ry = Math.random() * canvas.height / DPR;
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(rx, ry, 2, 6);
      }
      ctx.restore();
    }
  }
}

// ---------------------- بانر الفوز/الخسارة ----------------------
function showBanner(title, btnText, onClick){
  banner.classList.remove('hidden');
  banner.innerHTML = `<div class="card"><h1>${title}</h1><p>نجوت ${Math.floor(timeAlive)} ثانية.</p><button id="btn">${btnText || 'حسناً'}</button></div>`;
  document.getElementById('btn').onclick = onClick || (()=>{ hideBanner(); });
}
function hideBanner(){ banner.classList.add('hidden'); banner.innerHTML = ''; }

// ---------------------- الحلقة الرئيسية ----------------------
let last = 0;
function loop(ts){
  const now = ts / 1000;
  const dt = Math.min(0.033, (now - last) || 0.016);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------------------- بدء التشغيل ----------------------
renderHearts();
loadImages(()=>{ restart(); requestAnimationFrame(loop); });

// النهاية
