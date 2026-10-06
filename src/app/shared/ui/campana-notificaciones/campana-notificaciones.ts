import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificacionesService } from '../../../core/services/notificaciones.service';

@Component({
  selector: 'app-campana-notificaciones',
  imports: [DatePipe, RouterLink],
  templateUrl: './campana-notificaciones.html',
  styleUrl: './campana-notificaciones.scss',
})
export class CampanaNotificaciones {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly elemento = inject(ElementRef<HTMLElement>);

  readonly lista = this.notificaciones.lista;
  readonly noLeidas = this.notificaciones.noLeidas;
  readonly permiso = this.notificaciones.permiso;
  readonly abierta = signal(false);

  alternar(): void {
    if (this.abierta()) {
      this.cerrar();
    } else {
      this.abierta.set(true);
    }
  }

  cerrar(): void {
    if (!this.abierta()) return;
    this.abierta.set(false);
    this.notificaciones.marcarLeidas();
  }

  activarSistema(): void {
    this.notificaciones.pedirPermiso();
  }


  @HostListener('document:click', ['$event'])
  alHacerClic(evento: MouseEvent): void {
    if (this.abierta() && !this.elemento.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  alEscape(): void {
    this.cerrar();
  }
}
