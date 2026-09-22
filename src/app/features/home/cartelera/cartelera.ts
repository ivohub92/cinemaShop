import { Component, computed, signal } from '@angular/core';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';

@Component({
  selector: 'app-cartelera',
  imports:[TarjetaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.scss',
})
export class Cartelera {
  readonly peliculas = signal<Pelicula[]>([
    { id: '1', titulo: 'Doble fondo', duracionMin: 112, generos: ['Policial', 'Suspenso'],
      posterUrl: 'https://placehold.co/400x600/271a45/e6e0f5?text=Doble+fondo', restriccionEdad: 13},
    { id: '2', titulo: 'Marea baja', duracionMin: 98, generos: ['Drama'],
      posterUrl: 'https://placehold.co/400x600/271a45/e6e0f5?text=Marea+baja',restriccionEdad: 0 },
    { id: '3', titulo: 'Órbita cero', duracionMin: 140, generos: ['Aventura', 'Ciencia ficción'],
      posterUrl: 'https://placehold.co/400x600/271a45/e6e0f5?text=Orbita+cero', restriccionEdad: 18 },
    
      
  ]);
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