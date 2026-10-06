import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Butaca } from '../../core/models/butaca';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ComboElegido, ItemCarrito } from '../../core/models/producto';

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
    productos: ItemCarrito[] = [],
    combos: ComboElegido[] = [],
  ): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('reservar_butacas', {
      p_funcion_id: funcionId,
      p_butacas: butacas,
      p_email: email,
      p_fecha_nacimiento: fechaNacimiento,
      p_productos: productos.map((p) => ({ id: p.productoId, cantidad: p.cantidad })),
      p_combos: combos.map((c) => ({ id: c.comboId, cantidad: c.cantidad })),
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

  /**
   * Paga la orden. Orden de RN-04: cupón → puntos (recompensas) → crédito;
   * el resto se cobra con el pago simulado. Los cálculos los hace la base.
   * recompensas: un id por canje (se repite para canjear dos veces la misma).
   */
  async confirmarCompra(
    ordenId: string,
    usarCredito = false,
    cuponId: string | null = null,
    recompensas: string[] = [],
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc('confirmar_compra', {
      p_orden_id: ordenId,
      p_usar_credito: usarCredito,
      p_cupon_id: cuponId,
      p_recompensas: recompensas,
    });

    if (error) throw error;
  }


   escucharCambios(
    funcionId: string,
    alCambiar: (butacaId: string, ocupada: boolean) => void,
  ): RealtimeChannel {
    return this.supabase.client
      .channel(`funcion:${funcionId}`)
      .on('broadcast', { event: 'butaca' }, ({ payload }) =>
        alCambiar(payload.butaca_id, payload.ocupada),
      )
      .subscribe();
  }

  dejarDeEscuchar(canal: RealtimeChannel): void {
    this.supabase.client.removeChannel(canal);
  }
}