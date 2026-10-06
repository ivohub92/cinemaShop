import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PanelLateral } from '../../shared/ui/panel-lateral/panel-lateral';
import { Ingreso } from '../../features/auth/ingreso/ingreso';
import { AuthService } from '../../core/auth/auth.service';
import { CuponesService } from '../../core/services/cupones.service';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, PanelLateral, Ingreso],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayout {
  readonly anio = new Date().getFullYear();
  readonly panel = viewChild.required(PanelLateral);
  private readonly auth = inject(AuthService);
  readonly perfil = this.auth.perfil;
  readonly usuario = this.auth.usuario;

  private readonly cuponesService = inject(CuponesService);

  /** El cupón que se avisa: el de mayor descuento (vienen ordenados así). */
  readonly cupon = computed(() => this.cuponesService.disponibles()[0] ?? null);

  /** Para invitar a registrarse a quien todavía no tiene cuenta (RF-04). */
  readonly porcentajeBienvenida = signal<number | null>(null);

  /** El aviso se puede cerrar; vuelve a aparecer en la próxima visita. */
  readonly avisoCerrado = signal(false);

  constructor() {
    // Cada vez que cambia la sesión (ingreso o salida) se recalculan los cupones.
    effect(() => {
      if (this.perfil()) {
        this.cuponesService.refrescarDisponibles();
      } else {
        this.cuponesService.disponibles.set([]);
      }
    });

    this.cuponesService
      .porcentajeBienvenida()
      .then((pct) => this.porcentajeBienvenida.set(pct))
      .catch(() => {});
  }

  async salir(): Promise<void> {
    await this.auth.salir();
  }
}