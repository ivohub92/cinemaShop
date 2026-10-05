import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service'; 
import { ComboElegido, ItemCarrito } from '../../../core/models/producto';

export type PasoCompra = 'identidad' | 'butacas' | 'pago';

export interface Comprador {
  email: string;
  fechaNacimiento: string;
  usuarioId: string | null;
}

@Injectable()
export class CompraStore {
  private readonly auth = inject(AuthService);

  readonly comprador = signal<Comprador | null>(null);
  readonly butacas = signal<string[]>([]);

  readonly paso = computed<PasoCompra>(() => {
    if (!this.comprador()) return 'identidad';
    if (!this.butacas().length) return 'butacas';
    return 'butacas';
  });

  /** Edad del comprador al día de hoy, para la restricción por película. */
  readonly edad = computed(() => {
    const nacimiento = this.comprador()?.fechaNacimiento;
    if (!nacimiento) return null;

    const hoy = new Date();
    const fecha = new Date(nacimiento);
    let edad = hoy.getFullYear() - fecha.getFullYear();

    const cumplioEsteAnio =
      hoy.getMonth() > fecha.getMonth() ||
      (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());

    if (!cumplioEsteAnio) edad--;
    return edad;
  });

  /** Si hay sesión, la identidad ya está resuelta */
  tomarDeLaSesion(): boolean {
    const perfil = this.auth.perfil();
    if (!perfil) return false;

    this.comprador.set({
      email: perfil.email,
      fechaNacimiento: perfil.fechaNacimiento,
      usuarioId: perfil.id,
    });
    return true;
  }

  continuarComoInvitado(email: string, fechaNacimiento: string): void {
    this.comprador.set({ email, fechaNacimiento, usuarioId: null });
  }

  reiniciar(): void {
    this.comprador.set(null);
    this.butacas.set([]);
    this.vaciarCandy();
  }

  readonly productos = signal<ItemCarrito[]>([]);
  readonly combos = signal<ComboElegido[]>([]);

  /** Total de combos elegidos: no puede superar la cantidad de butacas */
  readonly totalCombos = computed(() => this.combos().reduce((suma, c) => suma + c.cantidad, 0));

  cantidadDe(productoId: string): number {
    return this.productos().find((p) => p.productoId === productoId)?.cantidad ?? 0;
  }

  cambiarCantidad(productoId: string, cantidad: number): void {
    this.productos.update((actuales) => {
      if (cantidad <= 0) return actuales.filter((p) => p.productoId !== productoId);

      return actuales.some((p) => p.productoId === productoId)
        ? actuales.map((p) => (p.productoId === productoId ? { ...p, cantidad } : p))
        : [...actuales, { productoId, cantidad }];
    });
  }

  cantidadCombo(comboId: string): number {
    return this.combos().find((c) => c.comboId === comboId)?.cantidad ?? 0;
  }

  cambiarCantidadCombo(comboId: string, cantidad: number): void {
    this.combos.update((actuales) => {
      if (cantidad <= 0) return actuales.filter((c) => c.comboId !== comboId);

      return actuales.some((c) => c.comboId === comboId)
        ? actuales.map((c) => (c.comboId === comboId ? { ...c, cantidad } : c))
        : [...actuales, { comboId, cantidad }];
    });
  }

  vaciarCandy(): void {
    this.productos.set([]);
    this.combos.set([]);
  }
}