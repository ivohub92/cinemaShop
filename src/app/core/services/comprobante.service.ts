import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

@Injectable({ providedIn: 'root' })
export class ComprobanteService {
  
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
      const etiqueta =
        butaca.tipo === 'vip' ? ' (VIP)' : butaca.tipo === 'accesible' ? ' (accesible)' : '';
      doc.text(`${butaca.fila}${butaca.numero}${etiqueta}`, 20, y);
      doc.text(`$ ${butaca.precio}`, 70, y, { align: 'right' });
      y += 7;
    }

    doc.setFontSize(13);
    doc.text(`Total: $ ${orden.total}`, 20, y + 6);

    doc.addImage(qr, 'PNG', 130, 55, 60, 60);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 110);
    doc.text('Presentá este código en la entrada', 130, 120);
    doc.text(orden.codigo_qr, 130, 126);

    
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