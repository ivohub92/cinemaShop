import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectorFecha } from '../../../shared/forms/selector-fecha/selector-fecha';
import { ToastService } from '../../../shared/ui/toasts/toast.service';
import { EMAIL_COMPLETO } from '../../../shared/forms/validadores';

const EDAD_MINIMA = 13;
const EDAD_MAXIMA = 120;


function edadDe(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  const hoy = new Date();
  const cumplio = hoy.getMonth() + 1 > m || (hoy.getMonth() + 1 === m && hoy.getDate() >= d);
  return hoy.getFullYear() - a - (cumplio ? 0 : 1);
}


function edadValida(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const edad = edadDe(control.value);
  if (edad < EDAD_MINIMA) return { edadMinima: true };
  if (edad > EDAD_MAXIMA) return { edadMaxima: true };
  return null;
}

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
  private readonly toast = inject(ToastService);


  readonly hoy = new Date().toLocaleDateString('sv-SE');

  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL_COMPLETO)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    fechaNacimiento: ['', [Validators.required, edadValida]],
    tipoSangre: ['', Validators.required],
    colorOjos: ['', Validators.required],
    diasVacaciones: [0, [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)]],
  });

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
  readonly coloresOjos = ['Marrones', 'Negros', 'Verdes', 'Azules', 'Grises', 'Miel'];

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errores().forEach((mensaje) => this.toast.error(mensaje));
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      await this.auth.registrar(this.formulario.getRawValue());
      this.router.navigate(['/cartelera']);
    } catch (e: any) {

      const mensaje = e?.message?.includes('Database error')
        ? 'No pudimos crear tu cuenta: revisá la fecha de nacimiento y los días de vacaciones.'
        : (e?.message ?? 'No pudimos crear tu cuenta. Probá de nuevo.');
      this.error.set(mensaje);
      this.toast.error(mensaje);
    } finally {
      this.enviando.set(false);
    }
  }


  errores(): string[] {
    const c = this.formulario.controls;
    const mensajes: string[] = [];

    if (c.fechaNacimiento.hasError('required')) mensajes.push('Elegí tu fecha de nacimiento.');
    if (c.fechaNacimiento.hasError('edadMinima')) mensajes.push(`Tenés que tener al menos ${EDAD_MINIMA} años para registrarte.`);
    if (c.fechaNacimiento.hasError('edadMaxima')) mensajes.push(`La fecha de nacimiento no es válida: más de ${EDAD_MAXIMA} años.`);
    if (c.diasVacaciones.invalid) mensajes.push('Los días de vacaciones tienen que ser un número entero entre 0 y 365.');

    const otros = (['nombre', 'apellido', 'email', 'password', 'tipoSangre', 'colorOjos'] as const)
      .some((campo) => c[campo].invalid);
    if (otros) mensajes.push('Revisá los campos marcados.');

    return mensajes;
  }


  soloEnteros(evento: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.', ','].includes(evento.key)) evento.preventDefault();
  }
}
