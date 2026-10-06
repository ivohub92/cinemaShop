import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductosService } from '../../../compra/productos.service';
import { CategoriaProducto } from '../../../../core/models/producto';

@Component({
  selector: 'app-form-producto',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './form-producto.html',
  styleUrl: './form-producto.scss',
})
export class FormProducto implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);


  readonly id = input<string>('');

  readonly categorias = signal<CategoriaProducto[]>([]);
  readonly editando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagenUrl: [''],
    categoriaId: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    this.categorias.set(await this.productosService.listarCategorias());

    const id = this.id();
    if (!id) return;

    const producto = await this.productosService.obtener(id);
    if (!producto) return;

    this.editando.set(true);
    this.formulario.patchValue(producto);
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    try {
      const datos = {
        ...this.formulario.getRawValue(),
        precio: Number(this.formulario.getRawValue().precio),
      };

      if (this.editando()) {
        await this.productosService.actualizar(this.id(), datos);
      } else {
        await this.productosService.crear(datos);
      }

      this.router.navigate(['/admin/candy']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar el producto.');
    } finally {
      this.enviando.set(false);
    }
  }
}
