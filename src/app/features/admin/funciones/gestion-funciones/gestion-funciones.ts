import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../../funciones/funciones.service';
import { PeliculasService } from '../../../peliculas/peliculas.service';
import { Funcion } from '../../../../core/models/funcion';
import { Pelicula } from '../../../../core/models/pelicula';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';

@Component({
  selector: 'app-gestion-funciones',
  imports: [ReactiveFormsModule, SelectorFecha, DatePipe],
  templateUrl: './gestion-funciones.html',
  styleUrl: './gestion-funciones.scss',
})
export class GestionFunciones implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly funcionesService = inject(FuncionesService);
  private readonly peliculasService = inject(PeliculasService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly funciones = signal<Funcion[]>([]);
  readonly diasElegidos = signal<number[]>([]);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly resultado = signal('');
  readonly conflictos = signal<string[]>([]);

  readonly dias = [
    { valor: 1, nombre: 'Lunes' },
    { valor: 2, nombre: 'Martes' },
    { valor: 3, nombre: 'Miércoles' },
    { valor: 4, nombre: 'Jueves' },
    { valor: 5, nombre: 'Viernes' },
    { valor: 6, nombre: 'Sábado' },
    { valor: 0, nombre: 'Domingo' },
  ];

  readonly horas = Array.from({ length: 17 }, (_, i) => {
    const hora = 8 + i;
    return `${String(hora).padStart(2, '0')}:00`;
  });

  readonly formulario = this.fb.nonNullable.group({
    peliculaId: ['', Validators.required],
    hora: ['18:00', Validators.required],
    desde: ['', Validators.required],
    hasta: ['', Validators.required],
    formato: ['2D', Validators.required],
    idioma: ['castellano', Validators.required],
    precioBase: [6500, [Validators.required, Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar());
    this.funciones.set(await this.funcionesService.listar());
  }

  alternarDia(valor: number): void {
    this.diasElegidos.update((actuales) =>
      actuales.includes(valor) ? actuales.filter((d) => d !== valor) : [...actuales, valor],
    );
  }

  async programar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (!this.diasElegidos().length) {
      this.error.set('Elegí al menos un día de la semana.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');
    this.resultado.set('');
    this.conflictos.set([]);

    try {
      const valores = this.formulario.getRawValue();
      const { creadas, conflictos } = await this.funcionesService.programar({
        ...valores,
        formato: valores.formato as any,
        idioma: valores.idioma as any,
        diasSemana: this.diasElegidos(),
      });

      this.resultado.set(
        creadas === 1 ? 'Se programó 1 función.' : `Se programaron ${creadas} funciones.`,
      );
      this.conflictos.set(conflictos);
      this.funciones.set(await this.funcionesService.listar());
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos programar las funciones.');
    } finally {
      this.enviando.set(false);
    }
  }

  async eliminar(funcion: Funcion): Promise<void> {
    if (!confirm(`¿Eliminar la función de "${funcion.peliculaTitulo}"?`)) return;

    await this.funcionesService.eliminar(funcion.id);
    this.funciones.set(await this.funcionesService.listar());
  }
}