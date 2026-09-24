import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Pelicula } from '../../core/models/pelicula';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);

  

    async listar(soloEnCartel = false): Promise<Pelicula[]> {
    let consulta = this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, poster_url, restriccion_edad, fecha_estreno, generos(nombre)')
      .order('titulo');

    if (soloEnCartel) {
      consulta = consulta.lte('fecha_estreno', new Date().toISOString().slice(0, 10));
    }

    const { data, error } = await consulta;

    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      titulo: fila.titulo,
      duracionMin: fila.duracion_min,
      posterUrl: fila.poster_url ?? '',
      restriccionEdad: fila.restriccion_edad,
      fechaEstreno: fila.fecha_estreno,
      generos: (fila.generos ?? []).map((g: any) => g.nombre),
    }));
  }

    async listarGeneros(): Promise<{ id: string; nombre: string }[]> {
    const { data, error } = await this.supabase.client
      .from('generos')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  async crear(pelicula: {
    titulo: string;
    sinopsis: string;
    duracionMin: number;
    posterUrl: string;
    restriccionEdad: number;
    fechaEstreno: string;
    generosIds: string[];
  }): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .insert({
        titulo: pelicula.titulo,
        sinopsis: pelicula.sinopsis,
        duracion_min: pelicula.duracionMin,
        poster_url: pelicula.posterUrl,
        restriccion_edad: pelicula.restriccionEdad,
        fecha_estreno: pelicula.fechaEstreno,
      })
      .select('id')
      .single();

    if (error) throw error;

    if (pelicula.generosIds.length) {
      const { error: errorGeneros } = await this.supabase.client
        .from('peliculas_generos')
        .insert(pelicula.generosIds.map((genero_id) => ({ pelicula_id: data.id, genero_id })));

      if (errorGeneros) throw errorGeneros;
    }
  }
}