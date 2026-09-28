import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButacasService } from '../butacas.service';

@Component({
  selector: 'app-paso-pago',
  imports: [DatePipe],
  templateUrl: './paso-pago.html',
  styleUrl: './paso-pago.scss',
})
export class PasoPago implements OnInit {
  private readonly butacasService = inject(ButacasService);

  readonly ordenId = input.required<string>();

  readonly pagado = output<void>();

  readonly orden = signal<any>(null);
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal('');
  readonly restante = signal('');

  private intervalo?: number;

  async ngOnInit(): Promise<void> {
    this.orden.set(await this.butacasService.obtenerOrden(this.ordenId()));
    this.cargando.set(false);
    this.iniciarCuentaRegresiva();
  }

  /** Muestra cuánto falta para que venza la reserva. */
  private iniciarCuentaRegresiva(): void {
    const vence = new Date(this.orden().expira_en).getTime();

    const actualizar = () => {
      const faltan = Math.max(0, vence - Date.now());
      const minutos = Math.floor(faltan / 60000);
      const segundos = Math.floor((faltan % 60000) / 1000);

      this.restante.set(`${minutos}:${String(segundos).padStart(2, '0')}`);

      if (faltan === 0) {
        clearInterval(this.intervalo);
        this.error.set('La reserva venció. Volvé a elegir tus butacas.');
      }
    };

    actualizar();
    this.intervalo = window.setInterval(actualizar, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
  }

  async pagar(): Promise<void> {
    this.pagando.set(true);
    this.error.set('');

    try {
      await this.butacasService.confirmarCompra(this.ordenId());
      clearInterval(this.intervalo);
      this.pagado.emit();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos procesar el pago.');
    } finally {
      this.pagando.set(false);
    }
  }
}