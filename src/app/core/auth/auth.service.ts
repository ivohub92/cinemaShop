import { inject, Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { Perfil } from '../models/perfil';

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
  readonly perfil = signal<Perfil | null>(null);
  readonly usuario = signal<User | null>(null);

   constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.usuario.set(data.session?.user ?? null);
      this.cargarPerfil();
    });

    this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
      this.usuario.set(sesion?.user ?? null);
      this.cargarPerfil();
    });
  }

  private async cargarPerfil(): Promise<void> {
    const id = this.usuario()?.id;

    if (!id) {
      this.perfil.set(null);
      return;
    }

    const { data } = await this.supabase.client
      .from('perfiles')
      .select('id, email, nombre, apellido, fecha_nacimiento, rol')
      .eq('id', id)
      .single();

    this.perfil.set(
      data
        ? {
            id: data.id,
            email: data.email,
            nombre: data.nombre,
            apellido: data.apellido,
            fechaNacimiento: data.fecha_nacimiento,
            rol: data.rol,
          }
        : null,
    );
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