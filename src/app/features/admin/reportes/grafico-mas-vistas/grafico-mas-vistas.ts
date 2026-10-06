import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReportesService } from '../reportes.service';
import { PeliculaMasVista } from '../../../../core/models/reporte';

type Agrupacion = 'semana' | 'mes';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function iso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}


@Component({
  selector: 'app-grafico-mas-vistas',
  templateUrl: './grafico-mas-vistas.html',
  styleUrl: './grafico-mas-vistas.scss',
})
export class GraficoMasVistas implements OnInit {
  private readonly reportes = inject(ReportesService);

  readonly agrupacion = signal<Agrupacion>('semana');
  readonly desplazamiento = signal(0);
  readonly peliculas = signal<PeliculaMasVista[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');


  readonly rango = computed(() => {
    const hoy = new Date();

    if (this.agrupacion() === 'semana') {
      const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
      lunes.setDate(lunes.getDate() + this.desplazamiento() * 7);
      const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
      return {
        desde: iso(lunes),
        hasta: iso(domingo),
        etiqueta: `Semana del ${lunes.getDate()}/${lunes.getMonth() + 1} al ${domingo.getDate()}/${domingo.getMonth() + 1}`,
      };
    }

    const primero = new Date(hoy.getFullYear(), hoy.getMonth() + this.desplazamiento(), 1);
    const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0);
    return {
      desde: iso(primero),
      hasta: iso(ultimo),
      etiqueta: `${MESES.at(primero.getMonth())} ${primero.getFullYear()}`,
    };
  });


  readonly maximo = computed(() => Math.max(1, ...this.peliculas().map((p) => p.entradas)));

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cambiarAgrupacion(agrupacion: Agrupacion): Promise<void> {
    if (agrupacion === this.agrupacion()) return;
    this.agrupacion.set(agrupacion);
    this.desplazamiento.set(0);
    await this.cargar();
  }

  async mover(delta: number): Promise<void> {
    this.desplazamiento.update((d) => Math.min(0, d + delta));
    await this.cargar();
  }

  porcentaje(entradas: number): number {
    return (entradas / this.maximo()) * 100;
  }

  private async cargar(): Promise<void> {
    const { desde, hasta } = this.rango();
    this.cargando.set(true);
    this.error.set('');

    try {
      this.peliculas.set(await this.reportes.masVistas(desde, hasta, 5));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos cargar el gráfico.');
      this.peliculas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}
