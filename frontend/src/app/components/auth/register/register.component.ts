import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.success.set(false);

    if (this.password.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    if (!this.displayName.trim()) {
      this.error.set('Please enter a diver name.');
      return;
    }

    this.loading.set(true);
    const { error } = await this.auth.signUp(
      this.email.trim(),
      this.password,
      this.displayName.trim()
    );
    this.loading.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.success.set(true);
    setTimeout(() => this.router.navigate(['/login']), 2000);
  }
}