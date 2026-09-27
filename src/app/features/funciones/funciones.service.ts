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

  /**
   * Programa funciones a partir de una regla de recurrencia.
   * El administrador indica los días de la semana y el horario; la sala la
   * asigna la base de datos.
   */
  async programar(datos: {
    peliculaId: string;
    diasSemana: number[];     // 0 = domingo … 6 = sábado
    hora: string;             // "18:00"
    desde: string;            // "2026-10-01"
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

  /** Devuelve las fechas del rango que caen en los días de semana elegidos. */
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

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('funciones').delete().eq('id', id);
    if (error) throw error;
  }
}