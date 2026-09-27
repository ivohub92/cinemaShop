export type FormatoProyeccion = '2D' | '3D' | '4D' | '5D';
export type IdiomaFuncion = 'castellano' | 'subtitulada';

export interface Funcion {
  id: string;
  peliculaId: string;
  peliculaTitulo: string;
  salaNombre: string;
  inicio: string;
  fin: string;
  formato: FormatoProyeccion;
  idioma: IdiomaFuncion;
  precioBase: number;
}