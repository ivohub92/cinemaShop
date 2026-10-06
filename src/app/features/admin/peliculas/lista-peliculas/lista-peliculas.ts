import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../../peliculas/peliculas.service';
import { Pelicula } from '../../../../core/models/pelicula';

@Component({
  selector: 'app-lista-peliculas',
  imports: [RouterLink],
  templateUrl: './lista-peliculas.html',
  styleUrl: './lista-peliculas.scss',
})
export class ListaPeliculas implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  /** Cuántas se ven hoy en la portada (las destacadas que siguen activas). */
  readonly enPortada = computed(() => this.peliculas().filter((p) => p.enPortada && p.activa).length);

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar());
    this.cargando.set(false);
  }
  async cambiarEstado(pelicula: Pelicula): Promise<void> {
    if (pelicula.activa && !confirm(`¿Dar de baja "${pelicula.titulo}"?`)) return;

    if (pelicula.activa) {
      await this.peliculasService.darDeBaja(pelicula.id);
    } else {
      await this.peliculasService.reactivar(pelicula.id);
    }

    this.peliculas.set(await this.peliculasService.listar());
  }

  /** RF-12: destacar o quitar de la página principal. */
  async cambiarPortada(pelicula: Pelicula): Promise<void> {
    this.error.set('');

    try {
      await this.peliculasService.cambiarPortada(pelicula.id, !pelicula.enPortada);
      this.peliculas.update((lista) =>
        lista.map((p) => (p.id === pelicula.id ? { ...p, enPortada: !p.enPortada } : p)),
      );
    } catch {
      this.error.set(`No pudimos cambiar la portada de "${pelicula.titulo}".`);
    }
  }
}
