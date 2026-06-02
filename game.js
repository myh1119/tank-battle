// ============================================================
// 坦克大战 — Tank Battle (Battle City style)
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- Constants ----
const TILE = 32;
const COLS = 26;
const ROWS = 18;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// ---- Game State ----
let game = null;
const keys = {};

// ---- Map Definitions ----
function createLevel(level) {
  // Base at bottom center
  const baseX = Math.floor(COLS / 2) - 1;
  const baseY = ROWS - 2;

  let map = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  // Fill brick walls
  for (let r = 2; r < ROWS - 4; r += 3) {
    for (let c = 1; c < COLS - 1; c += 3) {
      if (Math.random() < 0.55) {
        map[r][c] = 1;
        map[r][c + 1] = 1;
        if (r + 1 < ROWS - 4) {
          map[r + 1][c] = 1;
          map[r + 1][c + 1] = 1;
        }
      }
    }
  }

  // Some steel walls
  for (let i = 0; i < 4 + level * 2; i++) {
    const r = 2 + Math.floor(Math.random() * (ROWS - 8));
    const c = 2 + Math.floor(Math.random() * (COLS - 4));
    map[r][c] = 2;
  }

  // Clear area around base
  map[baseY][baseX] = 0;
  map[baseY][baseX + 1] = 0;
  map[baseY + 1][baseX] = 0;
  map[baseY + 1][baseX + 1] = 0;

  // Base protection walls
  // Top wall (steel — indestructible)
  const steelTop = [
    [baseY - 1, baseX - 1], [baseY - 1, baseX], [baseY - 1, baseX + 1], [baseY - 1, baseX + 2],
  ];
  for (const [r, c] of steelTop) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && map[r][c] === 0) {
      map[r][c] = 2;
    }
  }
  // Side walls (brick)
  const brickSides = [
    [baseY, baseX - 1], [baseY, baseX + 2],
    [baseY + 1, baseX - 1], [baseY + 1, baseX + 2],
  ];
  for (const [r, c] of brickSides) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && map[r][c] === 0) {
      map[r][c] = 1;
    }
  }

  // Clear spawn points
  const spawns = [
    [0, 0], [0, Math.floor(COLS / 2) - 1], [0, COLS - 2]
  ];
  for (const [r, c] of spawns) {
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        if (r + dr < ROWS && c + dc < COLS) map[r + dr][c + dc] = 0;
      }
    }
  }

  return map;
}

// ---- Entities ----
class Tank {
  constructor(x, y, dir, isPlayer) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.isPlayer = isPlayer;
    this.speed = isPlayer ? 2.5 : 1.2;
    this.size = 28;
    this.alive = true;
    this.cooldown = 0;
    this.cooldownMax = isPlayer ? 15 : 40;
    this.moveTimer = 0;
    this.moveDir = dir;
    this.moveChangeInterval = 80 + Math.floor(Math.random() * 60);
    this.shootChance = 0.02;
  }

  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

  getRect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }

  getCollisionBox(nx, ny) {
    return { x: nx + 2, y: ny + 2, w: this.size - 4, h: this.size - 4 };
  }
}

class Bullet {
  constructor(x, y, dir, isPlayer) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = isPlayer ? 5 : 3.5;
    this.size = 6;
    this.alive = true;
    this.isPlayer = isPlayer;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }
}

class Base {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = TILE * 2;
    this.alive = true;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }
}

// ---- Collision ----
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function canMoveTo(tank, nx, ny, map, bullets, otherTanks, base) {
  const box = tank.getCollisionBox(nx, ny);

  // Map bounds
  if (box.x < 0 || box.y < 0 || box.x + box.w > COLS * TILE || box.y + box.h > ROWS * TILE) {
    return false;
  }

  // Map tiles (check corners)
  const checkTile = (px, py) => {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    return map[r][c] !== 0;
  };

  const margin = 1;
  if (checkTile(box.x + margin, box.y + margin) ||
      checkTile(box.x + box.w - margin, box.y + margin) ||
      checkTile(box.x + margin, box.y + box.h - margin) ||
      checkTile(box.x + box.w - margin, box.y + box.h - margin)) {
    return false;
  }

  // Other tanks
  for (const other of otherTanks) {
    if (other === tank || !other.alive) continue;
    if (rectsOverlap(box, other.getCollisionBox(other.x, other.y))) return false;
  }

  return true;
}

