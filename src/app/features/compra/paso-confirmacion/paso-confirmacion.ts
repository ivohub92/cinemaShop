import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButacasService } from '../butacas.service';
import { ComprobanteService } from '../../../core/services/comprobante.service';

@Component({
  selector: 'app-paso-confirmacion',
  imports: [DatePipe, RouterLink],
  templateUrl: './paso-confirmacion.html',
  styleUrl: './paso-confirmacion.scss',
})
export class PasoConfirmacion implements OnInit {
  private readonly butacasService = inject(ButacasService);
  private readonly comprobante = inject(ComprobanteService);

  readonly ordenId = input.required<string>();

  readonly orden = signal<any>(null);
  readonly qr = signal('');
  readonly cargando = signal(true);

  async ngOnInit(): Promise<void> {
    const orden = await this.butacasService.obtenerOrden(this.ordenId());
    this.orden.set(orden);
    this.qr.set(await this.comprobante.generarQr(orden.codigo_qr));
    this.cargando.set(false);
  }

  descargar(): void {
    this.comprobante.descargarPdf(this.orden());
  }
}