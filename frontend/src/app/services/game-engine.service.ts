import {
  BOSS_DURATION,
  BOSS_MAX_HEALTH,
  BossState,
  Decoy,
  EnemyKind,
  EnemyState,
  Entity,
  GameConfig,
  GameSnapshot,
  GameStatus,
  LOSE_ICONS,
  NARRATIVE_ZONES,
  PIXELS_PER_METER,
  Player,
  PowerKind,
  Projectile,
  RadarBlip,
  SeededRandom,
  SfxEvent,
  TUTORIAL_HINTS,
  Vec2,
  WORLD_HEIGHT_SCALE,
} from './game-types';

export type { GameSnapshot, GameConfig, GameStatus } from './game-types';

let entityId = 1;

export class GameEngine {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private config!: GameConfig;
  private player!: Player;
  private enemies: Entity[] = [];
  private powerUps: Entity[] = [];
  private checkpoints: Entity[] = [];
  private projectiles: Projectile[] = [];
  private decoy: Decoy | null = null;
  private boss: BossState | null = null;
  private reefGoal!: Entity;
  private rng = Math.random;
  private keys: Record<string, boolean> = {};
  private touchStart: Vec2 | null = null;
  private animationFrame = 0;
  private lastTimestamp = 0;
  private elapsedMs = 0;
  private countdownLeft = 3;
  private spawnTimer = 0;
  private powerUpTimer = 0;
  private waveTimer = 0;
  private status: GameStatus = 'idle';
  private pearlsCollected = 0;
  private tentaclePhase = 0;
  private lastLoseIcon = '🦈';
  private worldHeight = 0;
  private playerStartY = 0;
  private cameraY = 0;
  private nearMissBonus = 0;
  private upwardStreak = 0;
  private movingUp = false;
  private screenShake = 0;
  private shakeTimeLeft = 0;
  private flashAlpha = 0;
  private tutorialElapsed = 0;
  private checkpointsPassed = 0;
  private bossSpawned = false;
  private pausedFrom: GameStatus = 'playing';
  private onSnapshot?: (snapshot: GameSnapshot) => void;
  private rafId = 0;
  private boundKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private boundKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
  private boundTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private boundTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private boundTouchEnd = () => (this.touchStart = null);

  init(canvas: HTMLCanvasElement, config: GameConfig, onSnapshot: (s: GameSnapshot) => void): void {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.config = config;
    this.onSnapshot = onSnapshot;
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    const seeded = new SeededRandom(config.dailySeed);
    this.rng = config.dailyChallenge ? () => seeded.next() : Math.random;
    this.reset();
    this.attachListeners();
  }

  start(): void {
    if (this.status === 'playing' || this.status === 'countdown') return;
    this.reset();
    this.status = 'countdown';
    this.countdownLeft = 3;
    this.lastTimestamp = performance.now();
    this.seedInitialThreats();
    this.loop(this.lastTimestamp);
    this.sfx('countdown');
    this.emitSnapshot('Get ready — swim to the encrypted reef!');
  }

  pause(): void {
    if (!['playing', 'boss', 'countdown'].includes(this.status)) return;
    this.pausedFrom = this.status;
    this.status = 'paused';
    cancelAnimationFrame(this.rafId);
    this.emitSnapshot('Paused');
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = this.pausedFrom;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
    this.emitSnapshot('Back in the currents!');
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.detachListeners();
    this.status = 'idle';
  }

  private sfx(event: SfxEvent): void {
    this.config.onSfx?.(event);
  }

  private reset(): void {
    entityId = 1;
    const preset = this.config.preset;
    this.worldHeight = this.config.height * WORLD_HEIGHT_SCALE;
    this.playerStartY = this.worldHeight - 90;
    this.player = {
      x: this.config.width / 2,
      y: this.playerStartY,
      radius: 22,
      speed: preset.playerSpeed,
      baseSpeed: preset.playerSpeed,
      invisibleUntil: 0,
      shieldUntil: 0,
      speedBoostUntil: 0,
      slowUntil: 0,
      wake: [],
    };
    this.enemies = [];
    this.powerUps = [];
    this.checkpoints = [];
    this.projectiles = [];
    this.decoy = null;
    this.boss = null;
    this.bossSpawned = false;
    this.reefGoal = {
      id: entityId++,
      x: this.config.width / 2,
      y: 72,
      vx: 0,
      vy: 0,
      radius: 42,
      kind: 'reef-goal',
      emoji: '🪸',
      active: true,
      phase: 0,
      trail: [],
    };
    this.buildCheckpoints();
    this.elapsedMs = 0;
    this.spawnTimer = 0;
    this.powerUpTimer = 0;
    this.waveTimer = 0;
    this.pearlsCollected = 0;
    this.tentaclePhase = 0;
    this.nearMissBonus = 0;
    this.upwardStreak = 0;
    this.screenShake = 0;
    this.shakeTimeLeft = 0;
    this.flashAlpha = 0;
    this.tutorialElapsed = 0;
    this.checkpointsPassed = 0;
    this.cameraY = this.playerStartY - this.config.height * 0.78;
    this.status = 'idle';
  }

