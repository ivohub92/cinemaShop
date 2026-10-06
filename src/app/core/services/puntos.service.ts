import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Canje, DatosRecompensa, Recompensa } from '../models/recompensa';

const CAMPOS = 'id, nombre, tipo, producto_id, costo_puntos, activo, productos(nombre)';

/** Puntos y recompensas (RF-43 a RF-46). El saldo y los canjes los calcula la base. */
@Injectable({ providedIn: 'root' })
export class PuntosService {
  private readonly supabase = inject(SupabaseService);

  // ------------------------------------------------------------------ cliente

  async misPuntos(): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('mis_puntos');
    if (error) throw error;
    return Number(data ?? 0);
  }

  async misCanjes(): Promise<Canje[]> {
    const { data, error } = await this.supabase.client.rpc('mis_canjes');
    if (error) throw error;

    return ((data as any[]) ?? []).map((fila) => ({
      id: fila.id,
      recompensa: fila.recompensa,
      tipo: fila.tipo,
      puntos: fila.puntos,
      valor: Number(fila.valor),
      creadoEn: fila.creado_en,
      estadoOrden: fila.estado_orden ?? null,
    }));
  }

  /** Por defecto solo las activas (las que se ofrecen al pagar); el admin pide todas. */
  async listarRecompensas(soloActivas = true): Promise<Recompensa[]> {
    let consulta = this.supabase.client.from('recompensas').select(CAMPOS).order('costo_puntos');
    if (soloActivas) consulta = consulta.eq('activo', true);

    const { data, error } = await consulta;
    if (error) throw error;
    return (data ?? []).map((fila: any) => this.aRecompensa(fila));
  }

  // -------------------------------------------------------------------- admin

  async crear(recompensa: DatosRecompensa): Promise<void> {
    const { error } = await this.supabase.client.from('recompensas').insert({
      nombre: recompensa.nombre,
      tipo: recompensa.tipo,
      producto_id: recompensa.tipo === 'producto' ? recompensa.productoId : null,
      costo_puntos: recompensa.costoPuntos,
    });

    if (error) throw error;
  }

  /** RF-45: el admin cambia cuántos puntos cuesta cada recompensa. */
  async cambiarCosto(id: string, costoPuntos: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('recompensas')
      .update({ costo_puntos: costoPuntos })
      .eq('id', id);

    if (error) throw error;
  }

  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('recompensas').update({ activo }).eq('id', id);
    if (error) throw error;
  }

  private aRecompensa(fila: any): Recompensa {
    return {
      id: fila.id,
      nombre: fila.nombre,
      tipo: fila.tipo,
      productoId: fila.producto_id ?? null,
      productoNombre: fila.productos?.nombre ?? '',
      costoPuntos: fila.costo_puntos,
      activo: fila.activo,
    };
  }
}
