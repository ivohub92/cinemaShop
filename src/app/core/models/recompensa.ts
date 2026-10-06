export type TipoRecompensa = 'entrada' | 'producto';

export interface Recompensa {
  id: string;
  nombre: string;
  tipo: TipoRecompensa;
  /** Solo si tipo = 'producto': qué producto del candy cubre. */
  productoId: string | null;
  productoNombre: string;
  costoPuntos: number;
  activo: boolean;
}

export interface DatosRecompensa {
  nombre: string;
  tipo: TipoRecompensa;
  productoId: string | null;
  costoPuntos: number;
}

export interface Canje {
  id: string;
  recompensa: string;
  tipo: TipoRecompensa;
  puntos: number;
  valor: number;
  creadoEn: string;
  estadoOrden: string | null;
}
