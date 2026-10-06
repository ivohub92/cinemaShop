import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class ValidacionService {
  private readonly supabase = inject(SupabaseService);

  async consultar(codigo: string): Promise<any> {
    const { data, error } = await this.supabase.client.rpc('consultar_codigo', {
      p_codigo: codigo,
    });

    if (error) throw error;
    return data;
  }

  async validarAcceso(codigo: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('validar_acceso', {
      p_codigo: codigo,
    });

    if (error) throw error;
  }

  async entregarCandy(codigo: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('validar_candy', {
      p_codigo: codigo,
    });

    if (error) throw error;
  }
}
