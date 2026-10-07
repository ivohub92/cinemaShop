import { Component, inject, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompraStore } from '../compra/compra.store';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectorFecha } from '../../../shared/forms/selector-fecha/selector-fecha';
import { EMAIL_COMPLETO } from '../../../shared/forms/validadores';


function emailsIguales(grupo: AbstractControl): ValidationErrors | null {
  const email = String(grupo.get('email')?.value ?? '').trim().toLowerCase();
  const repetido = String(grupo.get('emailRepetido')?.value ?? '').trim().toLowerCase();
  return email && repetido && email !== repetido ? { emailsDistintos: true } : null;
}

@Component({
  selector: 'app-paso-identidad',
  imports: [ReactiveFormsModule, SelectorFecha, RouterLink],
  templateUrl: './paso-identidad.html',
  styleUrl: './paso-identidad.scss',
})
export class PasoIdentidad {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly store = inject(CompraStore);

  readonly listo = output<void>();

  readonly modo = signal<'elegir' | 'invitado' | 'ingresar'>('elegir');


  readonly perfil = this.auth.perfil;
  readonly error = signal('');
  readonly enviando = signal(false);


  readonly hoy = new Date().toLocaleDateString('sv-SE');

  readonly formInvitado = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.pattern(EMAIL_COMPLETO)]],
      emailRepetido: ['', Validators.required],
      fechaNacimiento: ['', Validators.required],
    },
    { validators: emailsIguales },
  );

  readonly formIngreso = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_COMPLETO)]],
    password: ['', Validators.required],
  });

  seguirConMiCuenta(): void {
    if (this.store.tomarDeLaSesion()) this.listo.emit();
  }


  async salirParaInvitado(): Promise<void> {
    await this.auth.salir();
    this.modo.set('invitado');
  }

  continuarComoInvitado(): void {
    this.error.set('');

    if (this.formInvitado.invalid) {
      this.formInvitado.markAllAsTouched();
      return;
    }


    if (this.auth.usuario()) {
      this.error.set('Hay una sesión iniciada. Para comprar como invitado, cerrá la sesión primero.');
      return;
    }

    const { email, fechaNacimiento } = this.formInvitado.getRawValue();
    this.store.continuarComoInvitado(email.trim().toLowerCase(), fechaNacimiento);
    this.listo.emit();
  }

  async ingresar(): Promise<void> {
    if (this.formIngreso.invalid) {
      this.formIngreso.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      const { email, password } = this.formIngreso.getRawValue();
      await this.auth.ingresar(email, password);


      const perfil = await this.auth.perfilListo();
      if (perfil) {
        this.store.tomarDeLaSesion();
        this.listo.emit();
      } else {
        this.error.set('No pudimos cargar tu perfil.');
      }
    } catch {
      this.error.set('Correo o contraseña incorrectos.');
    } finally {
      this.enviando.set(false);
    }
  }
}