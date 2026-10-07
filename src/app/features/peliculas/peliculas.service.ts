import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Pelicula } from '../../core/models/pelicula';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);


  async masVendidas(cantidad = 3): Promise<{ peliculaId: string; entradas: number }[]> {
    const { data, error } = await this.supabase.client.rpc('mas_vendidas', { p_cantidad: cantidad });
    if (error) throw error;

    return ((data as any[]) ?? []).map((fila) => ({
      peliculaId: fila.pelicula_id,
      entradas: Number(fila.entradas),
    }));
  }

  async listar(filtro?: 'en-cartel' | 'proximamente' | 'portada'): Promise<Pelicula[]> {
    const { data: conFunciones } = await this.supabase.client
      .from('peliculas_con_funciones')
      .select('pelicula_id');

    const ids = (conFunciones ?? []).map((f: any) => f.pelicula_id);

    const { data: puntajes } = await this.supabase.client
      .from('puntajes_peliculas')
      .select('pelicula_id, promedio, cantidad');

    const porPelicula = new Map<string, { promedio: number | null; cantidad: number }>(
      (puntajes ?? []).map((p: any) => [
        p.pelicula_id,
        { promedio: p.promedio !== null ? Number(p.promedio) : null, cantidad: Number(p.cantidad) },
      ]),
    );

    let consulta = this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, poster_url, restriccion_edad, fecha_estreno, activa, en_portada, generos(nombre)')
      .order('titulo');

    if (filtro) {
      consulta = consulta.eq('activa', true);

      if (filtro === 'portada') {

        consulta = consulta.eq('en_portada', true);
      } else if (filtro === 'en-cartel') {

        if (!ids.length) return [];
        consulta = consulta.in('id', ids);
      } else {

        if (ids.length) consulta = consulta.not('id', 'in', `(${ids.join(',')})`);
        consulta = consulta.gt('fecha_estreno', new Date().toISOString().slice(0, 10));
      }
    }

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => {
      const puntaje = porPelicula.get(fila.id);

      return {
        id: fila.id,
        titulo: fila.titulo,
        duracionMin: fila.duracion_min,
        posterUrl: fila.poster_url ?? '',
        restriccionEdad: fila.restriccion_edad,
        fechaEstreno: fila.fecha_estreno,
        activa: fila.activa,
        enPortada: fila.en_portada,
        generos: (fila.generos ?? []).map((g: any) => g.nombre),
        promedio: puntaje?.promedio ?? null,
        cantidadResenias: puntaje?.cantidad ?? 0,
      };
    });
  }

  /**
   * Sube un póster desde la computadora al bucket "posters" de Supabase Storage
   * y devuelve su URL pública, que se guarda en poster_url como un link pegado.
   */
  async subirPoster(archivo: File): Promise<string> {
    const tipos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tipos.includes(archivo.type)) {
      throw new Error('El póster tiene que ser una imagen JPG, PNG o WebP.');
    }

    if (archivo.size > 2 * 1024 * 1024) {
      throw new Error('El póster no puede pesar más de 2 MB.');
    }

    // Nombre único: dos pósters con el mismo nombre de archivo no se pisan.
    const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ruta = `${crypto.randomUUID()}.${extension}`;

    const almacen = this.supabase.client.storage.from('posters');
    const { error } = await almacen.upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;

    return almacen.getPublicUrl(ruta).data.publicUrl;
  }

  async listarGeneros(): Promise<{ id: string; nombre: string }[]> {
    const { data, error } = await this.supabase.client
      .from('generos')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  async obtener(
    id: string,
  ): Promise<(Pelicula & { sinopsis: string; generosIds: string[]; precioPreventa: number | null }) | null> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, sinopsis, duracion_min, poster_url, restriccion_edad, fecha_estreno, activa, en_portada, precio_preventa, generos(id, nombre)')
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
      enPortada: data.en_portada,
      precioPreventa: data.precio_preventa !== null ? Number(data.precio_preventa) : null,
      generos: (data.generos ?? []).map((g: any) => g.nombre),
      generosIds: (data.generos ?? []).map((g: any) => g.id),
      promedio: null,
      cantidadResenias: 0,
    };
  }

  async crear(pelicula: {
    titulo: string;
    sinopsis: string;
    duracionMin: number;
    posterUrl: string;
    restriccionEdad: number;
    fechaEstreno: string;
    precioPreventa: number | null;
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
        precio_preventa: pelicula.precioPreventa,
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

  async actualizar(id: string, pelicula: {
    titulo: string;
    sinopsis: string;
    duracionMin: number;
    posterUrl: string;
    restriccionEdad: number;
    fechaEstreno: string;
    precioPreventa: number | null;
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
        precio_preventa: pelicula.precioPreventa,
      })
      .eq('id', id);

    if (error) throw error;

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

  async cambiarPortada(id: string, enPortada: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('peliculas')
      .update({ en_portada: enPortada })
      .eq('id', id);

    if (error) throw error;
  }
}
