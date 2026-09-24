import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectorFecha } from '../../../shared/forms/selector-fecha/selector-fecha';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, SelectorFecha],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    fechaNacimiento: ['', Validators.required],
    tipoSangre: ['', Validators.required],
    colorOjos: ['', Validators.required],
    diasVacaciones: [0, [Validators.required, Validators.min(0), Validators.max(365)]],
  });

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
  readonly coloresOjos = ['Marrones', 'Negros', 'Verdes', 'Azules', 'Grises', 'Miel'];

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      // Marca todos los campos como tocados para que se vean los errores.
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      await this.auth.registrar(this.formulario.getRawValue());
      this.router.navigate(['/cartelera']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos crear tu cuenta. Probá de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }
}