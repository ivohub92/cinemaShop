import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompraStore } from '../compra/compra.store';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectorFecha } from '../../../shared/forms/selector-fecha/selector-fecha';

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

  readonly formInvitado = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    fechaNacimiento: ['', Validators.required],
  });

  readonly formIngreso = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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
    if (this.formInvitado.invalid) {
      this.formInvitado.markAllAsTouched();
      return;
    }

    const { email, fechaNacimiento } = this.formInvitado.getRawValue();
    this.store.continuarComoInvitado(email, fechaNacimiento);
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