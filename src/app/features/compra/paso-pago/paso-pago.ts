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

  readonly ordenId = input.required<string>();

  readonly pagado = output<void>();

  readonly orden = signal<any>(null);
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal('');
  readonly restante = signal('');

  /** Combos y productos de la orden, agrupados para el resumen. */
  readonly candy = computed(() => this.comprobante.resumirCandy(this.orden()));

  /** Cupones disponibles (solo usuarios registrados) y el elegido: uno por orden. */
  readonly cupones = signal<Cupon[]>([]);
  readonly cuponId = signal<string | null>(null);

  /** Crédito de la cuenta (solo usuarios registrados) y si lo quiere usar. */
  readonly credito = signal(0);
  readonly usarCredito = signal(false);

  readonly total = computed(() => Number(this.orden()?.total ?? 0));

  readonly cuponElegido = computed(() => this.cupones().find((c) => c.id === this.cuponId()) ?? null);

  /** Puntos de la cuenta, recompensas activas y cuántas veces se canjea cada una. */
  readonly puntos = signal(0);
  readonly recompensas = signal<Recompensa[]>([]);
  readonly canjes = signal<Record<string, number>>({});

  /** Precios de las entradas que se pueden cubrir con puntos (las de combo no), de mayor a menor. */
  private readonly preciosEntradas = computed<number[]>(() =>
    (this.orden()?.butacas ?? [])
      .filter((b: any) => !b.combo)
      .map((b: any) => Number(b.precio))
      .sort((a: number, b: number) => b - a),
  );

  /** Productos comprados sueltos: id → cantidad y precio. */
  private readonly productosSueltos = computed(() => {
    const mapa = new Map<string, { cantidad: number; precio: number }>();
    for (const p of this.orden()?.productos ?? []) {
      if (!p.combo) mapa.set(p.producto_id, { cantidad: p.cantidad, precio: Number(p.precio) });
    }
    return mapa;
  });

  /** Solo las recompensas que aplican a esta compra. */
  readonly recompensasAplicables = computed(() =>
    this.recompensas().filter((r) =>
      r.tipo === 'entrada' ? this.preciosEntradas().length > 0 : this.productosSueltos().has(r.productoId!),
    ),
  );

  cantidadCanje(recompensa: Recompensa): number {
    return this.canjes()[recompensa.id] ?? 0;
  }

  readonly puntosAUsar = computed(() =>
    this.recompensas().reduce((suma, r) => suma + r.costoPuntos * this.cantidadCanje(r), 0),
  );

  /** Cuántas entradas y cuántas unidades de cada producto ya están cubiertas. */
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

  /** Si se puede canjear una más: que haya algo para cubrir y que alcancen los puntos. */
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

  /**
   * RN-04: cupón → puntos → crédito → dinero.
   * Es una vista previa: el cálculo que vale lo repite confirmar_compra() en la base.
   */
  readonly descuento = computed(() => {
    const cupon = this.cuponElegido();
    return cupon ? Math.round(this.total() * cupon.porcentaje) / 100 : 0;
  });

  /** Lo que cubren los canjes: las entradas más caras primero, igual que la base. */
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

  /** RF-43: 1 punto por peso pagado en dinero (solo con cuenta). */
  readonly puntosAGanar = computed(() => (this.auth.perfil() ? Math.floor(this.aPagar()) : 0));

  /** Un id por canje, como lo espera confirmar_compra(). */
  private recompensasElegidas(): string[] {
    return Object.entries(this.canjes()).flatMap(([id, n]) => Array<string>(n).fill(id));
  }

  private intervalo?: number;

  async ngOnInit(): Promise<void> {
    this.orden.set(await this.butacasService.obtenerOrden(this.ordenId()));

    if (this.auth.perfil()) {
      const [credito, cupones, puntos, recompensas] = await Promise.all([
        this.cuenta.saldoCredito().catch(() => 0),
        this.cuponesService.misCupones().catch(() => []),
        this.puntosService.misPuntos().catch(() => 0),
        this.puntosService.listarRecompensas().catch(() => []),
      ]);
      this.credito.set(credito);
      this.cupones.set(cupones);
      this.puntos.set(puntos);
      this.recompensas.set(recompensas);
      // El de mayor descuento viene primero: se sugiere solo, el usuario lo puede sacar.
      this.cuponId.set(cupones[0]?.id ?? null);
    }

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
      await this.butacasService.confirmarCompra(
        this.ordenId(),
        this.usarCredito(),
        this.cuponId(),
        this.recompensasElegidas(),
      );
      // Actualiza el aviso del header: el cupón usado ya no está disponible.
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