// ---- Game Logic ----
class Game {
  constructor() {
    this.map = createLevel(1);
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.enemiesTotal = 20;
    this.enemiesSpawned = 0;
    this.enemiesKilled = 0;
    this.maxEnemiesOnScreen = 4;
    this.paused = false;
    this.gameOver = false;
    this.won = false;
    this.bullets = [];
    this.enemies = [];
    this.explosions = [];
    this.spawnQueue = [];
    this.frameCount = 0;
    this.spawnTimer = 0;

    // Combo system
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboDecay = 180;  // frames before combo resets
    this.comboMultiplier = () => 1 + Math.floor(this.combo / 3) * 0.5;

    // Floating score text
    this.floatTexts = [];

    // Particles
    this.particles = [];

    // Screen shake
    this.shakeAmount = 0;
    this.shakeDecay = 0.85;

    // Level transition
    this.levelTransition = 0;
    this.transitionText = '';

    // High score
    this.highScore = parseInt(localStorage.getItem('tankHighScore') || '0', 10);

    // Cheat codes
    this.cheatBuffer = [];
    this.godMode = false;
    this.cheats = { 'GOD': 'godMode' };

    // Base
    const baseX = Math.floor(COLS / 2) - 1;
    const baseY = ROWS - 2;
    this.base = new Base(baseX * TILE, baseY * TILE);

    // Player
    this.player = new Tank(8 * TILE, (ROWS - 3) * TILE, DIR.UP, true);

    // Initialize spawn queue
    for (let i = 0; i < this.enemiesTotal; i++) {
      this.spawnQueue.push(i);
    }

    window.game = this; // Expose for debugging
    window.keys = keys;
  }

  spawnEnemy() {
    if (this.enemiesKilled + this.enemiesOnScreen >= this.enemiesTotal) return;
    if (this.enemiesOnScreen >= this.maxEnemiesOnScreen) return;
    if (this.spawnQueue.length === 0) return;

    const spawnPoints = [
      [0 * TILE, 0 * TILE],
      [Math.floor(COLS / 2 - 1) * TILE, 0 * TILE],
      [(COLS - 2) * TILE, 0 * TILE]
    ];

    // Find available spawn point
    for (const [sx, sy] of spawnPoints) {
      const testTank = new Tank(sx, sy, DIR.DOWN, false);
      testTank.size = 28;
      if (canMoveTo(testTank, sx, sy, this.map, this.bullets, 
                    [this.player, ...this.enemies], this.base)) {
        const enemy = new Tank(sx, sy, DIR.DOWN, false);
        this.spawnQueue.shift();
        this.enemiesSpawned++;
        this.enemies.push(enemy);
        this.addExplosion(sx + TILE, sy + TILE, '#aaa', 15);
        return;
      }
    }
  }

  get enemiesOnScreen() {
    return this.enemies.filter(e => e.alive).length;
  }

  get enemiesRemaining() {
    return this.spawnQueue.length + this.enemiesOnScreen;
  }

  playerShoot() {
    if (this.gameOver || this.paused) return;
    if (this.player.cooldown > 0) return;
    if (!this.player.alive) return;

    const bx = this.player.cx + DX[this.player.dir] * this.player.size / 2 - 3;
    const by = this.player.cy + DY[this.player.dir] * this.player.size / 2 - 3;
    this.bullets.push(new Bullet(bx, by, this.player.dir, true));
    this.player.cooldown = this.player.cooldownMax;
  }

  enemyShoot(enemy) {
    if (enemy.cooldown > 0) return;
    const bx = enemy.cx + DX[enemy.dir] * enemy.size / 2 - 3;
    const by = enemy.cy + DY[enemy.dir] * enemy.size / 2 - 3;
    this.bullets.push(new Bullet(bx, by, enemy.dir, false));
    enemy.cooldown = enemy.cooldownMax;
  }

