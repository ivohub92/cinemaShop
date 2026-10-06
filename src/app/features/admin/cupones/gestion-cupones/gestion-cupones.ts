import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CuponesService } from '../../../../core/services/cupones.service';
import { Cupon } from '../../../../core/models/cupon';
import { SelectorFecha } from '../../../../shared/forms/selector-fecha/selector-fecha';

@Component({
  selector: 'app-gestion-cupones',
  imports: [ReactiveFormsModule, DatePipe, SelectorFecha],
  templateUrl: './gestion-cupones.html',
  styleUrl: './gestion-cupones.scss',
})
export class GestionCupones implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cuponesService = inject(CuponesService);

  readonly cupones = signal<Cupon[]>([]);
  readonly cargando = signal(true);
  readonly guardandoPct = signal(false);
  readonly creando = signal(false);
  readonly mensajePct = signal('');
  readonly error = signal('');

  /** RF-41: porcentaje del cupón de bienvenida. */
  readonly formBienvenida = this.fb.nonNullable.group({
    porcentaje: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
  });

  /** RF-42: cupón para mayores de 50. El código va en mayúsculas, sin espacios. */
  readonly formCupon = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{3,20}$/)]],
    porcentaje: [15, [Validators.required, Validators.min(1), Validators.max(100)]],
    venceEn: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const [pct, cupones] = await Promise.all([
        this.cuponesService.porcentajeBienvenida(),
        this.cuponesService.listarMayores50(),
      ]);
      this.formBienvenida.setValue({ porcentaje: pct });
      this.cupones.set(cupones);
    } catch {
      this.error.set('No pudimos cargar los cupones.');
    } finally {
      this.cargando.set(false);
    }
  }

  async guardarPorcentaje(): Promise<void> {
    if (this.formBienvenida.invalid) {
      this.formBienvenida.markAllAsTouched();
      return;
    }

    this.guardandoPct.set(true);
    this.mensajePct.set('');
    this.error.set('');

    try {
      await this.cuponesService.guardarPorcentajeBienvenida(
        Number(this.formBienvenida.getRawValue().porcentaje),
      );
      this.mensajePct.set('Guardado. Se aplica a los usuarios que se registren desde ahora.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos guardar el porcentaje.');
    } finally {
      this.guardandoPct.set(false);
    }
  }

  async crearCupon(): Promise<void> {
    if (this.formCupon.invalid) {
      this.formCupon.markAllAsTouched();
      return;
    }

    this.creando.set(true);
    this.error.set('');

    try {
      const { codigo, porcentaje, venceEn } = this.formCupon.getRawValue();
      await this.cuponesService.crear({ codigo, porcentaje: Number(porcentaje), venceEn: venceEn || null });
      this.formCupon.reset();
      this.cupones.set(await this.cuponesService.listarMayores50());
    } catch (e: any) {
      // 23505 = unique_violation: ya existe un cupón con ese código.
      this.error.set(e?.code === '23505' ? 'Ya existe un cupón con ese código.' : 'No pudimos crear el cupón.');
    } finally {
      this.creando.set(false);
    }
  }

  async cambiarEstado(cupon: Cupon): Promise<void> {
    await this.cuponesService.cambiarActivo(cupon.id, !cupon.activo);
    this.cupones.update((actuales) =>
      actuales.map((c) => (c.id === cupon.id ? { ...c, activo: !c.activo } : c)),
    );
  }

  vencido(cupon: Cupon): boolean {
    return !!cupon.venceEn && cupon.venceEn < new Date().toISOString().slice(0, 10);
  }
}
