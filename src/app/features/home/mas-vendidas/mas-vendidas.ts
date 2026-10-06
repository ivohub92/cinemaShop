import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';

/** RF-09: las tres películas más vendidas, primero en la página principal. */
@Component({
  selector: 'app-mas-vendidas',
  imports: [TarjetaPelicula],
  templateUrl: './mas-vendidas.html',
  styleUrl: './mas-vendidas.scss',
})
export class MasVendidas implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  private readonly ranking = signal<{ peliculaId: string; entradas: number }[]>([]);
  private readonly peliculas = signal<Pelicula[]>([]);

  /**
   * El ranking trae solo ids; se cruza con las películas en cartel para
   * reusar la misma tarjeta de la cartelera. Mantiene el orden del ranking.
   */
  readonly destacadas = computed(() => {
    const porId = new Map(this.peliculas().map((p) => [p.id, p]));

    return this.ranking()
      .map((r, i) => ({ puesto: i + 1, entradas: r.entradas, pelicula: porId.get(r.peliculaId) }))
      .filter((d): d is { puesto: number; entradas: number; pelicula: Pelicula } => !!d.pelicula);
  });

  async ngOnInit(): Promise<void> {
    try {
      const [ranking, peliculas] = await Promise.all([
        this.peliculasService.masVendidas(3),
        this.peliculasService.listar('en-cartel'),
      ]);
      this.ranking.set(ranking);
      this.peliculas.set(peliculas);
    } catch {
 
    }
  }
}
