import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReseniasService } from '../../peliculas/resenias.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PeliculaVista, Resenia } from '../../../core/models/resenia';
import { SelectorEstrellas } from '../../../shared/forms/selector-estrellas/selector-estrellas';
import { ImagenRespaldo } from '../../../shared/directives/imagen-respaldo';

@Component({
  selector: 'app-mis-peliculas',
  imports: [DatePipe, FormsModule, RouterLink, SelectorEstrellas, ImagenRespaldo],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.scss',
})
export class MisPeliculas implements OnInit {
  private readonly reseniasService = inject(ReseniasService);
  private readonly auth = inject(AuthService);

  readonly peliculas = signal<PeliculaVista[]>([]);
  readonly resenias = signal<Resenia[]>([]);
  readonly cargando = signal(true);


  readonly calificando = signal<string | null>(null);
  readonly puntaje = signal(0);
  readonly comentario = signal('');
  readonly guardando = signal(false);


  readonly historial = computed(() =>
    this.peliculas().map((pelicula) => ({
      ...pelicula,
      resenia: this.resenias().find((r) => r.peliculaId === pelicula.peliculaId) ?? null,
    })),
  );

  readonly sinCalificar = computed(() => this.historial().filter((p) => !p.resenia).length);

  async ngOnInit(): Promise<void> {
    await this.recargar();
    this.cargando.set(false);
  }

  private async recargar(): Promise<void> {
    const usuarioId = this.auth.perfil()?.id;
    if (!usuarioId) return;

    const [peliculas, resenias] = await Promise.all([
      this.reseniasService.misPeliculas(usuarioId),
      this.reseniasService.misResenias(usuarioId),
    ]);

    this.peliculas.set(peliculas);
    this.resenias.set(resenias);
  }

  abrirFormulario(peliculaId: string, resenia: Resenia | null): void {
    this.calificando.set(peliculaId);
    this.puntaje.set(resenia?.puntaje ?? 0);
    this.comentario.set(resenia?.comentario ?? '');
  }

  cerrarFormulario(): void {
    this.calificando.set(null);
  }

  async guardar(peliculaId: string): Promise<void> {
    const usuarioId = this.auth.perfil()?.id;
    if (!usuarioId || !this.puntaje()) return;

    this.guardando.set(true);

    try {
      await this.reseniasService.guardar(peliculaId, usuarioId, this.puntaje(), this.comentario());
      await this.recargar();
      this.cerrarFormulario();
    } finally {
      this.guardando.set(false);
    }
  }
}