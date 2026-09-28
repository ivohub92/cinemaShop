import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ValidacionService } from '../validacion.service';

@Component({
  selector: 'app-validar-entrada',
  imports: [FormsModule, DatePipe],
  templateUrl: './validar-entrada.html',
  styleUrl: './validar-entrada.scss',
})
export class ValidarEntrada {
  private readonly validacion = inject(ValidacionService);

  readonly codigo = signal('');
  readonly orden = signal<any>(null);
  readonly buscando = signal(false);
  readonly validando = signal(false);
  readonly error = signal('');
  readonly exito = signal(false);

  async consultar(): Promise<void> {
    const codigo = this.codigo().trim();
    if (!codigo) return;

    this.buscando.set(true);
    this.error.set('');
    this.exito.set(false);
    this.orden.set(null);

    try {
      this.orden.set(await this.validacion.consultar(codigo));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos consultar el código.');
    } finally {
      this.buscando.set(false);
    }
  }

  async validar(): Promise<void> {
    this.validando.set(true);
    this.error.set('');

    try {
      await this.validacion.validarAcceso(this.codigo().trim());
      this.exito.set(true);
      this.orden.set(null);
      this.codigo.set('');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos validar la entrada.');
    } finally {
      this.validando.set(false);
    }
  }

  limpiar(): void {
    this.codigo.set('');
    this.orden.set(null);
    this.error.set('');
    this.exito.set(false);
  }
}