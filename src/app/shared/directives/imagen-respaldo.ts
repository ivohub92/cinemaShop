import { Directive, effect, ElementRef, inject, input } from '@angular/core';


export const POSTER_RESPALDO = 'img/poster-no-disponible.svg';


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
    if (this.respaldoAplicado) return;
    this.respaldoAplicado = true;
    this.imagen.nativeElement.src = this.appImagenRespaldo() || POSTER_RESPALDO;
  }
}
