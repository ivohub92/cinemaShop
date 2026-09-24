import { inject, Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

export interface DatosRegistro {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre: string;
  colorOjos: string;
  diasVacaciones: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly usuario = signal<User | null>(null);

  constructor() {
    
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.usuario.set(data.session?.user ?? null);
    });

    
    this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
      this.usuario.set(sesion?.user ?? null);
    });
  }

  async registrar(datos: DatosRegistro): Promise<void> {
    const { error } = await this.supabase.client.auth.signUp({
      email: datos.email,
      password: datos.password,
      options: {
        
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          fecha_nacimiento: datos.fechaNacimiento,
          tipo_sangre: datos.tipoSangre,
          color_ojos: datos.colorOjos,
          dias_vacaciones: datos.diasVacaciones,
        },
      },
    });

    if (error) throw error;
  }

  async ingresar(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async salir(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }
}