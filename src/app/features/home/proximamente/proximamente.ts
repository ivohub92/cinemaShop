import { Component, inject, OnInit, signal } from '@angular/core';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';

@Component({
  selector: 'app-proximamente',
  imports: [TarjetaPelicula],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.scss',
})
export class Proximamente implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly cargando = signal(true);

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar('proximamente'));
    this.cargando.set(false);
  }
}