import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Resenia, PuntajePelicula } from '../../core/models/resenia';

@Injectable({ providedIn: 'root' })
export class ReseniasService {
  private readonly supabase = inject(SupabaseService);

  async listar(peliculaId: string): Promise<Resenia[]> {
    const { data, error } = await this.supabase.client
      .from('resenias_publicas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('creado_en', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      peliculaId: fila.pelicula_id,
      usuarioId: fila.usuario_id,
      autor: fila.autor,
      puntaje: fila.puntaje,
      comentario: fila.comentario ?? '',
      creadoEn: fila.creado_en,
      verificada: fila.verificada,
    }));
  }

  async obtenerPuntaje(peliculaId: string): Promise<PuntajePelicula> {
    const { data, error } = await this.supabase.client
      .from('puntajes_peliculas')
      .select('promedio, cantidad')
      .eq('pelicula_id', peliculaId)
      .single();

    if (error) throw error;

    return {
      promedio: data.promedio !== null ? Number(data.promedio) : null,
      cantidad: Number(data.cantidad),
    };
  }


  async guardar(peliculaId: string, usuarioId: string, puntaje: number, comentario: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('resenias')
      .upsert(
        {
          pelicula_id: peliculaId,
          usuario_id: usuarioId,
          puntaje,
          comentario: comentario.trim() || null,
        },
        { onConflict: 'pelicula_id,usuario_id' },
      );

    if (error) throw error;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('resenias').delete().eq('id', id);
    if (error) throw error;
  }

    /** Películas que el usuario vio: compra validada y función ya pasada. */
  async misPeliculas(usuarioId: string): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('mis_peliculas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('vista_en', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      peliculaId: fila.pelicula_id,
      titulo: fila.titulo,
      posterUrl: fila.poster_url ?? '',
      vistaEn: fila.vista_en,
      sala: fila.sala,
      formato: fila.formato,
    }));
  }

  /** Las reseñas que escribió el usuario, para cruzarlas con su historial. */
  async misResenias(usuarioId: string): Promise<Resenia[]> {
    const { data, error } = await this.supabase.client
      .from('resenias_publicas')
      .select('*')
      .eq('usuario_id', usuarioId);

    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      peliculaId: fila.pelicula_id,
      usuarioId: fila.usuario_id,
      autor: fila.autor,
      puntaje: fila.puntaje,
      comentario: fila.comentario ?? '',
      creadoEn: fila.creado_en,
      verificada: fila.verificada,
    }));
  }
}