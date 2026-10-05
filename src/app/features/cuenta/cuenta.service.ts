import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

export interface CompraResumen {
  id: string;
  estado: 'pagada' | 'cancelada';
  total: number;
  creditoUsado: number;
  codigoQr: string;
  creadoEn: string;
  canceladaEn: string | null;
  validadoAccesoEn: string | null;
  validadoCandyEn: string | null;
  pelicula: string;
  posterUrl: string;
  inicio: string;
  sala: string;
  entradas: number;
  tieneCandy: boolean;
}

/** Lo que tiene que ver con la cuenta del usuario: historial de compras y crédito. */
@Injectable({ providedIn: 'root' })
export class CuentaService {
  private readonly supabase = inject(SupabaseService);

  async misCompras(): Promise<CompraResumen[]> {
    const { data, error } = await this.supabase.client.rpc('mis_compras');
    if (error) throw error;

    return ((data as any[]) ?? []).map((fila) => ({
      id: fila.id,
      estado: fila.estado,
      total: Number(fila.total),
      creditoUsado: Number(fila.credito_usado),
      codigoQr: fila.codigo_qr,
      creadoEn: fila.creado_en,
      canceladaEn: fila.cancelada_en,
      validadoAccesoEn: fila.validado_acceso_en,
      validadoCandyEn: fila.validado_candy_en,
      pelicula: fila.pelicula,
      posterUrl: fila.poster_url ?? '',
      inicio: fila.inicio,
      sala: fila.sala,
      entradas: fila.entradas,
      tieneCandy: fila.tiene_candy,
    }));
  }

  /** Saldo de crédito del usuario logueado (0 si no tiene). */
  async saldoCredito(): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('mi_credito');
    if (error) throw error;
    return Number(data ?? 0);
  }

  /** Quita una compra cancelada del listado. No la borra: queda para el crédito y los reportes. */
  async quitarDelListado(ordenId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('ocultar_compra', {
      p_orden_id: ordenId,
    });

    if (error) throw error;
  }

  /** Cancela una compra y devuelve el crédito acreditado. */
  async cancelar(ordenId: string): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('cancelar_compra', {
      p_orden_id: ordenId,
    });

    if (error) throw error;
    return Number(data ?? 0);
  }
}
