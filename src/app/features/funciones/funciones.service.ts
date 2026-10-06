import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Funcion, FormatoProyeccion, IdiomaFuncion } from '../../core/models/funcion';

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private readonly supabase = inject(SupabaseService);

  async listar(peliculaId?: string): Promise<Funcion[]> {
    let consulta = this.supabase.client
      .from('funciones')
      .select('id, pelicula_id, inicio, fin, formato, idioma, precio_base, peliculas(titulo), salas(nombre)')
      .gte('inicio', new Date().toISOString())
      .order('inicio');

    if (peliculaId) consulta = consulta.eq('pelicula_id', peliculaId);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      peliculaId: fila.pelicula_id,
      peliculaTitulo: fila.peliculas?.titulo ?? '',
      salaNombre: fila.salas?.nombre ?? '',
      inicio: fila.inicio,
      fin: fila.fin,
      formato: fila.formato,
      idioma: fila.idioma,
      precioBase: Number(fila.precio_base),
    }));
  }

 
  async programar(datos: {
    peliculaId: string;
    diasSemana: number[];    
    hora: string;           
    desde: string;           
    hasta: string;
    formato: FormatoProyeccion;
    idioma: IdiomaFuncion;
    precioBase: number;
  }): Promise<{ creadas: number; conflictos: string[] }> {
    const conflictos: string[] = [];
    let creadas = 0;

    for (const fecha of this.fechasDe(datos.desde, datos.hasta, datos.diasSemana)) {
      const inicio = new Date(`${fecha}T${datos.hora}:00`);

      const { error } = await this.supabase.client.rpc('crear_funcion_auto', {
        p_pelicula_id: datos.peliculaId,
        p_inicio: inicio.toISOString(),
        p_formato: datos.formato,
        p_idioma: datos.idioma,
        p_precio: datos.precioBase,
      });

       if (error) {
        conflictos.push(`${fecha}: no hay salas libres en ese horario`);
      } else {
        creadas++;
      }
    }

    return { creadas, conflictos };
  }

  private fechasDe(desde: string, hasta: string, diasSemana: number[]): string[] {
    const fechas: string[] = [];
    const fin = new Date(`${hasta}T00:00:00`);
    const actual = new Date(`${desde}T00:00:00`);

    while (actual <= fin) {
      if (diasSemana.includes(actual.getDay())) {
        fechas.push(actual.toISOString().slice(0, 10));
      }
      actual.setDate(actual.getDate() + 1);
    }

    return fechas;
  }

 
  async editar(id: string, datos: {
    fecha: string;           
    hora: string;         
    formato: FormatoProyeccion;
    idioma: IdiomaFuncion;
    precioBase: number;
  }): Promise<void> {
    const { error } = await this.supabase.client.rpc('editar_funcion', {
      p_funcion_id: id,
      p_inicio: new Date(`${datos.fecha}T${datos.hora}:00`).toISOString(),
      p_formato: datos.formato,
      p_idioma: datos.idioma,
      p_precio: datos.precioBase,
    });

    if (error) throw error;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('eliminar_funcion', { p_funcion_id: id });
    if (error) throw error;
  }
}