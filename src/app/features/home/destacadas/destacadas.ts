import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PeliculasService } from '../../peliculas/peliculas.service';
import { Pelicula } from '../../../core/models/pelicula';
import { TarjetaPelicula } from '../../peliculas/components/tarjeta-pelicula/tarjeta-pelicula';


@Component({
  selector: 'app-destacadas',
  imports: [TarjetaPelicula, DatePipe],
  templateUrl: './destacadas.html',
  styleUrl: './destacadas.scss',
})
export class Destacadas implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);


  readonly hoy = new Date().toLocaleDateString('sv-SE');

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.listar('portada'));
    } catch {

    }
  }
}
