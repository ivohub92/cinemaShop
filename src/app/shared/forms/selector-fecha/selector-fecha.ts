import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** 'YYYY-MM-DD' de hoy en hora local (toISOString usaría UTC). */
function hoy(): string {
  return new Date().toLocaleDateString('sv-SE');
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

@Component({
  selector: 'app-selector-fecha',
  templateUrl: './selector-fecha.html',
  styleUrl: './selector-fecha.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorFecha),
      multi: true,
    },
  ],
})
export class SelectorFecha implements ControlValueAccessor {
  readonly dia = signal('');
  readonly mes = signal('');
  readonly anio = signal('');
  readonly deshabilitado = signal(false);

  readonly meses = MESES;

  protected readonly String = String;


  /** Solo fechas de hoy en adelante (atajo de minimo = hoy). */
  readonly futuro = input(false);

  /** Fecha mínima y máxima que se pueden elegir ('YYYY-MM-DD'). Vacío = sin límite. */
  readonly minimo = input('');
  readonly maximo = input('');

  private readonly limiteInferior = computed(() => this.minimo() || (this.futuro() ? hoy() : ''));

  readonly anios = computed(() => {
    const desde = this.limiteInferior();
    const hasta = this.maximo();

    if (desde) {
      const primero = Number(desde.slice(0, 4));
      const ultimo = hasta ? Number(hasta.slice(0, 4)) : primero + 9;
      return Array.from({ length: ultimo - primero + 1 }, (_, i) => primero + i);
    }

    const ultimo = hasta ? Number(hasta.slice(0, 4)) : new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => ultimo - i);
  });

  /** Meses del año elegido que caen dentro de los límites (1 = enero). */
  readonly mesesDisponibles = computed(() => {
    const anio = this.anio();
    let primero = 1, ultimo = 12;
    if (anio && this.limiteInferior().startsWith(anio)) primero = Number(this.limiteInferior().slice(5, 7));
    if (anio && this.maximo().startsWith(anio)) ultimo = Number(this.maximo().slice(5, 7));
    return Array.from({ length: ultimo - primero + 1 }, (_, i) => primero + i);
  });

  readonly dias = computed(() => {
    const mes = Number(this.mes());
    const anio = Number(this.anio());
    const cantidad = mes && anio ? new Date(anio, mes, 0).getDate() : 31;


    const elegido = mes && anio ? `${anio}-${String(mes).padStart(2, '0')}` : '';
    const primero = elegido && this.limiteInferior().startsWith(elegido) ? Number(this.limiteInferior().slice(8)) : 1;
    const ultimo = elegido && this.maximo().startsWith(elegido) ? Number(this.maximo().slice(8)) : cantidad;

    return Array.from({ length: ultimo - primero + 1 }, (_, i) => primero + i);
  });

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  cambiar(parte: 'dia' | 'mes' | 'anio', evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (parte === 'dia') this.dia.set(valor);
    if (parte === 'mes') this.mes.set(valor);
    if (parte === 'anio') this.anio.set(valor);


    if (this.mes() && !this.mesesDisponibles().includes(Number(this.mes()))) this.mes.set('');
    if (this.dia() && !this.dias().includes(Number(this.dia()))) this.dia.set('');

    this.alTocar();
    this.alCambiar(this.fechaCompleta());
  }

  private fechaCompleta(): string {
    const d = this.dia();
    const m = this.mes();
    const a = this.anio();
    if (!d || !m || !a) return '';
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }


  writeValue(valor: string | null): void {
    if (!valor) {
      this.dia.set('');
      this.mes.set('');
      this.anio.set('');
      return;
    }
    const [a, m, d] = valor.split('-');
    this.anio.set(a);
    this.mes.set(String(Number(m)));
    this.dia.set(String(Number(d)));
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}