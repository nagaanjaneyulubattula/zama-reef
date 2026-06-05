import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GameEngine, GameSnapshot } from '../../services/game-engine.service';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { GameAudioService } from '../../services/game-audio.service';
import { SfxEvent } from '../../services/game-types';
import { DIFFICULTY_OPTIONS, GameSettingsService } from '../../services/game-settings.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(GameSettingsService);
  private readonly audio = inject(GameAudioService);
  private readonly engine = new GameEngine();
  private scoreSubmitted = false;
  private lastSwimTick = 0;

  readonly Math = Math;
  readonly playerName = this.auth.displayName();
  readonly difficultyOption = this.settings.option();

  snapshot = signal<GameSnapshot>({
    status: 'idle',
    score: 0,
    timeSeconds: 0,
    pearlsCollected: 0,
    invisibleSecondsLeft: 0,
    distanceToReef: 0,
    journeyProgress: 0,
    message: '',
    difficulty: this.settings.difficulty(),
    enemyCount: 0,
    loseIcon: '🦈',
    countdownSeconds: 0,
    comboMultiplier: 1,
    nearMissBonus: 0,
    upwardStreak: 0,
    checkpointsPassed: 0,
    narrativeZone: '',
    bossActive: false,
    bossHealth: 0,
    bossMaxHealth: 100,
    bossTimeLeft: 0,
    shieldSecondsLeft: 0,
    speedBoostSecondsLeft: 0,
    dailyChallenge: false,
    showTutorial: false,
    tutorialHint: '',
    screenShake: 0,
    flashAlpha: 0,
    radarBlips: [],
    reefBrightness: 0.35,
    decoyActive: false,
  });

  ngAfterViewInit(): void {
    this.bootEngine();
  }

  ngOnDestroy(): void {
    this.engine.destroy();
  }

  pauseGame(): void {
    this.engine.pause();
  }

  resumeGame(): void {
    this.engine.resume();
  }

  restart(): void {
    this.scoreSubmitted = false;
    this.engine.destroy();
    this.bootEngine();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  dismissTutorial(): void {
    this.settings.markTutorialDone();
  }

  private bootEngine(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = Math.min(640, window.innerWidth - 24);
    const height = Math.min(720, window.innerHeight - 200);
    const showTutorial = !this.settings.isTutorialDone();

    this.engine.init(
      canvas,
      {
        width,
        height,
        playerName: this.playerName,
        difficulty: this.settings.difficulty(),
        preset: this.settings.preset(),
        dailyChallenge: this.settings.dailyChallenge(),
        dailySeed: this.settings.dailySeed(),
        showTutorial,
        onSfx: (e: SfxEvent) => this.audio.play(e),
      },
      (s) => {
        this.snapshot.set(s);
        const now = performance.now();
        if (s.status === 'playing' && now - this.lastSwimTick > 400) {
          this.lastSwimTick = now;
        }
        if ((s.status === 'won' || s.status === 'lost') && !this.scoreSubmitted) {
          this.scoreSubmitted = true;
          if (showTutorial) this.settings.markTutorialDone();
          this.submitScore(s);
        }
      }
    );

    this.engine.start();
  }

  private submitScore(s: GameSnapshot): void {
    this.api
      .submitScore({
        score: s.score,
        timeSeconds: s.timeSeconds,
        pearlsCollected: s.pearlsCollected,
        won: s.status === 'won',
      })
      .subscribe({ error: () => undefined });
  }

  difficultyLabel(): string {
    return DIFFICULTY_OPTIONS.find((d) => d.id === this.settings.difficulty())?.label ?? 'Medium';
  }
}
