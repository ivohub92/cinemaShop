import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PuntosService } from '../../../../core/services/puntos.service';
import { ProductosService } from '../../../compra/productos.service';
import { Recompensa, TipoRecompensa } from '../../../../core/models/recompensa';
import { Producto } from '../../../../core/models/producto';

@Component({
  selector: 'app-gestion-recompensas',
  imports: [ReactiveFormsModule],
  templateUrl: './gestion-recompensas.html',
  styleUrl: './gestion-recompensas.scss',
})
export class GestionRecompensas implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly puntosService = inject(PuntosService);
  private readonly productosService = inject(ProductosService);

  readonly recompensas = signal<Recompensa[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    tipo: ['entrada' as TipoRecompensa, Validators.required],
    productoId: [''],
    costoPuntos: [100000, [Validators.required, Validators.min(1)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      const [recompensas, productos] = await Promise.all([
        this.puntosService.listarRecompensas(false),
        this.productosService.listar(),
      ]);
      this.recompensas.set(recompensas);
      this.productos.set(productos);
    } catch {
      this.error.set('No pudimos cargar las recompensas.');
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(): Promise<void> {
    const datos = this.formulario.getRawValue();

    if (this.formulario.invalid || (datos.tipo === 'producto' && !datos.productoId)) {
      this.formulario.markAllAsTouched();
      this.error.set(datos.tipo === 'producto' && !datos.productoId ? 'Elegí el producto.' : '');
      return;
    }

    this.creando.set(true);
    this.error.set('');

    try {
      await this.puntosService.crear({
        nombre: datos.nombre,
        tipo: datos.tipo,
        productoId: datos.productoId || null,
        costoPuntos: Number(datos.costoPuntos),
      });
      this.formulario.reset();
      this.recompensas.set(await this.puntosService.listarRecompensas(false));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos crear la recompensa.');
    } finally {
      this.creando.set(false);
    }
  }

  async guardarCosto(recompensa: Recompensa, campo: HTMLInputElement): Promise<void> {
    const costo = Math.floor(Number(campo.value));
    if (!costo || costo < 1 || costo === recompensa.costoPuntos) return;

    this.error.set('');
    this.aviso.set('');

    try {
      await this.puntosService.cambiarCosto(recompensa.id, costo);
      this.recompensas.update((actuales) =>
        actuales.map((r) => (r.id === recompensa.id ? { ...r, costoPuntos: costo } : r)),
      );
      this.aviso.set(`"${recompensa.nombre}" ahora cuesta ${costo.toLocaleString('es-AR')} puntos.`);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar el costo.');
    }
  }

  async cambiarEstado(recompensa: Recompensa): Promise<void> {
    await this.puntosService.cambiarActivo(recompensa.id, !recompensa.activo);
    this.recompensas.update((actuales) =>
      actuales.map((r) => (r.id === recompensa.id ? { ...r, activo: !r.activo } : r)),
    );
  }
}
