import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ReportesService } from '../reportes.service';
import { ExportarReportesService } from '../exportar-reportes.service';
import { ProductoVendido, ReporteCombos, ReporteFacturacion } from '../../../../core/models/reporte';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';
import { GraficoMasVistas } from '../grafico-mas-vistas/grafico-mas-vistas';

function fechaLocal(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

@Component({
  selector: 'app-panel-reportes',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, SelectorFecha, GraficoMasVistas],
  templateUrl: './panel-reportes.html',
  styleUrl: './panel-reportes.scss',
})
export class PanelReportes implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reportes = inject(ReportesService);
  private readonly exportador = inject(ExportarReportesService);

  readonly reporte = signal<ReporteFacturacion | null>(null);
  readonly productos = signal<ProductoVendido[]>([]);
  readonly errorProductos = signal('');
  readonly combos = signal<ReporteCombos | null>(null);
  readonly errorCombos = signal('');
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mostrarDiasSinVentas = signal(false);
  readonly exportando = signal(false);


  private periodo = { desde: '', hasta: '' };


  readonly filtro = this.fb.nonNullable.group({
    desde: [fechaLocal(new Date(Date.now() - 29 * 864e5))],
    hasta: [fechaLocal(new Date())],
  });

  readonly totales = computed(() => {
    const dias = this.reporte()?.dias ?? [];
    const suma = (campo: 'ordenes' | 'entradas' | 'facturacion' | 'credito' | 'descuentos') =>
      dias.reduce((total, d) => total + d[campo], 0);

    const ordenes = suma('ordenes');
    const facturacion = suma('facturacion');

    return {
      ordenes,
      entradas: suma('entradas'),
      facturacion,
      credito: suma('credito'),
      descuentos: suma('descuentos'),
      ticketPromedio: ordenes ? facturacion / ordenes : 0,
    };
  });


  readonly candy = computed(() => {
    const r = this.combos();
    const combos = r?.combos.reduce((total, c) => total + c.parteCandy, 0) ?? 0;
    const suelto = r?.totalSuelto ?? 0;
    return { suelto, combos, total: suelto + combos };
  });

  readonly diasVisibles = computed(() => {
    const dias = this.reporte()?.dias ?? [];
    return this.mostrarDiasSinVentas() ? dias : dias.filter((d) => d.ordenes > 0);
  });

  async ngOnInit(): Promise<void> {
    await this.consultar();
  }

  async consultar(): Promise<void> {
    const { desde, hasta } = this.filtro.getRawValue();

    if (!desde || !hasta) {
      this.error.set('Elegí las dos fechas.');
      return;
    }

    if (desde > hasta) {
      this.error.set('La fecha "desde" tiene que ser anterior a "hasta".');
      return;
    }

    this.cargando.set(true);
    this.error.set('');


    const [facturacion, productos, combos] = await Promise.allSettled([
      this.reportes.facturacion(desde, hasta),
      this.reportes.productos(desde, hasta, 5),
      this.reportes.combos(desde, hasta),
    ]);

    try {
      if (facturacion.status === 'fulfilled') {
        this.reporte.set(facturacion.value);
        this.periodo = { desde, hasta };
      } else {
        this.error.set(facturacion.reason?.message ?? 'No pudimos generar el reporte.');
      }

      if (productos.status === 'fulfilled') {
        this.productos.set(productos.value);
        this.errorProductos.set('');
      } else {
        this.productos.set([]);
        this.errorProductos.set(productos.reason?.message ?? 'No pudimos cargar los productos.');
      }

      if (combos.status === 'fulfilled') {
        this.combos.set(combos.value);
        this.errorCombos.set('');
      } else {
        this.combos.set(null);
        this.errorCombos.set(combos.reason?.message ?? 'No pudimos cargar los combos.');
      }
    } finally {
      this.cargando.set(false);
    }
  }


  exportarPdf(): void {
    const reporte = this.reporte();
    if (!reporte) return;
    this.exportador.exportarPdf(this.diasVisibles(), this.totales(), reporte, this.periodo.desde, this.periodo.hasta);
  }

  async exportarExcel(): Promise<void> {
    const reporte = this.reporte();
    if (!reporte) return;

    this.exportando.set(true);
    this.error.set('');

    try {
      await this.exportador.exportarExcel(
        this.diasVisibles(),
        this.totales(),
        reporte,
        this.periodo.desde,
        this.periodo.hasta,
      );
    } catch {
      this.error.set('No pudimos generar el Excel.');
    } finally {
      this.exportando.set(false);
    }
  }
}
