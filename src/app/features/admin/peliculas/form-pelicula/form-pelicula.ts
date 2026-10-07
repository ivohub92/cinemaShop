import { Component, inject, OnInit, signal, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService } from '../../../peliculas/peliculas.service';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';
import { ImagenRespaldo } from '../../../../shared/directives/imagen-respaldo';


@Component({
  selector: 'app-form-pelicula',
  imports: [ReactiveFormsModule, SelectorFecha, ImagenRespaldo],
  templateUrl: './form-pelicula.html',
  styleUrl: './form-pelicula.scss',
})
export class FormPelicula implements OnInit {
  
  readonly id = input<string>('');
  readonly editando = signal(false);
  private readonly fb = inject(FormBuilder);
  private readonly peliculasService = inject(PeliculasService);
  private readonly router = inject(Router);

  readonly generos = signal<{ id: string; nombre: string }[]>([]);
  readonly generosElegidos = signal<string[]>([]);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly subiendoPoster = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    sinopsis: ['', Validators.required],
    duracionMin: [90, [Validators.required, Validators.min(1), Validators.max(400)]],
    posterUrl: [''],
    restriccionEdad: [0, Validators.required],
    fechaEstreno: ['', Validators.required],

    preventa: [false],
    precioPreventa: [5000, [Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    this.generos.set(await this.peliculasService.listarGeneros());

    const id = this.id();
    if (!id) return;

    const pelicula = await this.peliculasService.obtener(id);
    if (!pelicula) return;

    this.editando.set(true);
    this.formulario.patchValue({
      titulo: pelicula.titulo,
      sinopsis: pelicula.sinopsis,
      duracionMin: pelicula.duracionMin,
      posterUrl: pelicula.posterUrl,
      restriccionEdad: pelicula.restriccionEdad,
      fechaEstreno: pelicula.fechaEstreno,
      preventa: pelicula.precioPreventa !== null,
      precioPreventa: pelicula.precioPreventa ?? 5000,
    });
    this.generosElegidos.set(pelicula.generosIds);
  }

  /** Sube la imagen elegida y pone su URL pública en el campo del póster. */
  async elegirPoster(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) return;

    this.subiendoPoster.set(true);
    this.error.set('');

    try {
      const url = await this.peliculasService.subirPoster(archivo);
      this.formulario.controls.posterUrl.setValue(url);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos subir el póster.');
    } finally {
      this.subiendoPoster.set(false);
      entrada.value = '';   // permite volver a elegir el mismo archivo
    }
  }

  alternarGenero(id: string): void {
    this.generosElegidos.update((actuales) =>
      actuales.includes(id) ? actuales.filter((g) => g !== id) : [...actuales, id],
    );
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (!this.generosElegidos().length) {
      this.error.set('Elegí al menos un género.');
      return;
    }

    if (this.subiendoPoster()) {
      this.error.set('Esperá a que termine de subirse el póster.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');

   try {
      const { preventa, precioPreventa, ...valores } = this.formulario.getRawValue();
      const datos = {
        ...valores,
        restriccionEdad: Number(valores.restriccionEdad),
        precioPreventa: preventa ? Number(precioPreventa) : null,
        generosIds: this.generosElegidos(),
      };

      if (this.editando()) {
        await this.peliculasService.actualizar(this.id(), datos);
      } else {
        await this.peliculasService.crear(datos);
      }

      this.router.navigate(['/admin/peliculas']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar la película.');
    } finally {
      this.enviando.set(false);
    }
  
  }
}