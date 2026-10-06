/** Un día del reporte de facturación (RF-58). Montos en pesos. */
export interface DiaFacturacion {
  dia: string;        
  ordenes: number;
  entradas: number;
  facturacion: number;  
  credito: number;     
  descuentos: number; 
}

export interface ReporteFacturacion {
  dias: DiaFacturacion[];
  canceladas: { ordenes: number; monto: number };
}


export interface PeliculaMasVista {
  peliculaId: string;
  titulo: string;
  entradas: number;
}


export interface ProductoVendido {
  productoId: string;
  nombre: string;
  unidades: number;
  sueltas: number;
  enCombo: number;
  facturado: number;
}


export interface ComboVendido {
  comboId: string;
  nombre: string;
  unidades: number;
  facturado: number;  
  parteCandy: number;  
}

export interface ReporteCombos {
  combos: ComboVendido[];
  totalSuelto: number; 
}
