import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditoriaService } from '../auditoria.service';
import { EventoAuditoria } from '../../../../core/models/auditoria';

const POR_PAGINA = 50;


@Component({
  selector: 'app-registro-auditoria',
  imports: [DatePipe],
  templateUrl: './registro-auditoria.html',
  styleUrl: './registro-auditoria.scss',
})
export class RegistroAuditoria implements OnInit {
  private readonly auditoria = inject(AuditoriaService);

  readonly registros = signal<EventoAuditoria[]>([]);
  readonly entidad = signal('');
  readonly cargando = signal(true);
  readonly hayMas = signal(false);
  readonly error = signal('');

  readonly entidades: { valor: string; nombre: string }[] = [
    { valor: '', nombre: 'Todo' },
    { valor: 'funciones', nombre: 'Funciones' },
    { valor: 'ordenes', nombre: 'Compras y validaciones' },
    { valor: 'peliculas', nombre: 'Películas' },
    { valor: 'configuracion', nombre: 'Configuración y recargos' },
    { valor: 'productos', nombre: 'Productos' },
    { valor: 'combos', nombre: 'Combos' },
    { valor: 'categorias_producto', nombre: 'Categorías' },
    { valor: 'cupones', nombre: 'Cupones' },
    { valor: 'recompensas', nombre: 'Recompensas' },
    { valor: 'salas', nombre: 'Salas' },
    { valor: 'perfiles', nombre: 'Roles de usuarios' },
  ];

  private readonly nombresEntidad: Record<string, string> = {
    funciones: 'Función',
    ordenes: 'Compra',
    peliculas: 'Película',
    configuracion: 'Configuración',
    productos: 'Producto',
    combos: 'Combo',
    categorias_producto: 'Categoría',
    cupones: 'Cupón',
    recompensas: 'Recompensa',
    salas: 'Sala',
    perfiles: 'Usuario',
  };

  private readonly nombresAccion: Record<string, string> = {
    crear: 'Creó',
    modificar: 'Modificó',
    eliminar: 'Eliminó',
    validar_entrada: 'Validó la entrada',
    entregar_candy: 'Entregó el candy',
    cancelar_compra: 'Canceló la compra',
  };

  async ngOnInit(): Promise<void> {
    await this.cargar(true);
  }

  async filtrar(entidad: string): Promise<void> {
    this.entidad.set(entidad);
    await this.cargar(true);
  }

  async cargar(desdeCero = false): Promise<void> {
    this.cargando.set(true);
    this.error.set('');

    try {
      const desde = desdeCero ? 0 : this.registros().length;
      const pagina = await this.auditoria.listar(desde, POR_PAGINA, this.entidad());

      this.registros.update((actuales) => (desdeCero ? pagina : [...actuales, ...pagina]));
      this.hayMas.set(pagina.length === POR_PAGINA);
    } catch {
      this.error.set('No pudimos cargar el registro de actividad.');
    } finally {
      this.cargando.set(false);
    }
  }

  accion(registro: EventoAuditoria): string {
    return this.nombresAccion[registro.accion] ?? registro.accion;
  }

  nombreEntidad(entidad: string): string {
    return this.nombresEntidad[entidad] ?? entidad;
  }

  valor(valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (valor === true) return 'sí';
    if (valor === false) return 'no';
    return String(valor);
  }
}
