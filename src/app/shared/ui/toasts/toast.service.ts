import { Injectable, signal } from '@angular/core';

export type TipoToast = 'error' | 'exito' | 'info';

export interface Toast {
  id: number;
  texto: string;
  tipo: TipoToast;
}


@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private siguiente = 1;

  mostrar(texto: string, tipo: TipoToast = 'info', duracionMs = 5000): void {
    const id = this.siguiente++;
    this.toasts.update((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => this.cerrar(id), duracionMs);
  }

  error(texto: string): void {
    this.mostrar(texto, 'error', 7000);
  }

  exito(texto: string): void {
    this.mostrar(texto, 'exito');
  }

  cerrar(id: number): void {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }
}
