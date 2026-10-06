import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { Sala } from '../../../core/models/sala';

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly supabase = inject(SupabaseService);

  async listar(): Promise<Sala[]> {
    const { data, error } = await this.supabase.client.rpc('resumen_salas');
    if (error) throw error;

    return ((data as any[]) ?? []).map((f) => ({
      id: f.id,
      nombre: f.nombre,
      activa: f.activa,
      butacas: Number(f.butacas),
      estandar: Number(f.estandar),
      accesibles: Number(f.accesibles),
      vip: Number(f.vip),
      funcionesFuturas: Number(f.funciones_futuras),
    }));
  }


  async crear(nombre: string): Promise<void> {
    const { error } = await this.supabase.client.from('salas').insert({ nombre });
    if (error) throw error;
  }

  async renombrar(id: string, nombre: string): Promise<void> {
    const { error } = await this.supabase.client.from('salas').update({ nombre }).eq('id', id);
    if (error) throw error;
  }


  async cambiarActiva(id: string, activa: boolean): Promise<void> {
    const { error } = await this.supabase.client.from('salas').update({ activa }).eq('id', id);
    if (error) throw error;
  }
}
