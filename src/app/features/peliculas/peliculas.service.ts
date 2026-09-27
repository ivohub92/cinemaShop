import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Pelicula } from '../../core/models/pelicula';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);

  

    async listar(filtro?: 'en-cartel' | 'proximamente'): Promise<Pelicula[]> {
    const { data: conFunciones } = await this.supabase.client
      .from('peliculas_con_funciones')
      .select('pelicula_id');

    const ids = (conFunciones ?? []).map((f: any) => f.pelicula_id);

    let consulta = this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, poster_url, restriccion_edad, fecha_estreno, activa, generos(nombre)')
      .order('titulo');

    if (filtro) {
      consulta = consulta.eq('activa', true);

      if (filtro === 'en-cartel') {
        // Sin funciones programadas no hay ninguna película en cartel.
        if (!ids.length) return [];
        consulta = consulta.in('id', ids);
      } else {
        // Próximamente: sin funciones todavía y con estreno por delante.
        if (ids.length) consulta = consulta.not('id', 'in', `(${ids.join(',')})`);
        consulta = consulta.gt('fecha_estreno', new Date().toISOString().slice(0, 10));
      }
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
      activa: fila.activa,
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
   async obtener(id: string): Promise<(Pelicula & { sinopsis: string; generosIds: string[] }) | null> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, sinopsis, duracion_min, poster_url, restriccion_edad, fecha_estreno, activa, generos(id, nombre)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      titulo: data.titulo,
      sinopsis: data.sinopsis,
      duracionMin: data.duracion_min,
      posterUrl: data.poster_url ?? '',
      restriccionEdad: data.restriccion_edad,
      fechaEstreno: data.fecha_estreno,
      activa: data.activa,
      generos: (data.generos ?? []).map((g: any) => g.nombre),
      generosIds: (data.generos ?? []).map((g: any) => g.id),
    };
  }

  async actualizar(id: string, pelicula: {
    titulo: string;
    sinopsis: string;
    duracionMin: number;
    posterUrl: string;
    restriccionEdad: number;
    fechaEstreno: string;
    generosIds: string[];
  }): Promise<void> {
    const { error } = await this.supabase.client
      .from('peliculas')
      .update({
        titulo: pelicula.titulo,
        sinopsis: pelicula.sinopsis,
        duracion_min: pelicula.duracionMin,
        poster_url: pelicula.posterUrl,
        restriccion_edad: pelicula.restriccionEdad,
        fecha_estreno: pelicula.fechaEstreno,
      })
      .eq('id', id);

    if (error) throw error;

    // Los géneros se reemplazan: se borran los actuales y se cargan los nuevos.
    // Es más simple que calcular cuáles se agregaron y cuáles se quitaron.
    const { error: errorBorrar } = await this.supabase.client
      .from('peliculas_generos')
      .delete()
      .eq('pelicula_id', id);

    if (errorBorrar) throw errorBorrar;

    if (pelicula.generosIds.length) {
      const { error: errorGeneros } = await this.supabase.client
        .from('peliculas_generos')
        .insert(pelicula.generosIds.map((genero_id) => ({ pelicula_id: id, genero_id })));

      if (errorGeneros) throw errorGeneros;
    }
  }

    async darDeBaja(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('peliculas')
      .update({ activa: false })
      .eq('id', id);

    if (error) throw error;
  }

  async reactivar(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('peliculas')
      .update({ activa: true })
      .eq('id', id);

    if (error) throw error;
  }


}