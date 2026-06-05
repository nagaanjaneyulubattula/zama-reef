import { Difficulty, DifficultyPreset } from './game-settings.service';

export type GameStatus = 'idle' | 'countdown' | 'playing' | 'paused' | 'boss' | 'won' | 'lost';
export type EnemyKind = 'shark' | 'whale' | 'chain' | 'jellyfish';
export type PowerKind = 'pearl' | 'pearl-mega' | 'speed-current' | 'decoy' | 'reef-power';
export type SfxEvent =
  | 'countdown'
  | 'go'
  | 'pearl'
  | 'mega'
  | 'speed'
  | 'teleport'
  | 'decoy'
  | 'nearmiss'
  | 'checkpoint'
  | 'hit'
  | 'win'
  | 'boss'
  | 'swim';

export interface RadarBlip {
  x: number;
  y: number;
  kind: EnemyKind | 'boss' | 'bolt';
}

export interface GameSnapshot {
  status: GameStatus;
  score: number;
  timeSeconds: number;
  pearlsCollected: number;
  invisibleSecondsLeft: number;
  distanceToReef: number;
  journeyProgress: number;
  message: string;
  difficulty: Difficulty;
  enemyCount: number;
  loseIcon: string;
  countdownSeconds: number;
  comboMultiplier: number;
  nearMissBonus: number;
  upwardStreak: number;
  checkpointsPassed: number;
  narrativeZone: string;
  bossActive: boolean;
  bossHealth: number;
  bossMaxHealth: number;
  bossTimeLeft: number;
  shieldSecondsLeft: number;
  speedBoostSecondsLeft: number;
  dailyChallenge: boolean;
  showTutorial: boolean;
  tutorialHint: string;
  screenShake: number;
  flashAlpha: number;
  radarBlips: RadarBlip[];
  reefBrightness: number;
  decoyActive: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface EnemyState {
  burstCd: number;
  burstTimer: number;
  sonarCd: number;
  sonarActive: number;
  sonarRadius: number;
  poisonTrail: Vec2[];
  spin: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: EnemyKind | PowerKind | 'reef-goal' | 'checkpoint';
  emoji: string;
  active: boolean;
  phase: number;
  trail: Vec2[];
  enemyState?: EnemyState;
  checkpointId?: number;
}

export interface Decoy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  until: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

export interface BossState {
  x: number;
  y: number;
  health: number;
  timeLeft: number;
  projectileCd: number;
  active: boolean;
  defeated: boolean;
}

export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number;
  baseSpeed: number;
  invisibleUntil: number;
  shieldUntil: number;
  speedBoostUntil: number;
  slowUntil: number;
  wake: Vec2[];
}

export interface GameConfig {
  width: number;
  height: number;
  playerName: string;
  difficulty: Difficulty;
  preset: DifficultyPreset;
  dailyChallenge: boolean;
  dailySeed: number;
  showTutorial: boolean;
  onSfx?: (event: SfxEvent) => void;
}

export class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed % 2147483647 || 1;
  }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

export const WORLD_HEIGHT_SCALE = 3.4;
export const PIXELS_PER_METER = 2.2;
export const BOSS_MAX_HEALTH = 100;
export const BOSS_DURATION = 15;

export const LOSE_ICONS: Record<EnemyKind, string> = {
  shark: '🦈',
  whale: '🐋',
  chain: '⛓️',
  jellyfish: '🪼',
};

export const NARRATIVE_ZONES: { max: number; text: string }[] = [
  { max: 15, text: '🌊 Surface mempool — fully exposed' },
  { max: 35, text: '🔗 Public chain currents ahead' },
  { max: 55, text: '📡 Validator waters — hunters patrol' },
  { max: 75, text: '🔒 Encryption layer approaching' },
  { max: 85, text: '⚠️ MEV zone — extreme danger' },
  { max: 100, text: '🪸 Zama Reef in range' },
];

export const TUTORIAL_HINTS = [
  '⬆️ Swim UP toward the Zama Reef',
  '🔮 FHE Pearl = 5s invisibility',
  '💎 Mega Pearl = 10s stealth',
  '⚡ Speed Current = burst upward',
  '🎭 Decoy distracts sharks',
  '🏝️ Privacy Reef = safe teleport',
  '🛡️ Green gates = checkpoint shields',
];
