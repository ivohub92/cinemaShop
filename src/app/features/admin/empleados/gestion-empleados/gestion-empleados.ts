import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { EmpleadosService } from '../empleados.service';
import { MiembroPersonal } from '../../../../core/models/empleado';
import { ToastService } from '../../../../shared/ui/toasts/toast.service';
import { EMAIL_COMPLETO } from '../../../../shared/forms/validadores';


const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;


function dniValido(control: AbstractControl): ValidationErrors | null {
  const dni = String(control.value ?? '');
  if (!dni) return null;
  if (!/^\d+$/.test(dni)) return { dniFormato: true };
  if (dni.length < 7 || dni.length > 8) return { dniLargo: true };
  if (dni.startsWith('0')) return { dniCero: true };
  return null;
}

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
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(SOLO_LETRAS)]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(SOLO_LETRAS)]],
    dni: ['', [Validators.required, dniValido, (c: AbstractControl) => this.dniRepetido(c)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL_COMPLETO)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.personal.set(await this.empleados.listar());
      this.formulario.controls.dni.updateValueAndValidity();
    } catch {
      this.toast.error('No pudimos cargar el personal.');
    } finally {
      this.cargando.set(false);
    }
  }


  private dniRepetido(control: AbstractControl): ValidationErrors | null {
    const dni = control.value;
    const email = this.formulario?.controls.email.value.trim().toLowerCase() ?? '';
    const usado = this.personal().some((p) => p.dni === dni && p.email.toLowerCase() !== email);
    return dni && usado ? { dniRepetido: true } : null;
  }


  limpiarDni(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const limpio = entrada.value.replace(/\D/g, '').slice(0, 8);
    if (limpio !== entrada.value) {
      entrada.value = limpio;
      this.formulario.controls.dni.setValue(limpio);
    }
  }


  errorDni(): string {
    const dni = this.formulario.controls.dni;
    if (dni.hasError('required')) return 'Ingresá el DNI.';
    if (dni.hasError('dniFormato')) return 'El DNI lleva solo números, sin puntos ni espacios.';
    if (dni.hasError('dniLargo')) return 'El DNI tiene que tener 7 u 8 números.';
    if (dni.hasError('dniCero')) return 'El DNI no puede empezar con 0.';
    if (dni.hasError('dniRepetido')) return 'Ya hay un empleado con ese DNI.';
    return '';
  }

  async crear(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.toast.error(this.errorDni() || 'Revisá los datos del empleado.');
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
