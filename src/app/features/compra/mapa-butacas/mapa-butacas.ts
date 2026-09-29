import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { ButacasService } from '../butacas.service';
import { CompraStore } from '../compra/compra.store'; 
import { Butaca } from '../../../core/models/butaca';

@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.scss',
})
export class MapaButacas implements OnInit {
  private readonly butacasService = inject(ButacasService);
  readonly funcionId = input.required<string>();
  readonly butacas = signal<Butaca[]>([]);
  readonly seleccionadas = signal<string[]>([]);
  readonly cargando = signal(true);
  private readonly store = inject(CompraStore);
  readonly reservado = output<string>();

  readonly reservando = signal(false);
  readonly error = signal('');

  readonly total = computed(() =>
    this.butacas()
      .filter((b) => this.seleccionadas().includes(b.id))
      .reduce((suma, b) => suma + (b.tipo === 'vip' ? 8000 : 6500), 0),
  );

  async continuar(): Promise<void> {
    const comprador = this.store.comprador();
    if (!comprador || !this.seleccionadas().length) return;

    this.reservando.set(true);
    this.error.set('');

    try {
      const ordenId = await this.butacasService.reservar(
        this.funcionId(),
        this.seleccionadas(),
        comprador.email,
        comprador.fechaNacimiento,
      );

      this.store.butacas.set(this.seleccionadas());
      this.reservado.emit(ordenId);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos reservar las butacas.');
      
      this.butacas.set(await this.butacasService.listarPorFuncion(this.funcionId()));
      this.seleccionadas.set([]);
    } finally {
      this.reservando.set(false);
    }
  }

  readonly filas = computed(() => {
    const grupos = new Map<string, Butaca[]>();

    for (const butaca of this.butacas()) {
      grupos.set(butaca.fila, [...(grupos.get(butaca.fila) ?? []), butaca]);
    }

    return [...grupos.entries()].map(([fila, butacas]) => ({
      fila,
      columnas: [1, 2, 3].map((columna) => butacas.filter((b) => b.columna === columna)),
    }));
  });

  readonly resumen = computed(() =>
    this.butacas()
      .filter((b) => this.seleccionadas().includes(b.id))
      .map((b) => `${b.fila}${b.numero}`)
      .join(', '),
  );

  async ngOnInit(): Promise<void> {
    this.butacas.set(await this.butacasService.listarPorFuncion(this.funcionId()));
    this.cargando.set(false);
  }

  alternar(butaca: Butaca): void {
    if (butaca.ocupada) return;

    this.seleccionadas.update((actuales) =>
      actuales.includes(butaca.id)
        ? actuales.filter((id) => id !== butaca.id)
        : [...actuales, butaca.id],
    );
  }

  estaSeleccionada(butaca: Butaca): boolean {
    return this.seleccionadas().includes(butaca.id);
  }
}