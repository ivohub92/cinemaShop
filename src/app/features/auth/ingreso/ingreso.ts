import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-ingreso',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.scss',
})
export class Ingreso {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Avisa al panel que ya puede cerrarse. */
  readonly ingresado = output<void>();

  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      const { email, password } = this.formulario.getRawValue();
      await this.auth.ingresar(email, password);
      this.formulario.reset();
      this.ingresado.emit();
    } catch {
      this.error.set('Correo o contraseña incorrectos.');
    } finally {
      this.enviando.set(false);
    }
  }
}