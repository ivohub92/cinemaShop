import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductosService } from '../../../compra/productos.service';
import { Producto } from '../../../../core/models/producto';

@Component({
  selector: 'app-form-combo',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './form-combo.html',
  styleUrl: './form-combo.scss',
})
export class FormCombo implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);

  readonly id = input<string>('');

  readonly productos = signal<Producto[]>([]);
  /** productoId → cantidad dentro del combo. Si no está, no se incluye. */
  readonly cantidades = signal<Record<string, number>>({});
  readonly editando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagenUrl: [''],
    destacado: [true],
  });

  /** Lo que costarían los productos comprados sueltos: referencia para fijar el precio. */
  readonly valorSuelto = computed(() =>
    this.productos().reduce((suma, p) => suma + p.precio * (this.cantidades()[p.id] ?? 0), 0),
  );

  async ngOnInit(): Promise<void> {
    this.productos.set(await this.productosService.listar());

    const id = this.id();
    if (!id) return;

    const combo = await this.productosService.obtenerCombo(id);
    if (!combo) return;

    this.editando.set(true);
    this.formulario.patchValue(combo);
    this.cantidades.set(Object.fromEntries(combo.items.map((i) => [i.productoId, i.cantidad])));
  }

  cantidadDe(productoId: string): number {
    return this.cantidades()[productoId] ?? 0;
  }

  cambiarCantidad(productoId: string, valor: string | number): void {
    const cantidad = Math.max(0, Math.floor(Number(valor) || 0));

    this.cantidades.update((actuales) => {
      const copia = { ...actuales };
      if (cantidad > 0) copia[productoId] = cantidad;
      else delete copia[productoId];
      return copia;
    });
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const items = Object.entries(this.cantidades()).map(([productoId, cantidad]) => ({ productoId, cantidad }));

    if (!items.length) {
      this.error.set('Elegí al menos un producto para el combo.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      const datos = {
        ...this.formulario.getRawValue(),
        precio: Number(this.formulario.getRawValue().precio),
        items,
      };

      if (this.editando()) {
        await this.productosService.actualizarCombo(this.id(), datos);
      } else {
        await this.productosService.crearCombo(datos);
      }

      this.router.navigate(['/admin/candy']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar el combo.');
    } finally {
      this.enviando.set(false);
    }
  }
}
