import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CompraStore } from '../compra/compra.store';
import { ProductosService } from '../productos.service';
import { ButacasService } from '../butacas.service';
import { CategoriaProducto, Combo, Producto } from '../../../core/models/producto';

@Component({
  selector: 'app-paso-candy',
  imports: [CurrencyPipe],
  templateUrl: './paso-candy.html',
  styleUrl: './paso-candy.scss',
})
export class PasoCandy implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly butacasService = inject(ButacasService);
  readonly store = inject(CompraStore);

  readonly funcionId = input.required<string>();

  /** La reserva salió bien: el padre pasa al pago con esta orden*/
  readonly reservado = output<string>();

  /** El usuario quiere cambiar sus butacas */
  readonly volver = output<void>();

  readonly productos = signal<Producto[]>([]);
  readonly categorias = signal<CategoriaProducto[]>([]);
  readonly combos = signal<Combo[]>([]);
  readonly cargando = signal(true);
  readonly reservando = signal(false);
  readonly error = signal('');

  /** Cada combo incluye una entrada: no puede haber más combos que butacas */
  readonly maxCombos = computed(() => this.store.butacas().length);
  readonly quedanCombos = computed(() => this.store.totalCombos() < this.maxCombos());

  /** Destacados primero */
  readonly combosOrdenados = computed(() =>
    [...this.combos()].sort((a, b) => Number(b.destacado) - Number(a.destacado)),
  );

  /** Productos agrupados por categoría, en el orden que definió el admin */
  readonly grupos = computed(() =>
    this.categorias()
      .map((categoria) => ({
        categoria: categoria.nombre,
        productos: this.productos().filter((p) => p.categoriaId === categoria.id),
      }))
      .filter((grupo) => grupo.productos.length),
  );

  /** Lo que suman los productos sueltos. Los combos se ven aparte porque reemplazan una entrada */
  readonly subtotalProductos = computed(() =>
    this.productos().reduce((suma, p) => suma + p.precio * this.store.cantidadDe(p.id), 0),
  );

  readonly subtotalCombos = computed(() =>
    this.combos().reduce((suma, c) => suma + c.precio * this.store.cantidadCombo(c.id), 0),
  );

  readonly eligioAlgo = computed(() => this.store.productos().length > 0 || this.store.combos().length > 0);

  async ngOnInit(): Promise<void> {
    try {
      const [productos, categorias, combos] = await Promise.all([
        this.productosService.listar(),
        this.productosService.listarCategorias(),
        this.productosService.listarCombos(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
      this.combos.set(combos);
    } catch {
      this.error.set('No pudimos cargar el candy bar. Podés seguir sin productos.');
    } finally {
      this.cargando.set(false);
    }
  }

  sumarProducto(producto: Producto): void {
    this.store.cambiarCantidad(producto.id, this.store.cantidadDe(producto.id) + 1);
  }

  restarProducto(producto: Producto): void {
    this.store.cambiarCantidad(producto.id, this.store.cantidadDe(producto.id) - 1);
  }

  sumarCombo(combo: Combo): void {
    if (!this.quedanCombos()) return;
    this.store.cambiarCantidadCombo(combo.id, this.store.cantidadCombo(combo.id) + 1);
  }

  restarCombo(combo: Combo): void {
    this.store.cambiarCantidadCombo(combo.id, this.store.cantidadCombo(combo.id) - 1);
  }

  detalle(combo: Combo): string {
    return combo.items.map((i) => `${i.cantidad} × ${i.productoNombre}`).join(' + ');
  }

  omitir(): void {
    this.store.vaciarCandy();
    this.confirmar();
  }

  /** Recién acá se reservan las butacas, junto con el candy elegido */
  async confirmar(): Promise<void> {
    const comprador = this.store.comprador();
    if (!comprador || !this.store.butacas().length) return;

    this.reservando.set(true);
    this.error.set('');

    try {
      const ordenId = await this.butacasService.reservar(
        this.funcionId(),
        this.store.butacas(),
        comprador.email,
        comprador.fechaNacimiento,
        this.store.productos(),
        this.store.combos(),
      );

      this.reservado.emit(ordenId);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos reservar tu compra.');
    } finally {
      this.reservando.set(false);
    }
  }
}
