export interface Pelicula {
  id: string;
  fechaEstreno: string;
  titulo: string;
  duracionMin: number;
  generos: string[];
  posterUrl: string;
  restriccionEdad: 0 | 13 | 18;
}
