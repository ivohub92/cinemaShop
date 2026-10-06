export type TipoCupon = 'bienvenida' | 'mayores_50';

export interface Cupon {
  id: string;
  codigo: string;
  porcentaje: number;
  tipo: TipoCupon;
  venceEn: string | null;
  activo: boolean;
  /** Cuántas veces se usó (solo lo carga el listado del admin). */
  usos: number;
}

export interface DatosCupon {
  codigo: string;
  porcentaje: number;
  venceEn: string | null;
}
