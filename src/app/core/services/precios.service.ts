import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { PreciosFuncion, Recargos } from '../models/precios';

const CLAVES: Record<keyof Recargos, string> = {
  recargo3d: 'recargo_3d',
  recargo4d: 'recargo_4d',
  recargo5d: 'recargo_5d',
  recargoVip: 'recargo_vip',
};


@Injectable({ providedIn: 'root' })
export class PreciosService {
  private readonly supabase = inject(SupabaseService);

  async recargos(): Promise<Recargos> {
    const { data, error } = await this.supabase.client
      .from('configuracion')
      .select('clave, valor')
      .in('clave', Object.values(CLAVES));

    if (error) throw error;

    const valor = (clave: string) => Number(data?.find((f) => f.clave === clave)?.valor ?? 0);
    return {
      recargo3d: valor(CLAVES.recargo3d),
      recargo4d: valor(CLAVES.recargo4d),
      recargo5d: valor(CLAVES.recargo5d),
      recargoVip: valor(CLAVES.recargoVip),
    };
  }

  async guardarRecargos(recargos: Recargos): Promise<void> {
    const filas = (Object.keys(CLAVES) as (keyof Recargos)[]).map((campo) => ({
      clave: CLAVES[campo],
      valor: recargos[campo],
    }));


    for (const fila of filas) {
      const { error } = await this.supabase.client
        .from('configuracion')
        .update({ valor: fila.valor })
        .eq('clave', fila.clave);

      if (error) throw error;
    }
  }

  async deFuncion(funcionId: string): Promise<PreciosFuncion> {
    const { data, error } = await this.supabase.client.rpc('precios_funcion', { p_funcion_id: funcionId });
    if (error) throw error;

    const p = data as any;
    return {
      precioBase: Number(p.precio_base),
      precio: Number(p.precio),
      preventa: !!p.preventa,
      preventaHasta: p.preventa_hasta,
      formato: p.formato,
      recargoFormato: Number(p.recargo_formato),
      recargoVip: Number(p.recargo_vip),
    };
  }
}
