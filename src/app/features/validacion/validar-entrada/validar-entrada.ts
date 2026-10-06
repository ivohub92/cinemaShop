import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ValidacionService } from '../validacion.service';
import { EscanerQr } from '../escaner-qr/escaner-qr';


interface ItemOrden {
  nombre: string;
  cantidad: number;
  combo: string | null;
}

@Component({
  selector: 'app-validar-entrada',
  imports: [FormsModule, DatePipe, EscanerQr],
  templateUrl: './validar-entrada.html',
  styleUrl: './validar-entrada.scss',
})
export class ValidarEntrada {
  private readonly validacion = inject(ValidacionService);

  readonly codigo = signal('');
  readonly orden = signal<any>(null);
  readonly buscando = signal(false);
  readonly validando = signal(false);
  readonly entregando = signal(false);
  readonly error = signal('');
  readonly exito = signal('');


  readonly candy = computed(() => {
    const items: ItemOrden[] = this.orden()?.productos ?? [];
    const nombresCombos = [...new Set(items.filter((i) => i.combo).map((i) => i.combo as string))];

    return {
      combos: nombresCombos.map((nombre) => ({
        nombre,
        items: items.filter((i) => i.combo === nombre),
      })),
      sueltos: items.filter((i) => !i.combo),
    };
  });

  readonly tieneCandy = computed(() => (this.orden()?.productos ?? []).length > 0);

  async consultar(): Promise<void> {
    const codigo = this.codigo().trim();
    if (!codigo) return;

    this.buscando.set(true);
    this.error.set('');
    this.exito.set('');
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
    this.exito.set('');

    try {
      await this.validacion.validarAcceso(this.codigo().trim());
      this.exito.set('Entrada validada. Puede pasar a la sala.');
      await this.refrescar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos validar la entrada.');
    } finally {
      this.validando.set(false);
    }
  }

  async entregarCandy(): Promise<void> {
    this.entregando.set(true);
    this.error.set('');
    this.exito.set('');

    try {
      await this.validacion.entregarCandy(this.codigo().trim());
      this.exito.set('Candy entregado.');
      await this.refrescar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos registrar la entrega.');
    } finally {
      this.entregando.set(false);
    }
  }

 
  private async refrescar(): Promise<void> {
    this.orden.set(await this.validacion.consultar(this.codigo().trim()));
  }

  async alLeerQr(codigo: string): Promise<void> {
    this.codigo.set(codigo);
    await this.consultar();
  }

  limpiar(): void {
    this.codigo.set('');
    this.orden.set(null);
    this.error.set('');
    this.exito.set('');
  }
}
