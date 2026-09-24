import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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

  readonly anios = Array.from(
    { length: 100 },
    (_, i) => new Date().getFullYear() - i,
  );

  readonly dias = computed(() => {
    const mes = Number(this.mes());
    const anio = Number(this.anio());
    const cantidad = mes && anio ? new Date(anio, mes, 0).getDate() : 31;
    return Array.from({ length: cantidad }, (_, i) => i + 1);
  });

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  cambiar(parte: 'dia' | 'mes' | 'anio', evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (parte === 'dia') this.dia.set(valor);
    if (parte === 'mes') this.mes.set(valor);
    if (parte === 'anio') this.anio.set(valor);

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