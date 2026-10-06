import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpleadosService } from '../empleados.service';
import { MiembroPersonal } from '../../../../core/models/empleado';
import { ToastService } from '../../../../shared/ui/toasts/toast.service';

/** RF-06: el admin crea las cuentas de empleado y les quita el acceso. */
@Component({
  selector: 'app-gestion-empleados',
  imports: [ReactiveFormsModule],
  templateUrl: './gestion-empleados.html',
  styleUrl: './gestion-empleados.scss',
})
export class GestionEmpleados implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleados = inject(EmpleadosService);
  private readonly toast = inject(ToastService);

  readonly personal = signal<MiembroPersonal[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);

  readonly soloEmpleados = computed(() => this.personal().filter((p) => p.rol === 'empleado'));

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.personal.set(await this.empleados.listar());
    } catch {
      this.toast.error('No pudimos cargar el personal.');
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.toast.error('Revisá los datos del empleado.');
      return;
    }

    this.enviando.set(true);

    try {
      const datos = this.formulario.getRawValue();
      const resultado = await this.empleados.alta(datos);

      this.toast.exito(
        resultado === 'existente'
          ? `${datos.email} ya tenía cuenta: ahora es empleado y entra con su contraseña de siempre.`
          : `Cuenta creada. ${datos.nombre} entra con ${datos.email} y la contraseña que cargaste.`,
      );
      this.formulario.reset();
      await this.cargar();
    } catch (e: any) {
      this.toast.error(e?.message ?? 'No pudimos dar de alta al empleado.');
      await this.cargar();
    } finally {
      this.enviando.set(false);
    }
  }

  async quitar(miembro: MiembroPersonal): Promise<void> {
    const pendiente = miembro.estado === 'pendiente';
    const pregunta = pendiente
      ? `¿Cancelar el alta de ${miembro.nombre} ${miembro.apellido}?`
      : `¿Quitarle el acceso de empleado a ${miembro.nombre} ${miembro.apellido}? Su cuenta pasa a ser de cliente.`;

    if (!confirm(pregunta)) return;

    try {
      if (pendiente) {
        await this.empleados.cancelarPendiente(miembro.email);
      } else {
        await this.empleados.quitarAcceso(miembro.id);
      }
      this.toast.exito(pendiente ? 'Alta cancelada.' : 'Acceso de empleado quitado.');
      await this.cargar();
    } catch (e: any) {
      this.toast.error(e?.message ?? 'No pudimos hacer el cambio.');
    }
  }
}
