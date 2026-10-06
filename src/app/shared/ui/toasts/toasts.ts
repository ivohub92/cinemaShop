import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/** Pila de avisos abajo a la derecha. Va una sola vez, en el componente raíz. */
@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  private readonly servicio = inject(ToastService);

  readonly toasts = this.servicio.toasts;

  cerrar(id: number): void {
    this.servicio.cerrar(id);
  }
}
