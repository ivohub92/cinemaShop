import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FuncionesService } from '../../funciones/funciones.service';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Funcion } from '../../../core/models/funcion';
import { MapaButacas } from '../mapa-butacas/mapa-butacas';
import { PasoIdentidad } from '../paso-identidad/paso-identidad';
import { CompraStore } from './compra.store';
import { PasoPago } from '../paso-pago/paso-pago';
import { PasoConfirmacion } from '../paso-confirmacion/paso-confirmacion';
import { PasoCandy } from '../paso-candy/paso-candy';
@Component({

  selector: 'app-compra',
  imports: [DatePipe, RouterLink, MapaButacas, PasoIdentidad, PasoCandy, PasoPago, PasoConfirmacion],
  templateUrl: './compra.html',
  styleUrl: './compra.scss',

  // El store se crea con esta pantalla y muere con ella cada compra arranca limpia, sin arrastrar datos de una anterior
  providers: [CompraStore],
})
export class Compra implements OnInit {
  private readonly funcionesService = inject(FuncionesService);
  private readonly peliculasService = inject(PeliculasService);
  private readonly auth = inject(AuthService);
  readonly store = inject(CompraStore);
  readonly funcionId = input.required<string>();
  readonly funcion = signal<Funcion | null>(null);
  readonly restriccionEdad = signal(0);
  readonly cargando = signal(true);
  readonly ordenId = signal<string | null>(null);
  readonly pagada = signal(false);
  /** Butacas elegidas: se muestra el candy antes de reservar */
  readonly eligiendoCandy = signal(false);

  alPagar(): void {
    this.pagada.set(true);
  }

  alElegirButacas(): void {
    this.eligiendoCandy.set(true);
  }

  alVolverAButacas(): void {
    this.eligiendoCandy.set(false);
  }

  alReservar(id: string): void {
    this.eligiendoCandy.set(false);
    this.ordenId.set(id);
  }
  constructor() {
    // Si se cierra la sesión en medio de la compra, se vuelve al primer paso: las butacas elegidas ya no tienen titular
    effect(() => {
      const usuario = this.auth.usuario();
      const comprador = this.store.comprador();

      if (!usuario && comprador?.usuarioId) {
        this.store.reiniciar();
        this.eligiendoCandy.set(false);
      }
    });
  }

  /** Impide avanzar si el comprador no alcanza la edad mínima de la película */
  readonly edadInsuficiente = computed(() => {
    const edad = this.store.edad();
    return edad !== null && edad < this.restriccionEdad();
  });

  readonly identidadResuelta = computed(() => !!this.store.comprador());

  async ngOnInit(): Promise<void> {
    const funciones = await this.funcionesService.listar();
    const funcion = funciones.find((f) => f.id === this.funcionId()) ?? null;
    this.funcion.set(funcion);

    if (funcion) {
      const pelicula = await this.peliculasService.obtener(funcion.peliculaId);
      this.restriccionEdad.set(pelicula?.restriccionEdad ?? 0);
    }

    // Si ya hay sesión iniciada, no se pide identidad de nuevo
    this.store.tomarDeLaSesion();
    this.cargando.set(false);
  }

  volverAIdentidad(): void {
    this.store.reiniciar();
    this.eligiendoCandy.set(false);
  }
}