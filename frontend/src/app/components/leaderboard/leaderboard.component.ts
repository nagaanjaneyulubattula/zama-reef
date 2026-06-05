import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, ScoreEntry } from '../../services/api.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  scores = signal<ScoreEntry[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    this.api.getLeaderboard(15).subscribe({
      next: ({ scores }) => {
        this.scores.set(scores);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load leaderboard. Is the API running?');
        this.loading.set(false);
      },
    });
  }
}
