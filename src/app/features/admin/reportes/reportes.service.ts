import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { PeliculaMasVista, ProductoVendido, ReporteCombos, ReporteFacturacion } from '../../../core/models/reporte';


@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly supabase = inject(SupabaseService);

  async facturacion(desde: string, hasta: string): Promise<ReporteFacturacion> {
    const { data, error } = await this.supabase.client.rpc('reporte_facturacion', {
      p_desde: desde,
      p_hasta: hasta,
    });

    if (error) throw error;

    const reporte = data as any;
    return {
      dias: (reporte?.dias ?? []).map((d: any) => ({
        dia: d.dia,
        ordenes: Number(d.ordenes),
        entradas: Number(d.entradas),
        facturacion: Number(d.facturacion),
        credito: Number(d.credito),
        descuentos: Number(d.descuentos),
      })),
      canceladas: {
        ordenes: Number(reporte?.canceladas?.ordenes ?? 0),
        monto: Number(reporte?.canceladas?.monto ?? 0),
      },
    };
  }

  async masVistas(desde: string, hasta: string, cantidad = 5): Promise<PeliculaMasVista[]> {
    const { data, error } = await this.supabase.client.rpc('reporte_mas_vistas', {
      p_desde: desde,
      p_hasta: hasta,
      p_cantidad: cantidad,
    });

    if (error) throw error;
    return ((data as any[]) ?? []).map((f) => ({
      peliculaId: f.pelicula_id,
      titulo: f.titulo,
      entradas: Number(f.entradas),
    }));
  }

  async productos(desde: string, hasta: string, cantidad = 5): Promise<ProductoVendido[]> {
    const { data, error } = await this.supabase.client.rpc('reporte_productos', {
      p_desde: desde,
      p_hasta: hasta,
      p_cantidad: cantidad,
    });

    if (error) throw error;
    return ((data as any[]) ?? []).map((f) => ({
      productoId: f.producto_id,
      nombre: f.nombre,
      unidades: Number(f.unidades),
      sueltas: Number(f.sueltas ?? 0),
      enCombo: Number(f.en_combo ?? 0),
      facturado: Number(f.facturado ?? 0),
    }));
  }

  async combos(desde: string, hasta: string): Promise<ReporteCombos> {
    const { data, error } = await this.supabase.client.rpc('reporte_combos', {
      p_desde: desde,
      p_hasta: hasta,
    });

    if (error) throw error;

    const reporte = data as any;
    return {
      combos: (reporte?.combos ?? []).map((c: any) => ({
        comboId: c.combo_id,
        nombre: c.nombre,
        unidades: Number(c.unidades),
        facturado: Number(c.facturado ?? 0),
        parteCandy: Number(c.parte_candy ?? 0),
      })),
      totalSuelto: Number(reporte?.total_suelto ?? 0),
    };
  }
}