  private buildCheckpoints(): void {
    const fracs = [0.25, 0.5, 0.75];
    fracs.forEach((f, i) => {
      const y = this.playerStartY - (this.playerStartY - this.reefGoal.y) * f;
      this.checkpoints.push({
        id: entityId++,
        x: this.config.width * (0.28 + i * 0.22),
        y,
        vx: 0,
        vy: 0,
        radius: 28,
        kind: 'checkpoint',
        emoji: '🛡️',
        active: true,
        phase: i,
        trail: [],
        checkpointId: i + 1,
      });
    });
  }

  private rand(): number {
    return this.rng();
  }

  private attachListeners(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundTouchEnd);
  }

  private detachListeners(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    const map: Record<string, string> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right',
    };
    const key = map[e.key];
    if (!key) return;
    e.preventDefault();
    this.keys[key] = down;
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.touchStart = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.touchStart || !this.isActivePhase()) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const scale = this.canvas.width / rect.width;
    this.player.x += (current.x - this.touchStart.x) * scale * 0.15;
    this.player.y += (current.y - this.touchStart.y) * scale * 0.15;
    this.touchStart = current;
    this.clampPlayer();
    this.updateCamera();
  }

  private isActivePhase(): boolean {
    return this.status === 'playing' || this.status === 'countdown' || this.status === 'boss';
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;
    if (this.status !== 'paused') {
      this.updateShake(dt);
    }
    if (this.status === 'countdown') {
      this.updateCountdown(dt);
      this.emitSnapshot();
    } else if (this.status === 'playing' || this.status === 'boss') {
      this.update(dt, timestamp);
    } else if (this.status === 'lost' || this.status === 'won') {
      this.emitSnapshot();
    }
    if (this.status !== 'paused') this.render(timestamp);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private updateCountdown(dt: number): void {
    this.tentaclePhase += dt * 6;
    this.countdownLeft -= dt;
    this.movePlayer(dt, true);
    if (this.countdownLeft <= 0) {
      this.status = 'playing';
      this.sfx('go');
      this.emitSnapshot('Go! Swim to the Zama Reef!');
      if (this.config.showTutorial) this.emitSnapshot(TUTORIAL_HINTS[0]);
    } else {
      const sec = Math.ceil(this.countdownLeft);
      if (sec !== Math.ceil(this.countdownLeft + dt)) this.sfx('countdown');
      this.emitSnapshot(sec > 0 ? `Starting in ${sec}…` : 'Go!');
    }
  }

  private update(dt: number, now: number): void {
    this.elapsedMs += dt * 1000;
    this.tentaclePhase += dt * 6;
    if (this.config.showTutorial) this.tutorialElapsed += dt;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);

    this.applyPlayerBuffs(now);
    this.movePlayer(dt, false);
    this.updateCombo(dt);
    this.trySpawnBoss();
    this.updateBoss(dt, now);

    const chasingAllowed = this.status !== 'countdown';
    if (chasingAllowed && this.status !== 'boss') {
      this.spawnTimer += dt;
      this.powerUpTimer += dt;
      this.waveTimer += dt;
      const activeCount = this.enemies.filter((e) => e.active).length;
      if (this.spawnTimer > this.getSpawnInterval() && activeCount < this.config.preset.maxEnemies) {
        this.spawnTimer = 0;
        this.spawnEnemy(false);
        if (this.rand() < this.config.preset.burstChance && activeCount + 1 < this.config.preset.maxEnemies) {
          this.spawnEnemy(false);
        }
      }
      if (this.powerUpTimer > this.config.preset.powerUpInterval) {
        this.powerUpTimer = 0;
        this.spawnPowerUp();
      }
      if (this.waveTimer > 28 && this.config.difficulty !== 'easy') {
        this.waveTimer = 0;
        const extra = this.config.difficulty === 'insane' ? 2 : 2;
        for (let i = 0; i < extra; i++) {
          if (this.enemies.length < this.config.preset.maxEnemies) this.spawnEnemy(false);
        }
        this.emitSnapshot('🌊 Predator wave incoming!');
      }
    }

    this.updateEnemies(dt, now);
    this.updateProjectiles(dt);
    this.checkCollisions(now);
    this.emitSnapshot();
  }

  private applyPlayerBuffs(now: number): void {
    const p = this.player;
    p.speed = p.baseSpeed;
    if (now < p.speedBoostUntil) p.speed *= 1.45;
    if (now < p.slowUntil) p.speed *= 0.55;
  }

  private getSpawnInterval(): number {
    const ramp = Math.max(0.55, 1 - (this.elapsedMs / 60000) * 0.12);
    return this.config.preset.spawnInterval * ramp;
  }

  private movePlayer(dt: number, countdown: boolean): void {
    let dx = 0;
    let dy = 0;
    if (this.keys['up']) dy -= 1;
    if (this.keys['down']) dy += 1;
    if (this.keys['left']) dx -= 1;
    if (this.keys['right']) dx += 1;
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      this.player.x += (dx / len) * this.player.speed * dt;
      this.player.y += (dy / len) * this.player.speed * dt;
      if (dy < 0) this.movingUp = true;
      this.player.wake.push({ x: this.player.x, y: this.player.y });
      if (this.player.wake.length > 14) this.player.wake.shift();
    } else {
      this.movingUp = false;
    }
    this.clampPlayer();
    this.updateCamera();
  }

  private triggerShake(intensity: number, duration = 3): void {
    this.screenShake = intensity;
    this.shakeTimeLeft = Math.min(3, Math.max(this.shakeTimeLeft, duration));
  }

  private updateShake(dt: number): void {
    if (this.shakeTimeLeft <= 0) {
      this.screenShake = 0;
      return;
    }
    this.shakeTimeLeft -= dt;
    if (this.shakeTimeLeft <= 0) {
      this.screenShake = 0;
      this.shakeTimeLeft = 0;
    } else {
      this.screenShake = this.shakeTimeLeft / 3;
    }
  }

  private updateCombo(dt: number): void {
    if (this.movingUp) this.upwardStreak = Math.min(12, this.upwardStreak + dt);
    else this.upwardStreak = Math.max(0, this.upwardStreak - dt * 2);
  }

  private comboMultiplier(): number {
    return 1 + Math.min(2, Math.floor(this.upwardStreak) * 0.25);
  }

  private clampPlayer(): void {
    const p = this.player;
    p.x = Math.max(p.radius, Math.min(this.config.width - p.radius, p.x));
    p.y = Math.max(this.reefGoal.y + p.radius, Math.min(this.worldHeight - p.radius, p.y));
  }

  private updateCamera(): void {
    const target = this.player.y - this.config.height * 0.72;
    const maxCamera = Math.max(0, this.worldHeight - this.config.height);
    this.cameraY = Math.max(0, Math.min(maxCamera, target));
  }

  private visibleWorldBand(padding = 100): { top: number; bottom: number } {
    return {
      top: Math.max(this.reefGoal.y, this.cameraY - padding),
      bottom: Math.min(this.worldHeight - 40, this.cameraY + this.config.height + padding),
    };
  }

  private seedInitialThreats(): void {
    for (let i = 0; i < this.config.preset.initialEnemies; i++) this.spawnEnemy(true);
  }

  private pickEnemyKind(): EnemyKind {
    const p = this.config.preset;
    const r = this.rand();
    if (r < p.chainChance) return 'chain';
    if (r < p.chainChance + p.jellyChance) return 'jellyfish';
    if (r < p.chainChance + p.jellyChance + p.whaleChance) return 'whale';
    return 'shark';
  }

  private newEnemyState(kind: EnemyKind): EnemyState {
    return {
      burstCd: kind === 'shark' ? 2 + this.rand() * 2 : 0,
      burstTimer: 0,
      sonarCd: kind === 'whale' ? 2 + this.rand() * 2 : 0,
      sonarActive: 0,
      sonarRadius: 0,
      poisonTrail: [],
      spin: this.rand() * Math.PI * 2,
    };
  }

  private spawnEnemy(initial: boolean): void {
    const preset = this.config.preset;
    const kind = this.pickEnemyKind();
    const { top, bottom } = this.visibleWorldBand(initial ? 200 : 80);
    const edge = Math.floor(this.rand() * 4);
    let x = 0;
    let y = top + this.rand() * Math.max(80, bottom - top);
    if (edge === 0) x = -35;
    else if (edge === 1) x = this.config.width + 35;
    else x = 40 + this.rand() * (this.config.width - 80);
    if (edge === 2) y = top - 35;
    if (edge === 3) y = bottom + 35;

    const tcx = this.decoy && performance.now() < this.decoy.until ? this.decoy.x : this.player.x;
    const tcy = this.decoy && performance.now() < this.decoy.until ? this.decoy.y : this.player.y;
    const dx = tcx - x;
    const dy = tcy - y;
    const dist = Math.hypot(dx, dy) || 1;
    let vx = 0;
    let vy = 0;
    if (kind === 'shark') {
      vx = (dx / dist) * preset.sharkSpeed;
      vy = (dy / dist) * preset.sharkSpeed * 0.6;
    } else if (kind === 'whale') {
      vx = (dx / dist) * preset.whaleSpeed;
      vy = (dy / dist) * preset.whaleSpeed * 0.5;
    } else if (kind === 'chain') {
      vx = (this.rand() < 0.5 ? -1 : 1) * (90 + this.rand() * 30);
      vy = (this.rand() - 0.5) * 20;
    } else {
      vx = (this.rand() - 0.5) * 40;
      vy = 30 + this.rand() * 20;
    }

    const meta: Record<EnemyKind, { radius: number; emoji: string }> = {
      shark: { radius: 24, emoji: '🦈' },
      whale: { radius: 36, emoji: '🐋' },
      chain: { radius: 20, emoji: '⛓️' },
      jellyfish: { radius: 22, emoji: '🪼' },
    };

    this.enemies.push({
      id: entityId++,
      x, y, vx, vy,
      radius: meta[kind].radius,
      kind,
      emoji: meta[kind].emoji,
      active: true,
      phase: this.rand() * Math.PI * 2,
      trail: [],
      enemyState: this.newEnemyState(kind),
    });
  }

  private spawnPowerUp(): void {
    const roll = this.rand();
    let kind: PowerKind = 'pearl';
    if (roll < 0.12) kind = 'pearl-mega';
    else if (roll < 0.22) kind = 'speed-current';
    else if (roll < 0.3) kind = 'decoy';
    else if (roll < 0.42) kind = 'reef-power';
    const emojis: Record<PowerKind, string> = {
      pearl: '🔮', 'pearl-mega': '💎', 'speed-current': '⚡', decoy: '🎭', 'reef-power': '🏝️',
    };
    const { top, bottom } = this.visibleWorldBand(60);
    this.powerUps.push({
      id: entityId++,
      x: 50 + this.rand() * (this.config.width - 100),
      y: top + this.rand() * Math.max(100, bottom - top),
      vx: 0, vy: 0,
      radius: kind === 'reef-power' ? 20 : 16,
      kind,
      emoji: emojis[kind],
      active: true,
      phase: 0,
      trail: [],
    });
  }

  private updateEnemies(dt: number, now: number): void {
    const preset = this.config.preset;
    const invisible = now < this.player.invisibleUntil;
    const canChase = !invisible && this.status !== 'countdown';

    for (const enemy of this.enemies) {
      if (!enemy.active || !enemy.enemyState) continue;
      const st = enemy.enemyState;
      enemy.phase += dt * (enemy.kind === 'jellyfish' ? 4 : 7);
      st.spin += dt * (enemy.kind === 'chain' ? 2.5 : 0);
      enemy.trail.push({ x: enemy.x, y: enemy.y });
      if (enemy.trail.length > 10) enemy.trail.shift();

      if (enemy.kind === 'shark') {
        st.burstCd -= dt;
        if (st.burstCd <= 0) {
          st.burstTimer = 0.7;
          st.burstCd = 4;
        }
        if (st.burstTimer > 0) st.burstTimer -= dt;
      }
      if (enemy.kind === 'whale') {
        st.sonarCd -= dt;
        if (st.sonarCd <= 0) {
          st.sonarActive = 0.8;
          st.sonarRadius = 30;
          st.sonarCd = 3.5;
        }
        if (st.sonarActive > 0) {
          st.sonarActive -= dt;
          st.sonarRadius += dt * 120;
          const d = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
          if (d < st.sonarRadius && d > st.sonarRadius - 40) {
            this.player.slowUntil = Math.max(this.player.slowUntil, now + 1000);
          }
        }
      }
      if (enemy.kind === 'jellyfish') {
        st.poisonTrail.push({ x: enemy.x, y: enemy.y });
        if (st.poisonTrail.length > 12) st.poisonTrail.shift();
      }
      if (enemy.kind === 'chain') {
        if (enemy.x < 30 || enemy.x > this.config.width - 30) enemy.vx *= -1;
        enemy.vy += Math.sin(enemy.phase) * 10 * dt;
      }

      if (canChase && (enemy.kind === 'shark' || enemy.kind === 'whale')) {
        const tx = this.decoy && now < this.decoy.until ? this.decoy.x : this.player.x;
        const ty = this.decoy && now < this.decoy.until ? this.decoy.y : this.player.y;
        const dx = tx - enemy.x;
        const dy = ty - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        let chase = enemy.kind === 'shark' ? preset.sharkChase : preset.whaleChase;
        if (enemy.kind === 'shark' && st.burstTimer > 0) chase *= 2.5;
        enemy.vx += (dx / dist) * chase * dt;
        enemy.vy += (dy / dist) * chase * dt;
      }

      const maxSp =
        enemy.kind === 'shark' ? preset.sharkMaxSpeed :
        enemy.kind === 'whale' ? preset.whaleMaxSpeed :
        enemy.kind === 'chain' ? 120 : 65;
      const sp = Math.hypot(enemy.vx, enemy.vy);
      if (sp > maxSp) {
        enemy.vx = (enemy.vx / sp) * maxSp;
        enemy.vy = (enemy.vy / sp) * maxSp;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      if (!invisible && canChase) {
        const d = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
        const sum = this.player.radius + enemy.radius;
        if (d < sum * 2.2 && d > sum) {
          this.nearMissBonus += Math.floor(dt * 40);
          if (Math.random() < 0.05) this.sfx('nearmiss');
        }
      }

      const offY = enemy.y < this.cameraY - 140 || enemy.y > this.cameraY + this.config.height + 140;
      if (enemy.x < -100 || enemy.x > this.config.width + 100 || offY) enemy.active = false;
    }
    this.enemies = this.enemies.filter((e) => e.active);

    if (this.decoy && now > this.decoy.until) this.decoy = null;
    if (this.decoy) {
      this.decoy.x += this.decoy.vx * dt;
      this.decoy.y += this.decoy.vy * dt;
      this.decoy.vx += (this.rand() - 0.5) * 30 * dt;
      this.decoy.vy += (this.rand() - 0.5) * 30 * dt;
    }
  }

  private trySpawnBoss(): void {
    const progress = this.journeyProgress();
    if (this.bossSpawned || progress < 85) return;
    this.bossSpawned = true;
    this.boss = {
      x: this.config.width / 2,
      y: Math.max(this.reefGoal.y + 160, this.player.y - 180),
      health: BOSS_MAX_HEALTH,
      timeLeft: BOSS_DURATION,
      projectileCd: 0,
      active: true,
      defeated: false,
    };
    this.status = 'boss';
    this.sfx('boss');
    this.emitSnapshot('🔍 Block Explorer boss — survive 15s!');
  }

  private updateBoss(dt: number, now: number): void {
    if (!this.boss?.active || this.boss.defeated) return;
    const b = this.boss;
    b.timeLeft -= dt;
    b.health = Math.max(0, (b.timeLeft / BOSS_DURATION) * BOSS_MAX_HEALTH);
    b.projectileCd -= dt;
    if (b.projectileCd <= 0) {
      b.projectileCd = 1.1;
      const angle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      for (let i = -1; i <= 1; i++) {
        const a = angle + i * 0.35;
        this.projectiles.push({
          id: entityId++,
          x: b.x,
          y: b.y,
          vx: Math.cos(a) * 200,
          vy: Math.sin(a) * 200,
          radius: 10,
          active: true,
        });
      }
    }
    if (b.timeLeft <= 0) {
      b.defeated = true;
      b.active = false;
      this.status = 'playing';
      this.projectiles = [];
      this.emitSnapshot('Boss defeated — reach the reef!');
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -20 || p.x > this.config.width + 20 || p.y < this.cameraY - 40 || p.y > this.cameraY + this.config.height + 40) {
        p.active = false;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  private checkCollisions(now: number): void {
    const p = this.player;
    const invisible = now < p.invisibleUntil;
    const shielded = now < p.shieldUntil;

    for (const cp of this.checkpoints) {
      if (!cp.active) continue;
      if (this.intersects(p.x, p.y, p.radius, cp.x, cp.y, cp.radius)) {
        cp.active = false;
        this.checkpointsPassed += 1;
        p.shieldUntil = now + 2000;
        this.nearMissBonus += 100;
        this.flashAlpha = 0.35;
        this.sfx('checkpoint');
        this.emitSnapshot(`Checkpoint ${cp.checkpointId} — shield active!`);
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.active || invisible) continue;
      if (enemy.kind === 'jellyfish' && enemy.enemyState) {
        for (const pt of enemy.enemyState.poisonTrail) {
          if (this.intersects(p.x, p.y, p.radius * 0.85, pt.x, pt.y, 14)) {
            this.lose(enemy.kind, 'Mempool poison trail — exposed!');
            return;
          }
        }
      }
      if (this.intersects(p.x, p.y, p.radius, enemy.x, enemy.y, enemy.radius)) {
        if (shielded) {
          enemy.active = false;
          this.triggerShake(0.5, 0.4);
          continue;
        }
        this.lose(enemy.kind as EnemyKind, '');
        return;
      }
    }

    for (const bolt of this.projectiles) {
      if (!bolt.active || invisible || shielded) continue;
      if (this.intersects(p.x, p.y, p.radius, bolt.x, bolt.y, bolt.radius)) {
        this.lose('shark', 'Block Explorer data bolt hit you!');
        return;
      }
    }

    for (const power of this.powerUps) {
      if (!power.active) continue;
      if (!this.intersects(p.x, p.y, p.radius, power.x, power.y, power.radius)) continue;
      power.active = false;
      this.applyPowerUp(power.kind as PowerKind, now);
    }
    this.powerUps = this.powerUps.filter((pu) => pu.active);

    const bossBlocks = this.boss?.active && !this.boss.defeated;
    if (!bossBlocks && this.intersects(p.x, p.y, p.radius, this.reefGoal.x, this.reefGoal.y, this.reefGoal.radius)) {
      this.status = 'won';
      this.sfx('win');
      this.emitSnapshot('You reached the Zama encrypted reef!');
    }
  }

  private applyPowerUp(kind: PowerKind, now: number): void {
    const p = this.player;
    this.flashAlpha = 0.5;
    if (kind === 'pearl') {
      this.pearlsCollected += 1;
      p.invisibleUntil = now + 5000;
      this.sfx('pearl');
      this.emitSnapshot('FHE Pearl — 5s invisibility!');
    } else if (kind === 'pearl-mega') {
      this.pearlsCollected += 2;
      p.invisibleUntil = now + 10000;
      this.sfx('mega');
      this.emitSnapshot('Mega Pearl — 10s invisibility!');
    } else if (kind === 'speed-current') {
      p.speedBoostUntil = now + 3000;
      this.sfx('speed');
      this.emitSnapshot('Speed current — swim faster!');
    } else if (kind === 'decoy') {
      this.decoy = {
        id: entityId++,
        x: p.x,
        y: p.y,
        vx: (this.rand() - 0.5) * 60,
        vy: (this.rand() - 0.5) * 60,
        until: now + 4000,
      };
      this.sfx('decoy');
      this.emitSnapshot('Decoy deployed — sharks distracted!');
    } else {
      this.teleportToSafety();
    }
  }

  private teleportToSafety(): void {
    const maxJump = this.config.height * 0.28;
    let safeY = this.player.y - maxJump;
    if (this.boss?.active && !this.boss.defeated) {
      safeY = Math.min(safeY, this.boss.y + 100);
    }
    safeY = Math.max(this.reefGoal.y + 200, safeY);
    this.player.x = this.config.width / 2;
    this.player.y = safeY;
    this.updateCamera();
    this.enemies.forEach((e) => {
      e.y = Math.min(this.worldHeight - 40, e.y + 100);
    });
    this.sfx('teleport');
    this.emitSnapshot('Privacy Reef — teleported to safety!');
  }

  private lose(kind: EnemyKind, msg: string): void {
    this.status = 'lost';
    this.lastLoseIcon = LOSE_ICONS[kind];
    this.triggerShake(1, 3);
    this.sfx('hit');
    const defaults: Record<EnemyKind, string> = {
      shark: 'Public Shark caught you on-chain!',
      whale: 'Data Whale swallowed your privacy!',
      chain: 'Public chain links trapped you!',
      jellyfish: 'Mempool sting — you are visible!',
    };
    this.emitSnapshot(msg || defaults[kind]);
  }

  private intersects(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
  }

  private journeyProgress(): number {
    const remaining = Math.max(0, this.player.y - this.reefGoal.y);
    const total = Math.max(1, this.playerStartY - this.reefGoal.y);
    return Math.min(100, ((total - remaining) / total) * 100);
  }

  private narrativeZone(): string {
    const p = this.journeyProgress();
    return NARRATIVE_ZONES.find((z) => p <= z.max)?.text ?? NARRATIVE_ZONES[NARRATIVE_ZONES.length - 1].text;
  }

  private buildRadar(): RadarBlip[] {
    const blips: RadarBlip[] = [];
    const range = 280;
    const add = (x: number, y: number, kind: RadarBlip['kind']) => {
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      if (Math.hypot(dx, dy) > range) return;
      blips.push({
        x: 0.5 + dx / (range * 2),
        y: 0.5 + dy / (range * 2),
        kind,
      });
    };
    for (const e of this.enemies) {
      if (e.active && (e.kind === 'shark' || e.kind === 'whale' || e.kind === 'chain' || e.kind === 'jellyfish')) {
        add(e.x, e.y, e.kind);
      }
    }
    if (this.boss?.active) add(this.boss.x, this.boss.y, 'boss');
    for (const b of this.projectiles) {
      if (b.active) add(b.x, b.y, 'bolt');
    }
    return blips.slice(0, 12);
  }

  private emitSnapshot(message?: string): void {
    const now = performance.now();
    const timeSeconds = Math.floor(this.elapsedMs / 1000);
    const remainingPx = Math.max(0, this.player.y - this.reefGoal.y);
    const progress = this.journeyProgress();
    const base =
      timeSeconds * 10 +
      this.pearlsCollected * 50 +
      this.nearMissBonus +
      (this.status === 'won' ? 500 : 0) +
      Math.max(0, 300 - Math.floor(remainingPx / 8));
    const score = Math.floor(base * this.config.preset.scoreMultiplier * this.comboMultiplier());

    const tutorialHint =
      this.config.showTutorial && this.tutorialElapsed < 16
        ? TUTORIAL_HINTS[Math.floor(this.tutorialElapsed / 2.3) % TUTORIAL_HINTS.length]
        : '';

    this.onSnapshot?.({
      status: this.status,
      score,
      timeSeconds,
      pearlsCollected: this.pearlsCollected,
      invisibleSecondsLeft: Math.max(0, (this.player.invisibleUntil - now) / 1000),
      distanceToReef: Math.round(remainingPx / PIXELS_PER_METER),
      journeyProgress: progress,
      message: message ?? '',
      difficulty: this.config.difficulty,
      enemyCount: this.enemies.length,
      loseIcon: this.lastLoseIcon,
      countdownSeconds: Math.max(0, Math.ceil(this.countdownLeft)),
      comboMultiplier: this.comboMultiplier(),
      nearMissBonus: this.nearMissBonus,
      upwardStreak: Math.floor(this.upwardStreak),
      checkpointsPassed: this.checkpointsPassed,
      narrativeZone: this.narrativeZone(),
      bossActive: !!(this.boss?.active && !this.boss.defeated),
      bossHealth: this.boss?.health ?? 0,
      bossMaxHealth: BOSS_MAX_HEALTH,
      bossTimeLeft: Math.max(0, this.boss?.timeLeft ?? 0),
      shieldSecondsLeft: Math.max(0, (this.player.shieldUntil - now) / 1000),
      speedBoostSecondsLeft: Math.max(0, (this.player.speedBoostUntil - now) / 1000),
      dailyChallenge: this.config.dailyChallenge,
      showTutorial: this.config.showTutorial && this.tutorialElapsed < 16,
      tutorialHint,
      screenShake: this.screenShake,
      flashAlpha: this.flashAlpha,
      radarBlips: this.buildRadar(),
      reefBrightness: 0.35 + progress / 140,
      decoyActive: !!(this.decoy && now < this.decoy.until),
    });
  }

  private render(now: number): void {
    const { ctx, config } = this;
    const w = config.width;
    const h = config.height;
    const invisible = now < this.player.invisibleUntil;
    const progress = this.journeyProgress();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#081f33');
    gradient.addColorStop(0.35, '#0f4c5c');
    gradient.addColorStop(0.7, '#0a3d4a');
    gradient.addColorStop(1, '#041820');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const shakeX = this.screenShake * (Math.random() - 0.5) * 12;
    const shakeY = this.screenShake * (Math.random() - 0.5) * 12;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.translate(0, -this.cameraY);

    this.drawParallax();
    this.drawCaustics(progress / 100);
    this.drawBubbles();
    this.drawDangerZone();
    this.drawCheckpoints();
    this.drawReefZone(progress);
    this.drawPowerUps();
    this.drawPoisonTrails();
    this.drawEnemies(now, invisible);
    this.drawDecoy(now);
    this.drawBoss();
    this.drawProjectiles();
    this.drawPlayerWake();
    this.drawPlayer(invisible);
    this.drawDepthMarkers();

    ctx.restore();

    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha * 0.35;
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    this.drawHudLabels();
  }

  private drawParallax(): void {
    const { ctx, config } = this;
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const x = (i * 73 + this.cameraY * 0.1) % config.width;
      const y = this.cameraY + config.height - ((i * 120 + this.animationFrame * 0.2) % (config.height + 200));
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 30, x - 4, y - 55);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCheckpoints(): void {
    for (const cp of this.checkpoints) {
      if (!cp.active) continue;
      const pulse = 1 + Math.sin(this.tentaclePhase + cp.phase) * 0.08;
      this.ctx.save();
      this.ctx.globalAlpha = 0.35;
      const g = this.ctx.createRadialGradient(cp.x, cp.y, 4, cp.x, cp.y, 50 * pulse);
      g.addColorStop(0, '#86efac');
      g.addColorStop(1, 'transparent');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(cp.x, cp.y, 50 * pulse, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.font = `${30 * pulse}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(cp.emoji, cp.x, cp.y);
      this.ctx.restore();
    }
  }

  private drawPoisonTrails(): void {
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'jellyfish' || !enemy.enemyState) continue;
      for (const pt of enemy.enemyState.poisonTrail) {
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(232, 121, 249, 0.25)';
        this.ctx.fill();
      }
    }
  }

  private drawDecoy(now: number): void {
    if (!this.decoy || now > this.decoy.until) return;
    this.ctx.font = '28px serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.globalAlpha = 0.85;
    this.ctx.fillText('🎭', this.decoy.x, this.decoy.y);
    this.ctx.globalAlpha = 1;
  }

  private drawBoss(): void {
    if (!this.boss?.active) return;
    const b = this.boss;
    this.ctx.save();
    this.ctx.globalAlpha = 0.4;
    const g = this.ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 90);
    g.addColorStop(0, '#f87171');
    g.addColorStop(1, 'transparent');
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y, 90, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.font = '52px serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🔍', b.x, b.y);
    this.ctx.font = 'bold 11px Outfit, sans-serif';
    this.ctx.fillStyle = '#fca5a5';
    this.ctx.fillText('BLOCK EXPLORER', b.x, b.y + 38);
    this.ctx.restore();
  }

  private drawProjectiles(): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fill();
    }
  }

  private drawPlayerWake(): void {
    for (let i = 0; i < this.player.wake.length; i++) {
      const pt = this.player.wake[i];
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, 3 * (i / this.player.wake.length), 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(126, 232, 250, ${0.15 * (i / this.player.wake.length)})`;
      this.ctx.fill();
    }
  }

  private drawCaustics(depth: number): void {
    const { ctx, config } = this;
    ctx.save();
    ctx.globalAlpha = 0.05 + depth * 0.04;
    for (let i = 0; i < 6; i++) {
      const x = (Math.sin(this.tentaclePhase * 0.4 + i) * 0.5 + 0.5) * config.width;
      const y = this.cameraY + (i / 6) * config.height;
      const g = ctx.createRadialGradient(x, y, 10, x, y, 120);
      g.addColorStop(0, '#7ee8fa');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, this.cameraY, config.width, config.height);
    }
    ctx.restore();
  }

  private drawBubbles(): void {
    const { ctx, config } = this;
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + this.animationFrame * 0.5) % config.width;
      const y = this.cameraY + config.height - ((this.animationFrame * 0.7 + i * 35) % (config.height + 50));
      ctx.globalAlpha = 0.12 + (i % 5) * 0.04;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
      ctx.fillStyle = '#7ee8fa';
      ctx.fill();
    }
    ctx.restore();
    this.animationFrame++;
  }

  private drawDangerZone(): void {
    const zoneTop = this.worldHeight - this.config.height * 0.55;
    const pulse = 0.5 + Math.sin(this.tentaclePhase * 2) * 0.15;
    this.ctx.save();
    this.ctx.globalAlpha = 0.08 + pulse * 0.05;
    const g = this.ctx.createLinearGradient(0, zoneTop, 0, this.worldHeight);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, '#ef4444');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, zoneTop, this.config.width, this.worldHeight - zoneTop);
    this.ctx.restore();
  }

  private drawReefZone(progress: number): void {
    const reef = this.reefGoal;
    const pulse = 1 + Math.sin(this.tentaclePhase) * 0.08;
    const bright = 0.35 + progress / 140;
    this.ctx.save();
    this.ctx.globalAlpha = bright;
    const glow = this.ctx.createRadialGradient(reef.x, reef.y, 10, reef.x, reef.y, 100 * pulse);
    glow.addColorStop(0, '#5ce1e6');
    glow.addColorStop(0.5, 'rgba(124, 58, 237, 0.3)');
    glow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(reef.x, reef.y, 100 * pulse, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.font = `${44 * pulse}px serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(reef.emoji, reef.x, reef.y);
    this.ctx.font = 'bold 13px Outfit, sans-serif';
    this.ctx.fillStyle = '#a8fff8';
    this.ctx.fillText('ZAMA REEF', reef.x, reef.y + 40);
    this.ctx.restore();
  }

  private drawPowerUps(): void {
    for (const power of this.powerUps) {
      if (!power.active) continue;
      const bob = Math.sin(this.tentaclePhase + power.id) * 5;
      this.ctx.font = `${power.radius * 1.7}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(power.emoji, power.x, power.y + bob);
    }
  }

  private drawEnemies(now: number, invisible: boolean): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const wobble = Math.sin(enemy.phase) * 4;
      const st = enemy.enemyState;
      if (st?.sonarActive && st.sonarActive > 0 && enemy.kind === 'whale') {
        this.ctx.save();
        this.ctx.globalAlpha = 0.15;
        this.ctx.strokeStyle = '#60a5fa';
        this.ctx.beginPath();
        this.ctx.arc(enemy.x, enemy.y, st.sonarRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
      this.ctx.save();
      this.ctx.translate(enemy.x, enemy.y + wobble);
      if (enemy.vx < 0) this.ctx.scale(-1, 1);
      if (enemy.kind === 'chain' && st) this.ctx.rotate(st.spin);
      this.ctx.font = `${enemy.radius * 1.55}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(enemy.emoji, 0, 0);
      if (enemy.kind === 'shark' && st && st.burstTimer > 0 && !invisible) {
        this.ctx.font = '10px serif';
        this.ctx.fillText('💢', 12, -14);
      }
      this.ctx.restore();
    }
  }

  private drawPlayer(invisible: boolean): void {
    const p = this.player;
    this.ctx.save();
    if (invisible) this.ctx.globalAlpha = 0.4;
    if (performance.now() < p.shieldUntil) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = '#86efac';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.tentaclePhase;
      const len = p.radius + 12 + Math.sin(this.tentaclePhase + i) * 5;
      this.ctx.strokeStyle = invisible ? '#a855f7' : '#c026d3';
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
      this.ctx.stroke();
    }
    this.ctx.font = `${p.radius * 1.65}px serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🐙', p.x, p.y + Math.sin(this.tentaclePhase * 1.5) * 2);
    this.ctx.restore();
  }

  private drawDepthMarkers(): void {
    const step = Math.max(180, Math.floor(this.config.height * 0.45));
    this.ctx.save();
    this.ctx.globalAlpha = 0.12;
    this.ctx.strokeStyle = '#5ce1e6';
    this.ctx.setLineDash([8, 12]);
    for (let y = step; y < this.worldHeight; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(20, y);
      this.ctx.lineTo(this.config.width - 20, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawHudLabels(): void {
    const { ctx, config } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(10, config.height - 40, config.width - 20, 28);
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(this.narrativeZone(), 18, config.height - 21);
  }
}