  addExplosion(x, y, color = '#ff6600', size = 20) {
    this.explosions.push({ x, y, life: 12, maxLife: 12, color, size });
    // Spawn particles
    const count = Math.floor(size * 0.8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      const pSize = 2 + Math.random() * (size * 0.2);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.floor(Math.random() * 15),
        maxLife: 30,
        color: Math.random() < 0.5 ? color : '#ffaa00',
        size: pSize,
        gravity: 0.05,
      });
    }
    // Screen shake proportional to explosion size
    if (size > 20) {
      this.shakeAmount = Math.max(this.shakeAmount, Math.min(size / 6, 8));
    }
  }

  addFloatText(x, y, text, color = '#ffdd44') {
    this.floatTexts.push({ x, y, text, color, life: 60, maxLife: 60 });
  }

  activateCheat(code) {
    if (code === 'GOD') {
      this.godMode = !this.godMode;
      const badge = document.getElementById('cheat-badge');
      if (this.godMode) {
        badge.classList.add('active');
        this.addFloatText(COLS * TILE / 2, ROWS * TILE / 2, '☠️ GOD MODE', '#ff4444');
      } else {
        badge.classList.remove('active');
        this.addFloatText(COLS * TILE / 2, ROWS * TILE / 2, '😇 凡人模式', '#88ff88');
      }
    }
  }

  updateParticles() {
    // Update explosions
    for (const exp of this.explosions) {
      exp.life--;
    }
    this.explosions = this.explosions.filter(e => e.life > 0);
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  updateCombo(hit) {
    if (hit) {
      this.combo++;
      this.comboTimer = this.comboDecay;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      // Update combo UI with pop effect
      const el = document.getElementById('combo-display');
      el.textContent = `${this.combo}x`;
      el.classList.remove('combo-pop');
      void el.offsetWidth; // reflow
      el.classList.add('combo-pop');
    } else {
      this.combo = 0;
      this.comboTimer = 0;
      document.getElementById('combo-display').textContent = '0';
    }
  }

  update() {
    if (this.gameOver || this.paused) return;

    // Level transition countdown
    if (this.levelTransition > 0) {
      this.levelTransition--;
      if (this.levelTransition <= 0) {
        this.levelTransition = 0;
        // First frame after transition — update UI
        this.updateUI();
      }
      this.updateParticles();
      return;
    }

    this.frameCount++;

    // ---- Update Player ----
    if (this.player.alive) {
      this.player.cooldown = Math.max(0, this.player.cooldown - 1);
      if (this.player.invincible > 0) this.player.invincible--;

      let moving = false;
      if (keys['ArrowUp']) { this.player.dir = DIR.UP; moving = true; }
      else if (keys['ArrowDown']) { this.player.dir = DIR.DOWN; moving = true; }
      else if (keys['ArrowLeft']) { this.player.dir = DIR.LEFT; moving = true; }
      else if (keys['ArrowRight']) { this.player.dir = DIR.RIGHT; moving = true; }

      if (moving) {
        const allTanks = [this.player, ...this.enemies.filter(e => e.alive)];
        const nx = this.player.x + DX[this.player.dir] * this.player.speed;
        const ny = this.player.y + DY[this.player.dir] * this.player.speed;
        if (canMoveTo(this.player, nx, ny, this.map, this.bullets, allTanks, this.base)) {
          this.player.x = nx;
          this.player.y = ny;
        }
      }
    }

    // ---- Combo Decay ----
    if (this.combo > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.updateCombo(false);
      }
    }

    // ---- Spawn Enemies ----
    this.spawnTimer++;
    if (this.spawnTimer > 120 && this.enemiesRemaining > 0) {
      this.spawnEnemy();
      this.spawnTimer = 0;
    }

    // ---- Update Enemies ----
    const allTanks = [this.player, ...this.enemies.filter(e => e.alive)];
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.cooldown = Math.max(0, enemy.cooldown - 1);
      enemy.moveTimer++;

      // AI: change direction periodically
      if (enemy.moveTimer > enemy.moveChangeInterval || !canMoveTo(enemy,
          enemy.x + DX[enemy.dir] * 1, enemy.y + DY[enemy.dir] * 1,
          this.map, this.bullets, allTanks, this.base)) {
        enemy.dir = Math.floor(Math.random() * 4);
        enemy.moveTimer = 0;
        enemy.moveChangeInterval = 60 + Math.floor(Math.random() * 80);
      }

      const nx = enemy.x + DX[enemy.dir] * enemy.speed;
      const ny = enemy.y + DY[enemy.dir] * enemy.speed;
      if (canMoveTo(enemy, nx, ny, this.map, this.bullets, allTanks, this.base)) {
        enemy.x = nx;
        enemy.y = ny;
      }

      // Shooting
      if (Math.random() < enemy.shootChance) {
        this.enemyShoot(enemy);
      }
    }

    // ---- Update Bullets ----
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      bullet.x += DX[bullet.dir] * bullet.speed;
      bullet.y += DY[bullet.dir] * bullet.speed;

      // Out of bounds
      if (bullet.x < 0 || bullet.y < 0 || 
          bullet.x + bullet.size > COLS * TILE || 
          bullet.y + bullet.size > ROWS * TILE) {
        bullet.alive = false;
        continue;
      }

      // Hit map tiles
      const bc = Math.floor((bullet.x + bullet.size / 2) / TILE);
      const br = Math.floor((bullet.y + bullet.size / 2) / TILE);
      if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS && this.map[br][bc] > 0) {
        bullet.alive = false;
        if (this.map[br][bc] === 1) {
          this.map[br][bc] = 0;
          this.addExplosion(bc * TILE, br * TILE, '#ffaa00', 16);
        } else {
          this.addExplosion(bc * TILE, br * TILE, '#88aaff', 12);
        }
        continue;
      }

      // Hit base
      if (this.base.alive && rectsOverlap(bullet.getRect(), this.base.getRect())) {
        bullet.alive = false;
        this.base.alive = false;
        this.addExplosion(this.base.x + this.base.size / 2, 
                         this.base.y + this.base.size / 2, '#ff0000', 40);
        continue;
      }

      // Hit tanks
      const bx1 = bullet.x, by1 = bullet.y;
      
      if (bullet.isPlayer) {
        // Player bullet hits enemies
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (rectsOverlap({ x: bx1, y: by1, w: bullet.size, h: bullet.size }, 
                          { x: enemy.x, y: enemy.y, w: enemy.size, h: enemy.size })) {
            bullet.alive = false;
            enemy.alive = false;
            this.enemiesKilled++;
            // Combo scoring
            this.updateCombo(true);
            const multiplier = this.comboMultiplier();
            const baseScore = Math.floor(100 * multiplier);
            this.score += baseScore;
            this.addExplosion(enemy.cx, enemy.cy, '#ff4400', 30);
            this.addExplosion(enemy.cx - 5, enemy.cy - 5, '#ff8800', 15);
            // Floating score text
            const label = multiplier > 1 ? `+${baseScore} (${multiplier.toFixed(1)}x)` : `+${baseScore}`;
            this.addFloatText(enemy.cx, enemy.cy - 10, label, '#ffdd44');
            break;
          }
        }
      } else {
        // Enemy bullet hits player
        if (this.player.alive && !this.godMode && !this.player.invincible && rectsOverlap(
            { x: bx1, y: by1, w: bullet.size, h: bullet.size },
            { x: this.player.x, y: this.player.y, w: this.player.size, h: this.player.size })) {
          bullet.alive = false;
          this.player.alive = false;
          this.addExplosion(this.player.cx, this.player.cy, '#ff6600', 35);
          this.addFloatText(this.player.cx, this.player.cy - 20, '💥 连击中断!', '#ff4444');
          this.updateCombo(false);
        }
      }
    }

    // Clean up
    this.bullets = this.bullets.filter(b => b.alive);

    // Respawn player
    if (!this.player.alive) {
      this.lives--;
      if (this.lives <= 0) {
        this.endGame(false);
        return;
      }
      // Respawn after delay — with collision check
      if (this.frameCount % 60 === 0) {
        const spawnX = 8 * TILE;
        const spawnY = (ROWS - 3) * TILE;
        const newTank = new Tank(spawnX, spawnY, DIR.UP, true);
        const aliveEnemies = this.enemies.filter(e => e.alive);
        if (canMoveTo(newTank, spawnX, spawnY, this.map, this.bullets, [this.player, ...aliveEnemies], this.base)) {
          this.player = newTank;
          this.player.alive = true;
          this.player.invincible = 40; // ~0.67s invincibility
        }
      }
    }

    // ---- Check Win ----
    if (this.enemiesKilled >= this.enemiesTotal) {
      if (this.level < 3) {
        this.nextLevel();
      } else {
        this.endGame(true);
      }
      return;
    }

    // ---- Check Base Destroyed ----
    if (!this.base.alive) {
      this.endGame(false);
      return;
    }

    // ---- Update Particles & Explosions ----
    this.updateParticles();

    // ---- Update Floating Texts ----
    for (const ft of this.floatTexts) {
      ft.life--;
    }
    this.floatTexts = this.floatTexts.filter(f => f.life > 0);

    // Update UI
    this.updateUI();
  }

  nextLevel() {
    this.level++;
    this.map = createLevel(this.level);
    this.player = new Tank(8 * TILE, (ROWS - 3) * TILE, DIR.UP, true);
    this.player.invincible = 60;
    this.enemies = [];
    this.bullets = [];
    this.explosions = [];
    this.particles = [];
    this.enemiesSpawned = 0;
    this.enemiesKilled = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.transitionText = `STAGE ${this.level}`;
    this.levelTransition = 90;
    for (let i = 0; i < this.enemiesTotal; i++) {
      this.spawnQueue.push(i);
    }
    const baseX = Math.floor(COLS / 2) - 1;
    const baseY = ROWS - 2;
    this.base = new Base(baseX * TILE, baseY * TILE);
    // Keep godMode active but refresh badge
    const badge = document.getElementById('cheat-badge');
    if (this.godMode) badge.classList.add('active');
    else badge.classList.remove('active');
  }

  endGame(won) {
    this.gameOver = true;
    this.won = won;
    // Save high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tankHighScore', String(this.highScore));
    }
    document.getElementById('game-over-overlay').classList.remove('hidden');
    document.getElementById('result-title').textContent = won ? '🎉 胜利！' : '💀 游戏结束';
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('max-combo-display').textContent = this.maxCombo;
    document.getElementById('kills-display').textContent = this.enemiesKilled;
    document.getElementById('level-display-end').textContent = this.level;
    document.getElementById('high-score-display').textContent = this.highScore;
    document.getElementById('restart-btn').textContent = '重新开始';
  }

  updateUI() {
    document.getElementById('score-display').textContent = this.score;
    document.getElementById('lives-display').textContent = this.lives;
    document.getElementById('level-display').textContent = this.level;
    const remaining = this.enemiesTotal - this.enemiesKilled;
    document.getElementById('enemies-display').textContent = Math.max(0, remaining);
  }

  render() {
    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (this.shakeAmount > 0.5) {
      shakeX = (Math.random() - 0.5) * this.shakeAmount * 2;
      shakeY = (Math.random() - 0.5) * this.shakeAmount * 2;
      this.shakeAmount *= this.shakeDecay;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear
    ctx.fillStyle = '#222';
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

    // Draw map
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.map[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (tile === 1) {
          // Brick wall
          ctx.fillStyle = '#cc6633';
          ctx.fillRect(x, y, TILE, TILE);
          // Brick pattern
          ctx.strokeStyle = '#aa5522';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE, TILE);
          ctx.beginPath();
          ctx.moveTo(x, y + TILE / 2);
          ctx.lineTo(x + TILE, y + TILE / 2);
          ctx.moveTo(x + TILE / 2, y);
          ctx.lineTo(x + TILE / 2, y + TILE / 2);
          ctx.stroke();
        } else if (tile === 2) {
          // Steel wall
          ctx.fillStyle = '#8899aa';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#aabbcc';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          // Rivets
          ctx.fillStyle = '#667788';
          const rv = 3;
          ctx.beginPath();
          ctx.arc(x + 5, y + 5, rv, 0, Math.PI * 2);
          ctx.arc(x + TILE - 5, y + 5, rv, 0, Math.PI * 2);
          ctx.arc(x + 5, y + TILE - 5, rv, 0, Math.PI * 2);
          ctx.arc(x + TILE - 5, y + TILE - 5, rv, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw base
    if (this.base.alive) {
      const bx = this.base.x, by = this.base.y;
      ctx.fillStyle = '#f8d56b';
      ctx.fillRect(bx + 4, by + 8, TILE * 2 - 8, TILE * 2 - 16);
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(bx + TILE, by + 4);
      ctx.lineTo(bx + TILE - 10, by + TILE * 2 - 8);
      ctx.lineTo(bx + TILE + 10, by + TILE * 2 - 8);
      ctx.closePath();
      ctx.fill();
    } else {
      // Destroyed base
      ctx.fillStyle = '#553333';
      ctx.fillRect(this.base.x, this.base.y, this.base.size, this.base.size);
      ctx.fillStyle = '#442222';
      ctx.fillRect(this.base.x + 4, this.base.y + 4, this.base.size - 8, this.base.size - 8);
    }

    // Draw tanks
    const drawTank = (tank, color, accent) => {
      if (!tank.alive) return;
      // Invincible blink effect (skip every 4 frames)
      if (tank.invincible && Math.floor(this.frameCount / 3) % 2 === 0) return;
      const x = tank.x, y = tank.y, s = tank.size;
      const cx = x + s / 2, cy = y + s / 2;
      
      // Body
      ctx.fillStyle = color;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

      // Tracks
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 5, s);
      ctx.fillRect(x + s - 5, y, 5, s);

      // Turret
      ctx.fillStyle = accent;
      const tSize = 12;
      ctx.fillRect(cx - tSize / 2, cy - tSize / 2, tSize, tSize);

      // Barrel
      ctx.fillStyle = accent;
      const bx2 = cx + DX[tank.dir] * s / 3 - 2;
      const by2 = cy + DY[tank.dir] * s / 3 - 2;
      ctx.fillRect(Math.min(cx - 2, bx2), Math.min(cy - 2, by2),
                    Math.abs(cx - bx2) + 4, Math.abs(cy - by2) + 4);

      // Direction indicator
      ctx.fillStyle = '#fff';
      const dw = 6, dh = 4;
      const ddx = DX[tank.dir], ddy = DY[tank.dir];
      ctx.fillRect(cx + ddx * 8 - dw / 2, cy + ddy * 8 - dh / 2, dw, dh);
    };

    drawTank(this.player, '#f8d56b', '#cc9933');
    for (const enemy of this.enemies) {
      drawTank(enemy, '#e94560', '#aa2233');
    }

    // Draw bullets
    for (const bullet of this.bullets) {
      ctx.fillStyle = bullet.isPlayer ? '#ffdd44' : '#ff6644';
      ctx.shadowColor = bullet.isPlayer ? '#ffdd44' : '#ff6644';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bullet.x + bullet.size / 2, bullet.y + bullet.size / 2, bullet.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw explosions
    for (const exp of this.explosions) {
      const progress = 1 - exp.life / exp.maxLife;
      const r = exp.size * (0.3 + 0.7 * (1 - progress));
      ctx.globalAlpha = 1 - progress * 0.6;
      ctx.fillStyle = exp.color;
      ctx.shadowColor = exp.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Draw particles
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Draw floating texts
    for (const ft of this.floatTexts) {
      const progress = 1 - ft.life / ft.maxLife;
      ctx.globalAlpha = 1 - progress * 0.5;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y - progress * 40);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Draw level transition
    if (this.levelTransition > 0) {
      const progress = 1 - this.levelTransition / 90;
      ctx.globalAlpha = progress < 0.2 ? progress * 5 : (this.levelTransition < 30 ? this.levelTransition / 30 : 1);
      ctx.fillStyle = '#f8d56b';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#f8d56b';
      ctx.shadowBlur = 20;
      ctx.fillText(this.transitionText, canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '20px sans-serif';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#b0bec5';
      ctx.fillText('准备战斗！', canvas.width / 2, canvas.height / 2 + 40);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Draw "GOD MODE" indicator
    if (this.godMode) {
      ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
      ctx.setLineDash([]);
    }

    // Draw pause overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ 暂停', canvas.width / 2, canvas.height / 2);
    }

    ctx.restore();
  }
}

// ---- Game Loop ----
function startGame() {
  document.getElementById('game-over-overlay').classList.add('hidden');
  document.getElementById('cheat-badge').classList.remove('active');
  game = new Game();
  game.updateUI();
  // Display high score
  document.getElementById('highscore-display').textContent = game.highScore;
  window.game = game; // Expose for debugging
}

function gameLoop() {
  if (game && !game.gameOver) {
    game.update();
  }
  if (game) {
    game.render();
  }
  requestAnimationFrame(gameLoop);
}

// ---- Input (registered once, outside Game constructor) ----
document.addEventListener('keydown', (e) => {
  const g = window.game;
  if (!g) return;

  // Prevent browser defaults for game keys
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'p', 'P', 'j', 'J'].includes(e.key)) {
    e.preventDefault();
  }

  keys[e.key] = true;

  if (e.key === 'p' || e.key === 'P') g.paused = !g.paused;

  // Cheat code detector
  if (e.key.length === 1) {
    g.cheatBuffer.push(e.key.toUpperCase());
    if (g.cheatBuffer.length > 5) g.cheatBuffer.shift();
    const buf = g.cheatBuffer.join('');
    for (const [code] of Object.entries(g.cheats)) {
      if (buf.endsWith(code)) {
        g.activateCheat(code);
        g.cheatBuffer = [];
      }
    }
  }

  if ((e.key === ' ' || e.key === 'j' || e.key === 'J') && !g.gameOver) {
    g.playerShoot();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ---- Event Listeners ----
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', startGame);

  // ---- Load high score ----
  const hs = parseInt(localStorage.getItem('tankHighScore') || '0', 10);
  document.getElementById('highscore-display').textContent = hs;

  // ---- Start ----
  startGame();
  gameLoop();
});
