import { Component, inject, OnInit, signal } from '@angular/core';
import { SalasService } from '../salas.service';
import { Sala } from '../../../../core/models/sala';

@Component({
  selector: 'app-gestion-salas',
  templateUrl: './gestion-salas.html',
  styleUrl: './gestion-salas.scss',
})
export class GestionSalas implements OnInit {
  private readonly salasService = inject(SalasService);

  readonly salas = signal<Sala[]>([]);
  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly editando = signal<string | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');

  async ngOnInit(): Promise<void> {
    await this.recargar();
    this.cargando.set(false);
  }

  private async recargar(): Promise<void> {
    try {
      this.salas.set(await this.salasService.listar());
    } catch (e: any) {
      this.error.set(e?.message ?? 'No pudimos cargar las salas.');
    }
  }

  async crear(campo: HTMLInputElement): Promise<void> {
    const nombre = campo.value.trim();
    if (!nombre) return;

    this.creando.set(true);
    this.error.set('');
    this.aviso.set('');

    try {
      await this.salasService.crear(nombre);
      campo.value = '';
      await this.recargar();
      this.aviso.set(`Se creó "${nombre}" con sus 532 butacas.`);
    } catch (e: any) {
      this.error.set(this.mensaje(e, 'No pudimos crear la sala.'));
    } finally {
      this.creando.set(false);
    }
  }

  async renombrar(sala: Sala, campo: HTMLInputElement): Promise<void> {
    const nombre = campo.value.trim();

    if (!nombre || nombre === sala.nombre) {
      this.editando.set(null);
      return;
    }

    this.error.set('');
    try {
      await this.salasService.renombrar(sala.id, nombre);
      this.editando.set(null);
      await this.recargar();
    } catch (e: any) {
      this.error.set(this.mensaje(e, 'No pudimos renombrar la sala.'));
    }
  }

  async cambiarEstado(sala: Sala): Promise<void> {
    if (sala.activa) {
      const aviso = sala.funcionesFuturas
        ? `"${sala.nombre}" tiene ${sala.funcionesFuturas} funciones programadas: se mantienen, ` +
          'pero no se le van a asignar funciones nuevas. ¿Desactivarla?'
        : `¿Desactivar "${sala.nombre}"? No se le van a asignar funciones nuevas.`;
      if (!confirm(aviso)) return;
    }

    this.error.set('');
    try {
      await this.salasService.cambiarActiva(sala.id, !sala.activa);
      await this.recargar();
    } catch (e: any) {
      this.error.set(this.mensaje(e, 'No pudimos cambiar el estado de la sala.'));
    }
  }

  private mensaje(e: any, porDefecto: string): string {
    return e?.code === '23505' ? 'Ya existe una sala con ese nombre.' : (e?.message ?? porDefecto);
  }
}
