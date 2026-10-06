import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';

@Component({
  selector: 'app-proximamente',
  imports: [TarjetaPelicula, RouterLink],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.scss',
})
export class Proximamente implements OnInit {
  private readonly peliculasService = inject(PeliculasService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly cargando = signal(true);

  /** RF-14: las alertas son solo para usuarios registrados (D-01). */
  readonly usuario = inject(AuthService).usuario;
  readonly alertas = this.notificaciones.alertas;
  readonly permiso = this.notificaciones.permiso;

  /** Película cuya alerta se está guardando (para deshabilitar su botón). */
  readonly guardando = signal<string | null>(null);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar('proximamente'));
    this.cargando.set(false);
  }

  async alternarAlerta(pelicula: Pelicula): Promise<void> {
    this.guardando.set(pelicula.id);
    this.error.set('');

    try {
      if (this.alertas().has(pelicula.id)) {
        await this.notificaciones.quitarAlerta(pelicula.id);
      } else {
        await this.notificaciones.activarAlerta(pelicula.id);
      }
    } catch {
      this.error.set(`No pudimos guardar la alerta de "${pelicula.titulo}". Probá de nuevo.`);
    } finally {
      this.guardando.set(null);
    }
  }
}
