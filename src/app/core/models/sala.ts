/** Una sala con el resumen de su distribución (RF-22). */
export interface Sala {
  id: string;
  nombre: string;
  activa: boolean;
  butacas: number;
  estandar: number;
  accesibles: number;
  vip: number;
  funcionesFuturas: number;
}
