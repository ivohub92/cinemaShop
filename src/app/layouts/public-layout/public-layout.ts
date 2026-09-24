import { Component, viewChild, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PanelLateral } from '../../shared/ui/panel-lateral/panel-lateral';
import { Ingreso } from '../../features/auth/ingreso/ingreso';
import { AuthService } from '../../core/auth/auth.service';

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
  readonly usuario = this.auth.usuario;

  async salir(): Promise<void> {
    await this.auth.salir();
  }
}