import { Directive, effect, ElementRef, inject, input } from '@angular/core';

/** Imagen de respaldo: archivo en public/, la sirve la app y la cachea el service worker. */
export const POSTER_RESPALDO = 'img/poster-no-disponible.svg';

/**
 * Muestra una imagen de respaldo si la original no carga (link roto, sin
 * conexión) o si no hay imagen (película sin póster). Se usa igual que un img
 * común: <img [src]="url" appImagenRespaldo />. La directiva recibe el src y
 * decide qué mostrar. Otra imagen de respaldo: appImagenRespaldo="otra.svg".
 */
@Directive({
  selector: 'img[appImagenRespaldo]',
  host: {
    '(error)': 'usarRespaldo()',
  },
})
export class ImagenRespaldo {
  readonly src = input<string | null | undefined>('');
  readonly appImagenRespaldo = input<string>('');

  private readonly imagen = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private respaldoAplicado = false;

  constructor() {
    // Cada vez que cambia la URL se intenta de nuevo; vacía = respaldo directo.
    effect(() => {
      const url = this.src();
      this.respaldoAplicado = false;

      if (url) {
        this.imagen.nativeElement.src = url;
      } else {
        this.usarRespaldo();
      }
    });
  }

  usarRespaldo(): void {
    // Una sola vez por URL: si también fallara el respaldo, no queda en un bucle de errores.
    if (this.respaldoAplicado) return;
    this.respaldoAplicado = true;
    this.imagen.nativeElement.src = this.appImagenRespaldo() || POSTER_RESPALDO;
  }
}
