import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ButacasService } from '../butacas.service';
import { ComprobanteService } from '../../../core/services/comprobante.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CuentaService } from '../../cuenta/cuenta.service';
import { CuponesService } from '../../../core/services/cupones.service';
import { Cupon } from '../../../core/models/cupon';
import { PuntosService } from '../../../core/services/puntos.service';
import { Recompensa } from '../../../core/models/recompensa';
import { CompraStore } from '../compra/compra.store';

@Component({
  selector: 'app-paso-pago',
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './paso-pago.html',
  styleUrl: './paso-pago.scss',
})
export class PasoPago implements OnInit {
  private readonly butacasService = inject(ButacasService);
  private readonly comprobante = inject(ComprobanteService);
  private readonly auth = inject(AuthService);
  private readonly cuenta = inject(CuentaService);
  private readonly cuponesService = inject(CuponesService);
  private readonly puntosService = inject(PuntosService);
  private readonly store = inject(CompraStore);

  readonly ordenId = input.required<string>();

  readonly pagado = output<void>();

  readonly orden = signal<any>(null);
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal('');
  readonly restante = signal('');


  readonly conCuenta = signal(false);

  readonly errorBeneficios = signal(false);

  readonly candy = computed(() => this.comprobante.resumirCandy(this.orden()));


  readonly cupones = signal<Cupon[]>([]);
  readonly cuponId = signal<string | null>(null);


  readonly credito = signal(0);
  readonly usarCredito = signal(false);

  readonly total = computed(() => Number(this.orden()?.total ?? 0));

  readonly cuponElegido = computed(() => this.cupones().find((c) => c.id === this.cuponId()) ?? null);


  readonly puntos = signal(0);
  readonly recompensas = signal<Recompensa[]>([]);
  readonly canjes = signal<Record<string, number>>({});


  private readonly preciosEntradas = computed<number[]>(() =>
    (this.orden()?.butacas ?? [])
      .filter((b: any) => !b.combo)
      .map((b: any) => Number(b.precio))
      .sort((a: number, b: number) => b - a),
  );

  private readonly productosSueltos = computed(() => {
    const mapa = new Map<string, { cantidad: number; precio: number }>();
    for (const p of this.orden()?.productos ?? []) {
      if (!p.combo) mapa.set(p.producto_id, { cantidad: p.cantidad, precio: Number(p.precio) });
    }
    return mapa;
  });


  readonly recompensasAplicables = computed(() =>
    this.recompensas().filter((r) =>
      r.tipo === 'entrada' ? this.preciosEntradas().length > 0 : this.productosSueltos().has(r.productoId!),
    ),
  );

  aplica(recompensa: Recompensa): boolean {
    return this.recompensasAplicables().includes(recompensa);
  }


  motivoNoAplica(recompensa: Recompensa): string {
    if (recompensa.tipo === 'entrada') {
      return 'Tus entradas tienen combo: no se pueden cubrir con puntos.';
    }
    return `Agregá "${recompensa.productoNombre}" en el candy para canjearlo.`;
  }

  cantidadCanje(recompensa: Recompensa): number {
    return this.canjes()[recompensa.id] ?? 0;
  }

  readonly puntosAUsar = computed(() =>
    this.recompensas().reduce((suma, r) => suma + r.costoPuntos * this.cantidadCanje(r), 0),
  );

  private readonly cubiertos = computed(() => {
    let entradas = 0;
    const productos = new Map<string, number>();
    for (const r of this.recompensas()) {
      const n = this.cantidadCanje(r);
      if (!n) continue;
      if (r.tipo === 'entrada') entradas += n;
      else productos.set(r.productoId!, (productos.get(r.productoId!) ?? 0) + n);
    }
    return { entradas, productos };
  });


  puedeSumarCanje(recompensa: Recompensa): boolean {
    if (this.puntosAUsar() + recompensa.costoPuntos > this.puntos()) return false;
    if (recompensa.tipo === 'entrada') return this.cubiertos().entradas < this.preciosEntradas().length;
    const disponible = this.productosSueltos().get(recompensa.productoId!)?.cantidad ?? 0;
    return (this.cubiertos().productos.get(recompensa.productoId!) ?? 0) < disponible;
  }

  cambiarCanje(recompensa: Recompensa, delta: number): void {
    if (delta > 0 && !this.puedeSumarCanje(recompensa)) return;
    this.canjes.update((actuales) => {
      const cantidad = Math.max(0, (actuales[recompensa.id] ?? 0) + delta);
      const copia = { ...actuales };
      if (cantidad) copia[recompensa.id] = cantidad;
      else delete copia[recompensa.id];
      return copia;
    });
  }


  readonly descuento = computed(() => {
    const cupon = this.cuponElegido();
    return cupon ? Math.round(this.total() * cupon.porcentaje) / 100 : 0;
  });


  readonly descuentoPuntos = computed(() => {
    const { entradas, productos } = this.cubiertos();
    let valor = this.preciosEntradas().slice(0, entradas).reduce((a, b) => a + b, 0);
    for (const [id, n] of productos) valor += (this.productosSueltos().get(id)?.precio ?? 0) * n;
    return Math.min(valor, this.total() - this.descuento());
  });

  readonly creditoAplicado = computed(() =>
    this.usarCredito()
      ? Math.min(this.credito(), this.total() - this.descuento() - this.descuentoPuntos())
      : 0,
  );

  readonly aPagar = computed(
    () => this.total() - this.descuento() - this.descuentoPuntos() - this.creditoAplicado(),
  );


  readonly puntosAGanar = computed(() => (this.auth.perfil() ? Math.floor(this.aPagar()) : 0));


  private recompensasElegidas(): string[] {
    return Object.entries(this.canjes()).flatMap(([id, n]) => Array<string>(n).fill(id));
  }

  private intervalo?: number;

  async ngOnInit(): Promise<void> {
    this.orden.set(await this.butacasService.obtenerOrden(this.ordenId()));


    const perfil = await this.auth.perfilListo();
    this.conCuenta.set(!!perfil && this.store.comprador()?.usuarioId === perfil.id);

    if (this.conCuenta()) {
      const seguro = <T>(promesa: Promise<T>, porDefecto: T): Promise<T> =>
        promesa.catch(() => {
          this.errorBeneficios.set(true);
          return porDefecto;
        });

      const [credito, cupones, puntos, recompensas] = await Promise.all([
        seguro(this.cuenta.saldoCredito(), 0),
        seguro(this.cuponesService.misCupones(), []),
        seguro(this.puntosService.misPuntos(), 0),
        seguro(this.puntosService.listarRecompensas(), []),
      ]);
      this.credito.set(credito);
      this.cupones.set(cupones);
      this.puntos.set(puntos);
      this.recompensas.set(recompensas);
      this.cuponId.set(cupones[0]?.id ?? null);
    }

    this.cargando.set(false);
    this.iniciarCuentaRegresiva();
  }

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
      await this.butacasService.confirmarCompra(
        this.ordenId(),
        this.usarCredito(),
        this.cuponId(),
        this.recompensasElegidas(),
      );

      if (this.cuponId()) this.cuponesService.refrescarDisponibles();
      clearInterval(this.intervalo);
      this.pagado.emit();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos procesar el pago.');
    } finally {
      this.pagando.set(false);
    }
  }
}