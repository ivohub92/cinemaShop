import { ButacasService } from '../butacas.service';
import { CompraStore } from '../compra/compra.store'; 
import { Butaca } from '../../../core/models/butaca';
import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.scss',
})
export class MapaButacas implements OnInit, OnDestroy{
  private readonly butacasService = inject(ButacasService);
  readonly funcionId = input.required<string>();

  readonly butacas = signal<Butaca[]>([]);
  readonly aviso = signal('');
  private canal?: RealtimeChannel;

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
        this.store.productos(),       // ← nuevo
      );

      this.store.butacas.set(this.seleccionadas());
      this.dejarDeEscuchar();
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
    // Primero se escucha y después se carga: así no se pierde ningún cambio
    // que ocurra mientras llega la carga inicial.
    this.canal = this.butacasService.escucharCambios(this.funcionId(), (id, ocupada) =>
      this.aplicarCambio(id, ocupada),
    );

    this.butacas.set(await this.butacasService.listarPorFuncion(this.funcionId()));
    this.cargando.set(false);
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar();
  }

  private dejarDeEscuchar(): void {
    if (this.canal) {
      this.butacasService.dejarDeEscuchar(this.canal);
      this.canal = undefined;
    }
  }

  /** Aplica en el mapa un cambio que llegó en vivo desde otra compra. */
  private aplicarCambio(butacaId: string, ocupada: boolean): void {
    this.butacas.update((actuales) =>
      actuales.map((b) => (b.id === butacaId ? { ...b, ocupada } : b)),
    );

    // Si alguien tomó una butaca que este usuario tenía elegida, se la quita.
    // Mientras está reservando no se toca: puede ser su propia reserva llegando.
    if (ocupada && !this.reservando() && this.seleccionadas().includes(butacaId)) {
      this.seleccionadas.update((ids) => ids.filter((id) => id !== butacaId));
      this.aviso.set('Una de las butacas que elegiste acaba de ser reservada por otra persona.');
    }
  }

  alternar(butaca: Butaca): void {
    if (butaca.ocupada) return;
    this.aviso.set(''); 

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