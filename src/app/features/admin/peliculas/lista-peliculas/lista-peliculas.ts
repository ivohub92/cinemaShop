import { Component, inject, OnInit, signal } from '@angular/core';
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

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar());
    this.cargando.set(false);
  }
}