import { Directive, ElementRef, inject, signal } from '@angular/core';


const INCLINACION_MAXIMA = 6;


@Directive({
  selector: '[appPosterHover]',
  host: {
    '[class.poster-activo]': 'activo()',
    '[style.--inclinacion-x]': 'inclinacionX() + "deg"',
    '[style.--inclinacion-y]': 'inclinacionY() + "deg"',
    '(pointerenter)': 'alEntrar($event)',
    '(pointermove)': 'alMover($event)',
    '(pointerleave)': 'alSalir()',
  },
})
export class PosterHover {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly activo = signal(false);
  readonly inclinacionX = signal(0);
  readonly inclinacionY = signal(0);

  alEntrar(evento: PointerEvent): void {
    if (evento.pointerType !== 'mouse') return;
    this.activo.set(true);
  }

  private readonly movimientoReducido =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  alMover(evento: PointerEvent): void {
    if (!this.activo() || this.movimientoReducido) return;
    if (!this.activo()) return;

    const caja = this.elemento.nativeElement.getBoundingClientRect();
    // Posición del cursor relativa a la tarjeta: de -0,5 a 0,5 en cada eje.
    const relativoX = (evento.clientX - caja.left) / caja.width - 0.5;
    const relativoY = (evento.clientY - caja.top) / caja.height - 0.5;

    this.inclinacionY.set(relativoX * INCLINACION_MAXIMA * 2);
    this.inclinacionX.set(-relativoY * INCLINACION_MAXIMA * 2);
  }

  alSalir(): void {
    this.activo.set(false);
    this.inclinacionX.set(0);
    this.inclinacionY.set(0);
  }
    
}