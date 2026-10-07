import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../../funciones/funciones.service';
import { PeliculasService } from '../../../peliculas/peliculas.service';
import { Funcion } from '../../../../core/models/funcion';
import { Pelicula } from '../../../../core/models/pelicula';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';
import { PreciosService } from '../../../../core/services/precios.service';

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
  private readonly preciosService = inject(PreciosService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly funciones = signal<Funcion[]>([]);
  readonly diasElegidos = signal<number[]>([]);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly resultado = signal('');
  readonly conflictos = signal<string[]>([]);
  readonly errorListado = signal('');


  readonly editando = signal<Funcion | null>(null);
  readonly guardandoEdicion = signal(false);
  readonly errorEdicion = signal('');

  readonly edicion = this.fb.nonNullable.group({
    fecha: ['', Validators.required],
    hora: ['18:00', Validators.required],
    formato: ['2D', Validators.required],
    idioma: ['castellano', Validators.required],
    precioBase: [0, [Validators.required, Validators.min(0)]],
  });

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


  readonly hoy = new Date().toLocaleDateString('sv-SE');

  readonly formulario = this.fb.nonNullable.group({
    peliculaId: ['', Validators.required],
    hora: ['18:00', Validators.required],
    desde: ['', Validators.required],
    hasta: ['', Validators.required],
    formato: ['2D', Validators.required],
    idioma: ['castellano', Validators.required],
    precioBase: [6500, [Validators.required, Validators.min(0)]],
  });


  readonly recargos = this.fb.nonNullable.group({
    recargo3d: [0, [Validators.required, Validators.min(0)]],
    recargo4d: [0, [Validators.required, Validators.min(0)]],
    recargo5d: [0, [Validators.required, Validators.min(0)]],
    recargoVip: [0, [Validators.required, Validators.min(0)]],
  });
  readonly guardandoRecargos = signal(false);
  readonly mensajeRecargos = signal('');

  async ngOnInit(): Promise<void> {
    this.peliculas.set(await this.peliculasService.listar());
    this.funciones.set(await this.funcionesService.listar());
    this.recargos.setValue(await this.preciosService.recargos());
  }

  async guardarRecargos(): Promise<void> {
    if (this.recargos.invalid) {
      this.recargos.markAllAsTouched();
      return;
    }

    this.guardandoRecargos.set(true);
    this.mensajeRecargos.set('');

    try {
      await this.preciosService.guardarRecargos(this.recargos.getRawValue());
      this.mensajeRecargos.set('Recargos guardados. Se aplican a las compras que se hagan desde ahora.');
    } catch {
      this.mensajeRecargos.set('No pudimos guardar los recargos.');
    } finally {
      this.guardandoRecargos.set(false);
    }
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

    const { desde, hasta } = this.formulario.getRawValue();

    if (desde < this.hoy) {
      this.error.set('La fecha "desde" no puede ser anterior a hoy.');
      return;
    }

    if (hasta < desde) {
      this.error.set('La fecha "hasta" no puede ser anterior a "desde".');
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

  editar(funcion: Funcion): void {
    const inicio = new Date(funcion.inicio);

    this.edicion.setValue({
      fecha: inicio.toLocaleDateString('sv-SE'),   // 'YYYY-MM-DD' en hora local
      hora: inicio.toTimeString().slice(0, 5),
      formato: funcion.formato,
      idioma: funcion.idioma,
      precioBase: funcion.precioBase,
    });
    this.errorEdicion.set('');
    this.errorListado.set('');
    this.editando.set(funcion);

    setTimeout(() => document.querySelector('.edicion')?.scrollIntoView({ behavior: 'smooth' }));
  }

  cancelarEdicion(): void {
    this.editando.set(null);
  }

  async guardarEdicion(): Promise<void> {
    const funcion = this.editando();
    if (!funcion) return;

    if (this.edicion.invalid) {
      this.edicion.markAllAsTouched();
      return;
    }

    this.guardandoEdicion.set(true);
    this.errorEdicion.set('');

    try {
      const valores = this.edicion.getRawValue();
      await this.funcionesService.editar(funcion.id, {
        ...valores,
        formato: valores.formato as any,
        idioma: valores.idioma as any,
      });

      this.editando.set(null);
      this.funciones.set(await this.funcionesService.listar());
    } catch (e: any) {
      this.errorEdicion.set(e?.message ?? 'No pudimos guardar los cambios.');
    } finally {
      this.guardandoEdicion.set(false);
    }
  }

  async eliminar(funcion: Funcion): Promise<void> {
    if (!confirm(`¿Eliminar la función de "${funcion.peliculaTitulo}"?`)) return;

    this.errorListado.set('');

    try {
      await this.funcionesService.eliminar(funcion.id);
      if (this.editando()?.id === funcion.id) this.editando.set(null);
      this.funciones.set(await this.funcionesService.listar());
    } catch (e: any) {
      this.errorListado.set(e?.message ?? 'No pudimos eliminar la función.');
    }
  }
}