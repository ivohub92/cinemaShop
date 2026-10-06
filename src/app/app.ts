import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly actualizaciones = inject(SwUpdate);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.actualizaciones.versionUpdates.subscribe((evento) => {
      if (evento.type === 'VERSION_READY' && confirm('Hay una versión nueva. ¿Actualizar?')) {
        document.location.reload();
      }
    });

    let habiaSesion = false;
    effect(() => {
      const haySesion = !!this.auth.usuario();

      if (habiaSesion && !haySesion) {
        this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
      }

      habiaSesion = haySesion;
    });
  }
}
