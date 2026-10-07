import { inject, Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { environment } from '../../../../environments/environment';
import { DatosEmpleado, MiembroPersonal } from '../../../core/models/empleado';

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private readonly supabase = inject(SupabaseService);

  async listar(): Promise<MiembroPersonal[]> {
    const { data, error } = await this.supabase.client.rpc('listar_personal');
    if (error) throw error;
    return (data as MiembroPersonal[]) ?? [];
  }

  
  async alta(datos: DatosEmpleado): Promise<'existente' | 'creada'> {
    const { data, error } = await this.supabase.client.rpc('alta_empleado', {
      p_email: datos.email,
      p_nombre: datos.nombre,
      p_apellido: datos.apellido,
      p_dni: datos.dni,
    });
    if (error) throw error;
    if (data === 'existente') return 'existente';


    const alta = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { error: errorCuenta } = await alta.auth.signUp({
      email: datos.email.trim().toLowerCase(),
      password: datos.password,
    });

    if (errorCuenta) {

      throw errorCuenta;
    }

    return 'creada';
  }


  async cancelarPendiente(email: string): Promise<void> {
    const { error } = await this.supabase.client.from('empleados_autorizados').delete().eq('email', email);
    if (error) throw error;
  }

  async quitarAcceso(perfilId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('quitar_empleado', { p_perfil_id: perfilId });
    if (error) throw error;
  }
}
