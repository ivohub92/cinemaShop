import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Producto } from '../../core/models/producto';

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly supabase = inject(SupabaseService);

  async listar(soloActivos = true): Promise<Producto[]> {
    let consulta = this.supabase.client
      .from('productos')
      .select('id, categoria_id, nombre, descripcion, precio, activo, categorias_producto(nombre, orden)')
      .order('nombre');

    if (soloActivos) consulta = consulta.eq('activo', true);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      categoriaId: fila.categoria_id,
      categoria: fila.categorias_producto?.nombre ?? '',
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? '',
      precio: Number(fila.precio),
      activo: fila.activo,
    }));
  }
}