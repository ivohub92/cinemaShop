import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { Pelicula } from '../../../../core/models/pelicula';
import { PosterHover } from '../../../../shared/directives/poster-hover';

@Component({
  selector: 'app-tarjeta-pelicula',
  imports: [NgClass, PosterHover],
  templateUrl: './tarjeta-pelicula.html',
  styleUrl: './tarjeta-pelicula.scss',
})
export class TarjetaPelicula {
  readonly pelicula = input.required<Pelicula>();

  etiquetaEdad(): string {
    const edad = this.pelicula().restriccionEdad;
    return edad === 0 ? 'ATP' : `+${edad}`;
  }
}