
export interface Recargos {
  recargo3d: number;
  recargo4d: number;
  recargo5d: number;
  recargoVip: number;
}


export interface PreciosFuncion {
  precioBase: number;
  precio: number;              
  preventa: boolean;
  preventaHasta: string | null;
  formato: string;
  recargoFormato: number;
  recargoVip: number;
}
