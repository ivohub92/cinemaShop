export interface Resenia {
  id: string;
  peliculaId: string;
  usuarioId: string;
  autor: string;
  puntaje: number;
  comentario: string;
  creadoEn: string;
  verificada: boolean;
}

export interface PuntajePelicula {
  promedio: number | null;
  cantidad: number;
}

export interface PeliculaVista {
  peliculaId: string;
  titulo: string;
  posterUrl: string;
  vistaEn: string;
  sala: string;
  formato: string;
}