import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { CompraResumen, CuentaService } from '../cuenta.service';

/** Se puede cancelar hasta 2 horas antes de la función (RF-33). */
const LIMITE_CANCELACION_MS = 2 * 60 * 60 * 1000;

@Component({
  selector: 'app-mis-compras',
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.scss',
})
export class MisCompras implements OnInit {
  private readonly cuenta = inject(CuentaService);

  /** Dentro de Mi cuenta no repite el título ni el crédito: ya los muestra la página. */
  readonly incrustado = input(false);

  /** Avisa que cambió el saldo (se canceló una compra), para que Mi cuenta lo actualice. */
  readonly cambio = output<void>();

  readonly compras = signal<CompraResumen[]>([]);
  readonly credito = signal(0);
  readonly cargando = signal(true);
  readonly cancelando = signal<string | null>(null);
  readonly quitando = signal<string | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');

  async ngOnInit(): Promise<void> {
    try {
      await this.recargar();
    } catch {
      this.error.set('No pudimos cargar tus compras.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async recargar(): Promise<void> {
    const [compras, credito] = await Promise.all([
      this.cuenta.misCompras(),
      this.cuenta.saldoCredito(),
    ]);
    this.compras.set(compras);
    this.credito.set(credito);
  }

  /**
   * Misma regla que cancelar_compra() en la base, para mostrar u ocultar el botón.
   * La que vale es la del servidor: esta solo evita ofrecer algo que va a fallar.
   */
  sePuedeCancelar(compra: CompraResumen): boolean {
    return (
      compra.estado === 'pagada' &&
      !compra.validadoAccesoEn &&
      !compra.validadoCandyEn &&
      new Date(compra.inicio).getTime() - Date.now() >= LIMITE_CANCELACION_MS
    );
  }

  /** Por qué no se puede cancelar una compra pagada, para explicarlo en pantalla. */
  motivoSinCancelacion(compra: CompraResumen): string {
    if (compra.validadoAccesoEn || compra.validadoCandyEn) return 'Ya utilizada';
    if (new Date(compra.inicio).getTime() < Date.now()) return 'Función finalizada';
    return 'Faltan menos de 2 horas para la función';
  }

  async cancelar(compra: CompraResumen): Promise<void> {
    const ok = confirm(
      `¿Cancelar la compra de "${compra.pelicula}"? No se devuelve dinero: ` +
        `se acreditan $ ${compra.total.toLocaleString('es-AR')} en tu cuenta.`,
    );
    if (!ok) return;

    this.cancelando.set(compra.id);
    this.error.set('');
    this.aviso.set('');

    try {
      const acreditado = await this.cuenta.cancelar(compra.id);
      this.aviso.set(`Compra cancelada. Se acreditaron $ ${acreditado.toLocaleString('es-AR')} en tu cuenta.`);
      await this.recargar();
      this.cambio.emit();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos cancelar la compra.');
    } finally {
      this.cancelando.set(null);
    }
  }

  async quitar(compra: CompraResumen): Promise<void> {
    this.quitando.set(compra.id);
    this.error.set('');
    this.aviso.set('');

    try {
      await this.cuenta.quitarDelListado(compra.id);

      this.compras.update((actuales) => actuales.filter((c) => c.id !== compra.id));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos quitar la compra del listado.');
    } finally {
      this.quitando.set(null);
    }
  }
}
