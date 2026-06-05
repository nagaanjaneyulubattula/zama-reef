import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, GameStats } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  DIFFICULTY_OPTIONS,
  Difficulty,
  GameSettingsService,
} from '../../services/game-settings.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly settings = inject(GameSettingsService);

  readonly difficulties = DIFFICULTY_OPTIONS;

  stats = signal<GameStats | null>(null);
  apiOnline = signal(true);

  ngOnInit(): void {
    this.api.getStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.apiOnline.set(false),
    });
  }

  selectDifficulty(level: Difficulty): void {
    this.settings.setDifficulty(level);
  }

  toggleDaily(): void {
    this.settings.setDailyChallenge(!this.settings.dailyChallenge());
  }

  startGame(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/play' } });
      return;
    }
    this.router.navigate(['/play']);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
