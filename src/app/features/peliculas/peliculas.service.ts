import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Pelicula } from '../../core/models/pelicula';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);

  async listar(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, poster_url, restriccion_edad, generos(nombre)')
      .order('titulo');

    if (error) throw error;

    // La base usa snake_case y los géneros llegan anidados; acá se traduce
    // al modelo que usa la aplicación.
    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      titulo: fila.titulo,
      duracionMin: fila.duracion_min,
      posterUrl: fila.poster_url ?? '',
      restriccionEdad: fila.restriccion_edad,
      generos: (fila.generos ?? []).map((g: any) => g.nombre),
    }));
  }
}