import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { EMAIL_COMPLETO } from '../../../shared/forms/validadores';

@Component({
  selector: 'app-ingreso',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.scss',
})
export class Ingreso {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);


  readonly ingresado = output<void>();

  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_COMPLETO)]],
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
      const perfil = await this.auth.ingresar(email, password);
      this.formulario.reset();
      this.ingresado.emit();

      // El personal va directo a su pantalla; el cliente sigue donde estaba.
      if (perfil && perfil.rol !== 'cliente') {
        this.router.navigateByUrl(this.auth.inicioDe(perfil.rol));
      }
    } catch {
      this.error.set('Correo o contraseña incorrectos.');
    } finally {
      this.enviando.set(false);
    }
  }
}