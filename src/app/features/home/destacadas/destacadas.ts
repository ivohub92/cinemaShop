import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';

/** RF-12: las películas que el admin eligió para la página principal. */
@Component({
  selector: 'app-destacadas',
  imports: [TarjetaPelicula, DatePipe],
  templateUrl: './destacadas.html',
  styleUrl: './destacadas.scss',
})
export class Destacadas implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);

  /** 'YYYY-MM-DD' de hoy, para saber cuáles todavía no se estrenaron. */
  readonly hoy = new Date().toLocaleDateString('sv-SE');

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.listar('portada'));
    } catch {
      // Si falla, la sección no se muestra: el resto de la portada sigue funcionando.
    }
  }
}
