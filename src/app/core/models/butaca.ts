export type TipoButaca = 'estandar' | 'accesible' | 'vip';

export interface Butaca {
  id: string;
  fila: string;
  numero: number;
  columna: number;
  tipo: TipoButaca;
  ocupada: boolean;
}