import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';


export interface ResumenCandy {
  combos: { nombre: string; cantidad: number; items: { nombre: string; cantidad: number }[] }[];
  sueltos: { nombre: string; cantidad: number; subtotal: number }[];
}


const pesos = (valor: number | string) =>
  Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

@Injectable({ providedIn: 'root' })
export class ComprobanteService {

  resumirCandy(orden: any): ResumenCandy {
    const productos: any[] = orden?.productos ?? [];
    const butacas: any[] = orden?.butacas ?? [];

    const nombresCombos = [...new Set(productos.filter((p) => p.combo).map((p) => p.combo as string))];

    return {
      combos: nombresCombos.map((nombre) => ({
        nombre,
        cantidad: butacas.filter((b) => b.combo === nombre).length,
        items: productos
          .filter((p) => p.combo === nombre)
          .map((p) => ({ nombre: p.nombre, cantidad: p.cantidad })),
      })),
      sueltos: productos
        .filter((p) => !p.combo)
        .map((p) => ({ nombre: p.nombre, cantidad: p.cantidad, subtotal: p.cantidad * Number(p.precio) })),
    };
  }

  
  async generarQr(codigo: string): Promise<string> {
    return QRCode.toDataURL(codigo, {
      width: 400,
      margin: 1,
      color: { dark: '#1c1233', light: '#ffffff' },
    });
  }

  
  async descargarPdf(orden: any): Promise<void> {
    const qr = await QRCode.toDataURL(orden.codigo_qr, { width: 300, margin: 1 });
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const inicio = new Date(orden.inicio);
    const fecha = inicio.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const hora = inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    doc.setFillColor(28, 18, 51);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('cineShop', 20, 22);

    doc.setTextColor(28, 18, 51);
    doc.setFontSize(18);
    doc.text(orden.pelicula, 20, 55);

    doc.setFontSize(11);
    doc.setTextColor(90, 90, 110);
    doc.text(`${fecha} · ${hora}`, 20, 64);
    doc.text(`${orden.sala} · ${orden.formato} · ${orden.idioma}`, 20, 71);

    doc.setTextColor(28, 18, 51);
    doc.setFontSize(12);
    doc.text('Butacas', 20, 88);

    let y = 96;
    doc.setFontSize(11);
    for (const butaca of orden.butacas ?? []) {
      const tipo =
        butaca.tipo === 'vip' ? ' (VIP)' : butaca.tipo === 'accesible' ? ' (accesible)' : '';
      const combo = butaca.combo ? ` · ${butaca.combo}` : '';
      doc.text(`${butaca.fila}${butaca.numero}${tipo}${combo}`, 20, y);
      doc.text(pesos(butaca.precio), 115, y, { align: 'right' });
      y += 7;
    }

    const candy = this.resumirCandy(orden);
    const hayCandy = candy.combos.length > 0 || candy.sueltos.length > 0;

    if (hayCandy) {
      y += 5;
      doc.setFontSize(12);
      doc.text('Candy bar', 20, y);
      y += 8;
      doc.setFontSize(11);

      for (const combo of candy.combos) {
        doc.text(`${combo.cantidad} × ${combo.nombre} (incluye 1 entrada c/u)`, 20, y);
        y += 6;
        doc.setTextColor(90, 90, 110);
        for (const item of combo.items) {
          doc.text(`${item.cantidad} × ${item.nombre}`, 26, y);
          y += 6;
        }
        doc.setTextColor(28, 18, 51);
        y += 1;
      }

      for (const suelto of candy.sueltos) {
        doc.text(`${suelto.cantidad} × ${suelto.nombre}`, 20, y);
        doc.text(pesos(suelto.subtotal), 115, y, { align: 'right' });
        y += 7;
      }
    }

    if (Number(orden.descuento) > 0) {
      y += 3;
      doc.text(`Cupón ${orden.cupon ?? ''}`.trim(), 20, y);
      doc.text(`- ${pesos(orden.descuento)}`, 115, y, { align: 'right' });
      y += 7;
    }

    doc.setFontSize(13);
    doc.text(`Total: ${pesos(orden.total)}`, 20, y + 6);

    if (Number(orden.credito_usado) > 0) {
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 110);
      doc.text(`Pagado con crédito: ${pesos(orden.credito_usado)}`, 20, y + 13);
      doc.setTextColor(28, 18, 51);
      y += 7;
    }

    doc.addImage(qr, 'PNG', 130, 55, 60, 60);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 110);
    doc.text('Presentá este código en la entrada', 130, 120);
    if (hayCandy) doc.text('y en el candy bar para retirar tus productos', 130, 125);
    doc.text(orden.codigo_qr, 130, hayCandy ? 131 : 126);

    
    if (orden.restriccion_edad) {
      doc.setTextColor(180, 60, 60);
      doc.setFontSize(10);
      doc.text(
        `Función apta para mayores de ${orden.restriccion_edad} años.`,
        20,
        y + 20,
      );
      doc.text('Los menores deben concurrir acompañados por un adulto.', 20, y + 26);
    }

    doc.setTextColor(90, 90, 110);
    doc.setFontSize(9);
    doc.text('Este código pierde validez una vez utilizado.', 20, 280);

    doc.save(`entrada-${orden.codigo_qr}.pdf`);
  }
}