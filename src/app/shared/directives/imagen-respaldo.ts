import { Directive, ElementRef, inject, input } from '@angular/core';

const POSTER_RESPALDO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
      <rect width="400" height="600" fill="#271a45"/>
      <rect x="24" y="24" width="352" height="552" fill="none" stroke="#3d2d66" stroke-width="2"/>
      <text x="200" y="306" fill="#a99cc9" font-family="sans-serif" font-size="22"
            text-anchor="middle">Poster no disponible</text>
    </svg>`,
  );


@Directive({
  selector: 'img[appImagenRespaldo]',
  host: {
    '(error)': 'usarRespaldo()',
  },
})
export class ImagenRespaldo {
  readonly appImagenRespaldo = input<string>('');

  private readonly imagen = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private respaldoAplicado = false;

  usarRespaldo(): void {
    // Si el respaldo también falla no se reintenta: evita un bucle infinito.
    if (this.respaldoAplicado) return;
    this.respaldoAplicado = true;
    this.imagen.nativeElement.src = this.appImagenRespaldo() || POSTER_RESPALDO;
  }
}