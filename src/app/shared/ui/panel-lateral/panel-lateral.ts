import { Component, ElementRef, output, viewChild } from '@angular/core';


@Component({
  selector: 'app-panel-lateral',
  templateUrl: './panel-lateral.html',
  styleUrl: './panel-lateral.scss',
})
export class PanelLateral {
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  readonly cerrado = output<void>();

  abrir(): void {
    this.dialogo().nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo().nativeElement.close();
  }

  alCerrar(): void {
    this.cerrado.emit();
  }


  alClickFondo(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.cerrar();
  }
}