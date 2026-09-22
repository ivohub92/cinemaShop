import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';

@Component({
  selector: 'app-cartelera',
  imports:[TarjetaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.scss',
})
export class Cartelera implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.listar());
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }
  readonly busqueda = signal('');
  readonly generosActivos = signal<string[]>([]);

  readonly generosDisponibles = computed(() =>
    [...new Set(this.peliculas().flatMap((p) => p.generos))].sort((a, b) => a.localeCompare(b, 'es')),
  );

  readonly peliculasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const generos = this.generosActivos();

    return this.peliculas().filter((p) => {
      const coincideTitulo = !texto || p.titulo.toLowerCase().includes(texto);
      const coincideGenero = !generos.length || p.generos.some((g) => generos.includes(g));
      return coincideTitulo && coincideGenero;
    });
  });

  buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  filtrarPorGenero(genero: string): void {
    this.generosActivos.update((actuales) =>
      actuales.includes(genero)
        ? actuales.filter((g) => g !== genero)
        : [...actuales, genero],
    );
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.generosActivos.set([]);
  }

  readonly generosAbierto = signal(false);

  alternarGeneros(): void {
    this.generosAbierto.update((abierto) => !abierto);
  }
}