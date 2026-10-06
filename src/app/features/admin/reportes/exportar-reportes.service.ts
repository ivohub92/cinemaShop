import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { DiaFacturacion, ReporteFacturacion } from '../../../core/models/reporte';

/** Totales del período, tal como los calcula PanelReportes. */
export interface TotalesFacturacion {
  ordenes: number;
  entradas: number;
  facturacion: number;
  credito: number;
  descuentos: number;
  ticketPromedio: number;
}

/** $ 31.000 — formato argentino, sin decimales. */
const pesos = (valor: number) =>
  valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** '2026-10-06' → '06/10/2026' */
const fecha = (iso: string) => iso.split('-').reverse().join('/');

/** Exportación del reporte de facturación (RF-59): PDF y Excel. */
@Injectable({ providedIn: 'root' })
export class ExportarReportesService {
  exportarPdf(
    dias: DiaFacturacion[],
    totales: TotalesFacturacion,
    reporte: ReporteFacturacion,
    desde: string,
    hasta: string,
  ): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const columnas = [
      { titulo: 'Día', x: 15, alinear: 'left' as const },
      { titulo: 'Compras', x: 70, alinear: 'right' as const },
      { titulo: 'Entradas', x: 92, alinear: 'right' as const },
      { titulo: 'Facturación', x: 128, alinear: 'right' as const },
      { titulo: 'Con crédito', x: 160, alinear: 'right' as const },
      { titulo: 'Descuentos', x: 195, alinear: 'right' as const },
    ];

    // Encabezado
    doc.setFillColor(28, 18, 51);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('cineShop · Facturación diaria', 15, 18);

    doc.setTextColor(28, 18, 51);
    doc.setFontSize(11);
    doc.text(`Período: ${fecha(desde)} al ${fecha(hasta)}`, 15, 40);

    // Resumen
    doc.setFontSize(10);
    const resumen = [
      `Facturación: ${pesos(totales.facturacion)}`,
      `Entradas vendidas: ${totales.entradas} en ${totales.ordenes} compras`,
      `Ticket promedio: ${pesos(totales.ticketPromedio)}`,
      `Canceladas: ${reporte.canceladas.ordenes} (${pesos(reporte.canceladas.monto)} devueltos como crédito)`,
    ];
    resumen.forEach((linea, i) => doc.text(linea, 15, 50 + i * 6));

    // Tabla
    let y = 82;
    const encabezado = () => {
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 110);
      for (const c of columnas) doc.text(c.titulo, c.x, y, { align: c.alinear });
      doc.setDrawColor(200, 200, 210);
      doc.line(15, y + 2, 195, y + 2);
      doc.setTextColor(28, 18, 51);
      y += 8;
    };

    encabezado();
    doc.setFontSize(10);

    for (const d of dias) {
      if (y > 280) {
        doc.addPage();
        y = 20;
        encabezado();
        doc.setFontSize(10);
      }
      const valores = [
        fecha(d.dia),
        String(d.ordenes),
        String(d.entradas),
        pesos(d.facturacion),
        pesos(d.credito),
        pesos(d.descuentos),
      ];
      columnas.forEach((c, i) => doc.text(valores[i], c.x, y, { align: c.alinear }));
      y += 6;
    }

    // Totales
    doc.line(15, y - 3, 195, y - 3);
    y += 2;
    const filaTotal = [
      'Total',
      String(totales.ordenes),
      String(totales.entradas),
      pesos(totales.facturacion),
      pesos(totales.credito),
      pesos(totales.descuentos),
    ];
    columnas.forEach((c, i) => doc.text(filaTotal[i], c.x, y, { align: c.alinear }));

    doc.setFontSize(8);
    doc.setTextColor(90, 90, 110);
    doc.text(
      'Facturación = dinero cobrado (total menos lo pagado con crédito). Las compras canceladas no suman.',
      15,
      Math.min(y + 12, 290),
    );

    doc.save(`facturacion-${desde}-a-${hasta}.pdf`);
  }

  /**
   * Excel real (.xlsx). La librería pesa cientos de KB: con import() dinámico
   * se descarga recién cuando el admin toca "Exportar Excel" (lazy loading).
   */
  async exportarExcel(
    dias: DiaFacturacion[],
    totales: TotalesFacturacion,
    reporte: ReporteFacturacion,
    desde: string,
    hasta: string,
  ): Promise<void> {
    const XLSX = await import('xlsx');

    // Los montos van como números (no texto): en Excel se pueden sumar y graficar.
    const filas = dias.map((d) => ({
      Día: fecha(d.dia),
      Compras: d.ordenes,
      Entradas: d.entradas,
      'Facturación ($)': d.facturacion,
      'Con crédito ($)': d.credito,
      'Descuentos ($)': d.descuentos,
    }));

    filas.push({
      Día: 'Total',
      Compras: totales.ordenes,
      Entradas: totales.entradas,
      'Facturación ($)': totales.facturacion,
      'Con crédito ($)': totales.credito,
      'Descuentos ($)': totales.descuentos,
    });

    const hojaDias = XLSX.utils.json_to_sheet(filas);
    hojaDias['!cols'] = [{ wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 16 }, { wch: 16 }, { wch: 15 }];

    const hojaResumen = XLSX.utils.aoa_to_sheet([
      ['Período', `${fecha(desde)} al ${fecha(hasta)}`],
      ['Facturación ($)', totales.facturacion],
      ['Compras', totales.ordenes],
      ['Entradas vendidas', totales.entradas],
      ['Ticket promedio ($)', Math.round(totales.ticketPromedio)],
      ['Compras canceladas', reporte.canceladas.ordenes],
      ['Devuelto como crédito ($)', reporte.canceladas.monto],
    ]);
    hojaResumen['!cols'] = [{ wch: 26 }, { wch: 24 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hojaDias, 'Facturación diaria');
    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');
    XLSX.writeFile(libro, `facturacion-${desde}-a-${hasta}.xlsx`);
  }
}
