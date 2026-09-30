import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  CategoriaProducto,
  Combo,
  DatosCombo,
  DatosProducto,
  Producto,
} from '../../core/models/producto';

const CAMPOS_PRODUCTO =
  'id, categoria_id, nombre, descripcion, precio, imagen_url, activo, categorias_producto(nombre, orden)';

const CAMPOS_COMBO =
  'id, nombre, descripcion, precio, imagen_url, activo, destacado, combo_productos(producto_id, cantidad, productos(nombre))';

/** Candy bar: categorías, productos y combos. Lo usan la compra y el admin. */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly supabase = inject(SupabaseService);

  // ---------------------------------------------------------------- categorías

  async listarCategorias(): Promise<CategoriaProducto[]> {
    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .select('id, nombre')
      .order('orden')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  async crearCategoria(nombre: string): Promise<void> {
    const { error } = await this.supabase.client.from('categorias_producto').insert({ nombre });
    if (error) throw error;
  }


    async renombrarCategoria(id: string, nombre: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('categorias_producto')
      .update({ nombre })
      .eq('id', id);

    if (error) throw error;
  }

  /** Falla con código 23503 si algún producto todavía usa la categoría. */
  async borrarCategoria(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('categorias_producto').delete().eq('id', id);
    if (error) throw error;
  }

  // ----------------------------------------------------------------- productos

  /** Por defecto solo los activos (lo que se vende); el admin pide todos con false. */
  async listar(soloActivos = true): Promise<Producto[]> {
    let consulta = this.supabase.client.from('productos').select(CAMPOS_PRODUCTO).order('nombre');
    if (soloActivos) consulta = consulta.eq('activo', true);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => this.aProducto(fila));
  }

  async obtener(id: string): Promise<Producto | null> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select(CAMPOS_PRODUCTO)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.aProducto(data) : null;
  }

  async crear(producto: DatosProducto): Promise<void> {
    const { error } = await this.supabase.client.from('productos').insert(this.aFilaProducto(producto));
    if (error) throw error;
  }

  async actualizar(id: string, producto: DatosProducto): Promise<void> {
    const { error } = await this.supabase.client
      .from('productos')
      .update(this.aFilaProducto(producto))
      .eq('id', id);

    if (error) throw error;
  }

  /** Los productos no se borran: ya vendidos, los referencia orden_items. */
  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('productos').update({ activo }).eq('id', id);
    if (error) throw error;
  }

  // -------------------------------------------------------------------- combos

  async listarCombos(soloActivos = true): Promise<Combo[]> {
    let consulta = this.supabase.client.from('combos').select(CAMPOS_COMBO).order('nombre');
    if (soloActivos) consulta = consulta.eq('activo', true);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => this.aCombo(fila));
  }

  async obtenerCombo(id: string): Promise<Combo | null> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .select(CAMPOS_COMBO)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.aCombo(data) : null;
  }

  async crearCombo(combo: DatosCombo): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .insert(this.aFilaCombo(combo))
      .select('id')
      .single();

    if (error) throw error;
    await this.guardarItemsCombo(data.id, combo.items);
  }

  async actualizarCombo(id: string, combo: DatosCombo): Promise<void> {
    const { error } = await this.supabase.client
      .from('combos')
      .update(this.aFilaCombo(combo))
      .eq('id', id);

    if (error) throw error;

    // Igual que los géneros de una película: se borran y se vuelven a cargar.
    const { error: errorBorrar } = await this.supabase.client
      .from('combo_productos')
      .delete()
      .eq('combo_id', id);

    if (errorBorrar) throw errorBorrar;
    await this.guardarItemsCombo(id, combo.items);
  }

  async cambiarActivoCombo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('combos').update({ activo }).eq('id', id);
    if (error) throw error;
  }

  private async guardarItemsCombo(comboId: string, items: DatosCombo['items']): Promise<void> {
    const { error } = await this.supabase.client
      .from('combo_productos')
      .insert(items.map((i) => ({ combo_id: comboId, producto_id: i.productoId, cantidad: i.cantidad })));

    if (error) throw error;
  }

 

  private aProducto(fila: any): Producto {
    return {
      id: fila.id,
      categoriaId: fila.categoria_id,
      categoria: fila.categorias_producto?.nombre ?? '',
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? '',
      precio: Number(fila.precio),
      imagenUrl: fila.imagen_url ?? '',
      activo: fila.activo,
    };
  }

  private aFilaProducto(producto: DatosProducto) {
    return {
      categoria_id: producto.categoriaId,
      nombre: producto.nombre,
      descripcion: producto.descripcion || null,
      precio: producto.precio,
      imagen_url: producto.imagenUrl || null,
    };
  }

  private aCombo(fila: any): Combo {
    return {
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? '',
      precio: Number(fila.precio),
      imagenUrl: fila.imagen_url ?? '',
      activo: fila.activo,
      destacado: fila.destacado,
      items: (fila.combo_productos ?? []).map((cp: any) => ({
        productoId: cp.producto_id,
        productoNombre: cp.productos?.nombre ?? '',
        cantidad: cp.cantidad,
      })),
    };
  }

  private aFilaCombo(combo: DatosCombo) {
    return {
      nombre: combo.nombre,
      descripcion: combo.descripcion || null,
      precio: combo.precio,
      imagen_url: combo.imagenUrl || null,
      destacado: combo.destacado,
    };
  }
}
