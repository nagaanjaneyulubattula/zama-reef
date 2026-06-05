import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    const { error } = await this.auth.signIn(this.email.trim(), this.password);
    this.loading.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    this.router.navigateByUrl(returnUrl);
  }
}