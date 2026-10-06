/** Un día del reporte de facturación (RF-58). Montos en pesos. */
export interface DiaFacturacion {
  dia: string;          // 'YYYY-MM-DD'
  ordenes: number;
  entradas: number;
  facturacion: number;  // dinero cobrado: total − crédito usado
  credito: number;      // pagado con crédito (no es ingreso nuevo)
  descuentos: number;   // cupones + canje de puntos
}

export interface ReporteFacturacion {
  dias: DiaFacturacion[];
  canceladas: { ordenes: number; monto: number };
}

/** RF-60: entradas validadas por película en un período. */
export interface PeliculaMasVista {
  peliculaId: string;
  titulo: string;
  entradas: number;
}

/** RF-61: unidades vendidas por producto (sueltas y dentro de combos). */
export interface ProductoVendido {
  productoId: string;
  nombre: string;
  unidades: number;
  sueltas: number;
  enCombo: number;
  facturado: number;
}
