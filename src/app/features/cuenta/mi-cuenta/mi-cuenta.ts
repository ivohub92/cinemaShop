import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { CuentaService } from '../cuenta.service';
import { CuponesService } from '../../../core/services/cupones.service';
import { PuntosService } from '../../../core/services/puntos.service';
import { Cupon } from '../../../core/models/cupon';
import { Canje } from '../../../core/models/recompensa';
import { MisCompras } from '../mis-compras/mis-compras';

/**
 * Perfil del usuario (RF-05): datos, crédito, cupones, puntos,
 * historial de canjes e historial de compras en una sola pantalla.
 */
@Component({
  selector: 'app-mi-cuenta',
  imports: [CurrencyPipe, DatePipe, MisCompras],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.scss',
})
export class MiCuenta implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cuenta = inject(CuentaService);
  private readonly cuponesService = inject(CuponesService);
  private readonly puntosService = inject(PuntosService);

  readonly perfil = this.auth.perfil;

  readonly credito = signal(0);
  readonly puntos = signal(0);
  readonly cupones = signal<Cupon[]>([]);
  readonly canjes = signal<Canje[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      await this.recargarSaldos();
    } catch {
      this.error.set('No pudimos cargar los datos de tu cuenta.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** También se llama cuando se cancela una compra desde el historial de abajo. */
  async recargarSaldos(): Promise<void> {
    const [credito, puntos, cupones, canjes] = await Promise.all([
      this.cuenta.saldoCredito(),
      this.puntosService.misPuntos(),
      this.cuponesService.misCupones(),
      this.puntosService.misCanjes(),
    ]);

    this.credito.set(credito);
    this.puntos.set(puntos);
    this.cupones.set(cupones);
    this.canjes.set(canjes);
  }
}
