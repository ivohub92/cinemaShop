export interface Pelicula {
    id: string;
  titulo: string;
  duracionMin: number;
  generos: string[];
  posterUrl: string;
  restriccionEdad: 0 | 13 | 18;
}
