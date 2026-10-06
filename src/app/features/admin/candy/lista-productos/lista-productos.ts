import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ProductosService } from '../../../compra/productos.service';
import { CategoriaProducto, Combo, Producto } from '../../../../core/models/producto';

@Component({
  selector: 'app-lista-productos',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './lista-productos.html',
  styleUrl: './lista-productos.scss',
})
export class ListaProductos implements OnInit {
  private readonly productosService = inject(ProductosService);

  readonly productos = signal<Producto[]>([]);
  readonly categorias = signal<CategoriaProducto[]>([]);
  readonly combos = signal<Combo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly editandoCategoria = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.recargar();
    this.cargando.set(false);
  }

  private async recargar(): Promise<void> {
    const [productos, categorias, combos] = await Promise.all([
      this.productosService.listar(false),
      this.productosService.listarCategorias(),
      this.productosService.listarCombos(false),
    ]);
    this.productos.set(productos);
    this.categorias.set(categorias);
    this.combos.set(combos);
  }

    async agregarCategoria(campo: HTMLInputElement): Promise<void> {
    const nombre = campo.value.trim();
    if (!nombre) return;

    this.error.set('');
    try {
      await this.productosService.crearCategoria(nombre);
      campo.value = '';
      await this.recargar();
    } catch (e: any) {
      this.error.set(this.mensajeCategoria(e, 'No pudimos crear la categoría.'));
    }
  }

  async renombrarCategoria(categoria: CategoriaProducto, campo: HTMLInputElement): Promise<void> {
    const nombre = campo.value.trim();

    if (!nombre || nombre === categoria.nombre) {
      this.editandoCategoria.set(null);
      return;
    }

    this.error.set('');
    try {
      await this.productosService.renombrarCategoria(categoria.id, nombre);
      this.editandoCategoria.set(null);
      await this.recargar();
    } catch (e: any) {
      this.error.set(this.mensajeCategoria(e, 'No pudimos renombrar la categoría.'));
    }
  }

  async borrarCategoria(categoria: CategoriaProducto): Promise<void> {
    if (!confirm(`¿Borrar la categoría "${categoria.nombre}"?`)) return;

    this.error.set('');
    try {
      await this.productosService.borrarCategoria(categoria.id);
      await this.recargar();
    } catch (e: any) {
      this.error.set(this.mensajeCategoria(e, 'No pudimos borrar la categoría.'));
    }
  }

  productosEn(categoria: CategoriaProducto): number {
    return this.productos().filter((p) => p.categoriaId === categoria.id).length;
  }


  private mensajeCategoria(e: any, porDefecto: string): string {
    if (e?.code === '23505') return 'Ya existe una categoría con ese nombre.';
    if (e?.code === '23503') {
      return 'No se puede borrar: tiene productos. Pasalos a otra categoría primero.';
    }
    return porDefecto;
  }

  async cambiarEstado(producto: Producto): Promise<void> {
    if (producto.activo && !confirm(`¿Dar de baja "${producto.nombre}"?`)) return;

    await this.productosService.cambiarActivo(producto.id, !producto.activo);
    await this.recargar();
  }

  async cambiarEstadoCombo(combo: Combo): Promise<void> {
    if (combo.activo && !confirm(`¿Dar de baja el combo "${combo.nombre}"?`)) return;

    await this.productosService.cambiarActivoCombo(combo.id, !combo.activo);
    await this.recargar();
  }


  detalle(combo: Combo): string {
    return combo.items.map((i) => `${i.cantidad} × ${i.productoNombre}`).join(', ');
  }
}
