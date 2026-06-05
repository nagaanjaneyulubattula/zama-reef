import { Injectable, signal } from '@angular/core';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

export interface DifficultyOption {
  id: Difficulty;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export interface DifficultyPreset {
  spawnInterval: number;
  maxEnemies: number;
  whaleChance: number;
  chainChance: number;
  jellyChance: number;
  sharkSpeed: number;
  whaleSpeed: number;
  sharkChase: number;
  whaleChase: number;
  sharkMaxSpeed: number;
  whaleMaxSpeed: number;
  playerSpeed: number;
  powerUpInterval: number;
  scoreMultiplier: number;
  initialEnemies: number;
  burstChance: number;
}

const STORAGE_KEY = 'zre-difficulty';
const DAILY_KEY = 'zre-daily-challenge';
const TUTORIAL_KEY = 'zre-tutorial-done';

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    icon: 'water',
    description: 'Few predators, calm currents',
    color: '#86efac',
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: 'waves',
    description: 'Balanced chase & spawns',
    color: '#5ce1e6',
  },
  {
    id: 'hard',
    label: 'Hard',
    icon: 'thunderstorm',
    description: 'Chains, packs & fast sharks',
    color: '#fbbf24',
  },
  {
    id: 'insane',
    label: 'Insane',
    icon: 'local_fire_department',
    description: 'Predator storm — good luck',
    color: '#f87171',
  },
];

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    spawnInterval: 3.2,
    maxEnemies: 4,
    whaleChance: 0.2,
    chainChance: 0,
    jellyChance: 0.08,
    sharkSpeed: 110,
    whaleSpeed: 70,
    sharkChase: 38,
    whaleChase: 24,
    sharkMaxSpeed: 140,
    whaleMaxSpeed: 95,
    playerSpeed: 245,
    powerUpInterval: 5.5,
    scoreMultiplier: 1,
    initialEnemies: 1,
    burstChance: 0,
  },
  medium: {
    spawnInterval: 2.1,
    maxEnemies: 7,
    whaleChance: 0.32,
    chainChance: 0.12,
    jellyChance: 0.12,
    sharkSpeed: 140,
    whaleSpeed: 90,
    sharkChase: 55,
    whaleChase: 35,
    sharkMaxSpeed: 180,
    whaleMaxSpeed: 120,
    playerSpeed: 220,
    powerUpInterval: 4.5,
    scoreMultiplier: 1.25,
    initialEnemies: 3,
    burstChance: 0.1,
  },
  hard: {
    spawnInterval: 1.35,
    maxEnemies: 11,
    whaleChance: 0.28,
    chainChance: 0.22,
    jellyChance: 0.16,
    sharkSpeed: 165,
    whaleSpeed: 105,
    sharkChase: 72,
    whaleChase: 48,
    sharkMaxSpeed: 215,
    whaleMaxSpeed: 145,
    playerSpeed: 205,
    powerUpInterval: 5.8,
    scoreMultiplier: 1.6,
    initialEnemies: 5,
    burstChance: 0.22,
  },
  insane: {
    spawnInterval: 0.85,
    maxEnemies: 16,
    whaleChance: 0.25,
    chainChance: 0.28,
    jellyChance: 0.2,
    sharkSpeed: 190,
    whaleSpeed: 120,
    sharkChase: 95,
    whaleChase: 62,
    sharkMaxSpeed: 260,
    whaleMaxSpeed: 175,
    playerSpeed: 188,
    powerUpInterval: 6.5,
    scoreMultiplier: 2.25,
    initialEnemies: 7,
    burstChance: 0.35,
  },
};

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard' || value === 'insane';
}

@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  readonly difficulty = signal<Difficulty>('medium');
  readonly dailyChallenge = signal(localStorage.getItem(DAILY_KEY) === '1');

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isDifficulty(saved)) {
      this.difficulty.set(saved);
    }
  }

  setDailyChallenge(on: boolean): void {
    this.dailyChallenge.set(on);
    localStorage.setItem(DAILY_KEY, on ? '1' : '0');
  }

  isTutorialDone(): boolean {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  }

  markTutorialDone(): void {
    localStorage.setItem(TUTORIAL_KEY, '1');
  }

  dailySeed(): number {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  setDifficulty(level: Difficulty): void {
    this.difficulty.set(level);
    localStorage.setItem(STORAGE_KEY, level);
  }

  preset(): DifficultyPreset {
    return DIFFICULTY_PRESETS[this.difficulty()];
  }

  option(): DifficultyOption {
    return DIFFICULTY_OPTIONS.find((o) => o.id === this.difficulty()) ?? DIFFICULTY_OPTIONS[1];
  }
}
