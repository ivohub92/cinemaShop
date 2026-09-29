import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Butaca } from '../../core/models/butaca';

@Injectable({ providedIn: 'root' })
export class ButacasService {
  private readonly supabase = inject(SupabaseService);

  async listarPorFuncion(funcionId: string): Promise<Butaca[]> {
    await this.supabase.client.rpc('liberar_reservas_vencidas');
    const { data: funcion, error: errorFuncion } = await this.supabase.client
      .from('funciones')
      .select('sala_id')
      .eq('id', funcionId)
      .single();

    if (errorFuncion) throw errorFuncion;

    const [butacas, ocupadas] = await Promise.all([
      this.supabase.client
        .from('butacas')
        .select('id, fila, numero, columna, tipo')
        .eq('sala_id', funcion.sala_id)
        .order('fila')
        .order('numero'),
      this.supabase.client
        .from('butacas_ocupadas')
        .select('butaca_id')
        .eq('funcion_id', funcionId),
    ]);

    if (butacas.error) throw butacas.error;

    const ids = new Set((ocupadas.data ?? []).map((o: any) => o.butaca_id));

    return (butacas.data ?? []).map((fila: any) => ({
      id: fila.id,
      fila: fila.fila,
      numero: fila.numero,
      columna: fila.columna,
      tipo: fila.tipo,
      ocupada: ids.has(fila.id),
    }));
  }

  async reservar(
    funcionId: string,
    butacas: string[],
    email: string,
    fechaNacimiento: string,
  ): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('reservar_butacas', {
      p_funcion_id: funcionId,
      p_butacas: butacas,
      p_email: email,
      p_fecha_nacimiento: fechaNacimiento,
    });

    if (error) throw error;
    return data as string;
  }

    async obtenerOrden(ordenId: string): Promise<any> {
    const { data, error } = await this.supabase.client.rpc('obtener_orden', {
      p_orden_id: ordenId,
    });

    if (error) throw error;
    return data;
  }

  async confirmarCompra(ordenId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('confirmar_compra', {
      p_orden_id: ordenId,
    });

    if (error) throw error;
  }
}