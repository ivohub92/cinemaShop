import { Component, computed, inject, input, OnInit, signal  } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ReseniasService } from '../resenias.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Resenia, PuntajePelicula } from '../../../core/models/resenia';
import { SelectorEstrellas } from '../../../shared/forms/selector-estrellas/selector-estrellas';
import { TiempoRelativoPipe } from '../../../shared/pipes/tiempo-relativo-pipe';

@Component({
  selector: 'app-resenias-pelicula',
  imports: [ReactiveFormsModule, SelectorEstrellas, TiempoRelativoPipe, FormsModule],
  templateUrl: './resenias-pelicula.html',
  styleUrl: './resenias-pelicula.scss',
})
export class ReseniasPelicula implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reseniasService = inject(ReseniasService);
  private readonly auth = inject(AuthService);

  readonly peliculaId = input.required<string>();

  readonly resenias = signal<Resenia[]>([]);
  readonly puntaje = signal<PuntajePelicula>({ promedio: null, cantidad: 0 });
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly perfil = this.auth.perfil;
  readonly esCliente = this.auth.esCliente;


  readonly propia = computed(() =>
    this.resenias().find((r) => r.usuarioId === this.perfil()?.id) ?? null,
  );

  readonly formulario = this.fb.nonNullable.group({
    puntaje: [0, [Validators.required, Validators.min(1)]],
    comentario: ['', Validators.maxLength(500)],
  });

  async ngOnInit(): Promise<void> {
    await this.recargar();
    this.cargando.set(false);
  }

  private async recargar(): Promise<void> {
    const [resenias, puntaje] = await Promise.all([
      this.reseniasService.listar(this.peliculaId()),
      this.reseniasService.obtenerPuntaje(this.peliculaId()),
    ]);

    this.resenias.set(resenias);
    this.puntaje.set(puntaje);


    const propia = this.propia();
    if (propia) {
      this.formulario.patchValue({ puntaje: propia.puntaje, comentario: propia.comentario });
    }
  }

  async enviar(): Promise<void> {
    const usuarioId = this.perfil()?.id;
    if (!usuarioId) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Elegí una calificación con las estrellas.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      const { puntaje, comentario } = this.formulario.getRawValue();
      await this.reseniasService.guardar(this.peliculaId(), usuarioId, puntaje, comentario);
      await this.recargar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar tu reseña.');
    } finally {
      this.enviando.set(false);
    }
  }

  async eliminar(): Promise<void> {
    const propia = this.propia();
    if (!propia || !confirm('¿Eliminar tu reseña?')) return;

    await this.reseniasService.eliminar(propia.id);
    this.formulario.reset({ puntaje: 0, comentario: '' });
    await this.recargar();
  }
}