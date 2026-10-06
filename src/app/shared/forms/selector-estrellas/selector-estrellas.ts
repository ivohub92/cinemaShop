import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';


@Component({
  selector: 'app-selector-estrellas',
  templateUrl: './selector-estrellas.html',
  styleUrl: './selector-estrellas.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorEstrellas),
      multi: true,
    },
  ],
})
export class SelectorEstrellas implements ControlValueAccessor {

  readonly soloLectura = input(false);

  readonly valor = signal(0);
  readonly previsualizado = signal(0);
  readonly deshabilitado = signal(false);

  readonly estrellas = [1, 2, 3, 4, 5];

  private alCambiar: (valor: number) => void = () => {};
  private alTocar: () => void = () => {};

  activas(): number {
    return this.previsualizado() || this.valor();
  }

  elegir(puntaje: number): void {
    if (this.soloLectura() || this.deshabilitado()) return;

    this.valor.set(puntaje);
    this.alTocar();
    this.alCambiar(puntaje);
  }

  previsualizar(puntaje: number): void {
    if (this.soloLectura() || this.deshabilitado()) return;
    this.previsualizado.set(puntaje);
  }

  limpiarPrevisualizacion(): void {
    this.previsualizado.set(0);
  }



  writeValue(valor: number | null): void {
    this.valor.set(valor ?? 0);
  }

  registerOnChange(fn: (valor: number) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}