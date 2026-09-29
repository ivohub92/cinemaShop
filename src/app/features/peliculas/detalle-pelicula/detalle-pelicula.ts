import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../peliculas.service';
import { FuncionesService } from '../../funciones/funciones.service';
import { Pelicula } from '../../../core/models/pelicula';
import { Funcion } from '../../../core/models/funcion';
import { ImagenRespaldo } from '../../../shared/directives/imagen-respaldo';
import { ReseniasPelicula } from '../resenias-pelicula/resenias-pelicula';
import { ReseniasService } from '../resenias.service';
import { PuntajePelicula } from '../../../core/models/resenia';
import { SelectorEstrellas } from '../../../shared/forms/selector-estrellas/selector-estrellas';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-detalle-pelicula',
  imports: [DatePipe, RouterLink, ImagenRespaldo, FormsModule, SelectorEstrellas, ReseniasPelicula],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.scss',
})
export class DetallePelicula implements OnInit {
  private readonly peliculasService = inject(PeliculasService);
  private readonly funcionesService = inject(FuncionesService);

  readonly id = input.required<string>();

  readonly pelicula = signal<(Pelicula & { sinopsis: string }) | null>(null);
  readonly funciones = signal<Funcion[]>([]);
  readonly cargando = signal(true);

    private readonly reseniasService = inject(ReseniasService);

  readonly puntaje = signal<PuntajePelicula>({ promedio: null, cantidad: 0 });

  /** Funciones agrupadas por día, para no listar 30 horarios seguidos. */
  readonly porDia = computed(() => {
    const grupos = new Map<string, Funcion[]>();

    for (const funcion of this.funciones()) {
      const dia = funcion.inicio.slice(0, 10);
      grupos.set(dia, [...(grupos.get(dia) ?? []), funcion]);
    }

    return [...grupos.entries()].map(([dia, funciones]) => ({ dia, funciones }));
  });

  async ngOnInit(): Promise<void> {
    const [pelicula, funciones, puntaje] = await Promise.all([
      this.peliculasService.obtener(this.id()),
      this.funcionesService.listar(this.id()),
      this.reseniasService.obtenerPuntaje(this.id()),
    ]);

    this.pelicula.set(pelicula);
    this.funciones.set(funciones);
    this.puntaje.set(puntaje);
    this.cargando.set(false);
  }
}