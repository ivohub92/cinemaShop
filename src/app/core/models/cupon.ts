export type TipoCupon = 'bienvenida' | 'mayores_50';

export interface Cupon {
  id: string;
  codigo: string;
  porcentaje: number;
  tipo: TipoCupon;
  venceEn: string | null;
  activo: boolean;
  usos: number;
}

export interface DatosCupon {
  codigo: string;
  porcentaje: number;
  venceEn: string | null;
}
