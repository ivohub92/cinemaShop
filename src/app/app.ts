import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly actualizaciones = inject(SwUpdate);

  constructor() {
    
    this.actualizaciones.versionUpdates.subscribe((evento) => {
      if (evento.type === 'VERSION_READY' && confirm('Hay una versión nueva. ¿Actualizar?')) {
        document.location.reload();
      }
    });
  }
}