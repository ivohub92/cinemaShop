import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService } from '../../../peliculas/peliculas.service';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';

@Component({
  selector: 'app-form-pelicula',
  imports: [ReactiveFormsModule, SelectorFecha],
  templateUrl: './form-pelicula.html',
  styleUrl: './form-pelicula.scss',
})
export class FormPelicula implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly peliculasService = inject(PeliculasService);
  private readonly router = inject(Router);

  readonly generos = signal<{ id: string; nombre: string }[]>([]);
  readonly generosElegidos = signal<string[]>([]);
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    sinopsis: ['', Validators.required],
    duracionMin: [90, [Validators.required, Validators.min(1), Validators.max(400)]],
    posterUrl: [''],
    restriccionEdad: [0, Validators.required],
    fechaEstreno: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    this.generos.set(await this.peliculasService.listarGeneros());
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

    this.enviando.set(true);
    this.error.set('');

    try {
      await this.peliculasService.crear({
        ...this.formulario.getRawValue(),
        restriccionEdad: Number(this.formulario.getRawValue().restriccionEdad),
        generosIds: this.generosElegidos(),
      });
      this.router.navigate(['/admin/peliculas']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar la película.');
    } finally {
      this.enviando.set(false);
    }
  }
}