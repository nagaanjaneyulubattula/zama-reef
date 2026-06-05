import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ScoreEntry {
  id?: string;
  playerName: string;
  score: number;
  timeSeconds: number;
  pearlsCollected: number;
  won: boolean;
  createdAt?: string;
}

export interface GameStats {
  totalGames: number;
  totalWins: number;
  topScore: number;
  topPlayer: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getLeaderboard(limit = 10): Observable<{ scores: ScoreEntry[] }> {
    return this.http.get<{ scores: ScoreEntry[] }>(`${this.baseUrl}/scores?limit=${limit}`);
  }

  submitScore(entry: Omit<ScoreEntry, 'id' | 'createdAt' | 'playerName'>): Observable<{ entry: ScoreEntry }> {
    return this.http.post<{ entry: ScoreEntry }>(`${this.baseUrl}/scores`, entry);
  }

  getStats(): Observable<GameStats> {
    return this.http.get<GameStats>(`${this.baseUrl}/scores/stats`);
  }

  getMyScores(): Observable<{ scores: ScoreEntry[] }> {
    return this.http.get<{ scores: ScoreEntry[] }>(`${this.baseUrl}/scores/me`);
  }

  healthCheck(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.baseUrl}/health`);
  }
}