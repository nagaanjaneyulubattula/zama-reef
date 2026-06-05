import { Injectable, signal, computed } from '@angular/core';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly userSignal = signal<User | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.sessionSignal() !== null);

  readonly displayName = computed(() => {
    const user = this.userSignal();
    if (!user) return '';
    return (user.user_metadata?.['display_name'] as string) || user.email?.split('@')[0] || 'Octopus';
  });

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    this.init();
  }

  private async init(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.sessionSignal.set(data.session);
    this.userSignal.set(data.session?.user ?? null);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.sessionSignal.set(session);
      this.userSignal.set(session?.user ?? null);
    });
  }

  getAccessToken(): string | null {
    return this.sessionSignal()?.access_token ?? null;
  }

  async signUp(email: string, password: string, displayName: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim().slice(0, 24) } },
    });
    return { error: error?.message ?? null };
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}