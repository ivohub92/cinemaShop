import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Cupon, DatosCupon } from '../models/cupon';

const CLAVE_BIENVENIDA = 'cupon_bienvenida_pct';

/** Cupones: los que puede usar el cliente al pagar y la gestión del admin. */
@Injectable({ providedIn: 'root' })
export class CuponesService {
  private readonly supabase = inject(SupabaseService);

  // ------------------------------------------------------------------ cliente

  /**
   * Cupones disponibles del usuario logueado, compartidos por toda la app:
   * los lee el aviso del header y se refrescan al loguearse o al pagar.
   */
  readonly disponibles = signal<Cupon[]>([]);

  async refrescarDisponibles(): Promise<void> {
    this.disponibles.set(await this.misCupones().catch(() => []));
  }

  /** Cupones que el usuario logueado puede usar hoy (la regla vive en la base). */
  async misCupones(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.client.rpc('mis_cupones');
    if (error) throw error;
    return ((data as any[]) ?? []).map((fila) => this.aCupon(fila));
  }

  // -------------------------------------------------------------------- admin

  async listarMayores50(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.client
      .from('cupones')
      .select('id, codigo, porcentaje, tipo, vence_en, activo, cupones_usados(count)')
      .eq('tipo', 'mayores_50')
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((fila: any) => this.aCupon(fila));
  }

  async crear(cupon: DatosCupon): Promise<void> {
    const { error } = await this.supabase.client.from('cupones').insert({
      codigo: cupon.codigo.trim().toUpperCase(),
      porcentaje: cupon.porcentaje,
      tipo: 'mayores_50',
      vence_en: cupon.venceEn || null,
    });

    if (error) throw error;
  }

  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('cupones').update({ activo }).eq('id', id);
    if (error) throw error;
  }

  async porcentajeBienvenida(): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('configuracion')
      .select('valor')
      .eq('clave', CLAVE_BIENVENIDA)
      .single();

    if (error) throw error;
    return Number(data.valor);
  }

  async guardarPorcentajeBienvenida(valor: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('configuracion')
      .update({ valor })
      .eq('clave', CLAVE_BIENVENIDA);

    if (error) throw error;
  }

  private aCupon(fila: any): Cupon {
    return {
      id: fila.id,
      codigo: fila.codigo,
      porcentaje: Number(fila.porcentaje),
      tipo: fila.tipo,
      venceEn: fila.vence_en ?? null,
      activo: fila.activo ?? true,
      usos: fila.cupones_usados?.[0]?.count ?? 0,
    };
  }
}
