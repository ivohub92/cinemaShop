/** Una persona del personal, para la pantalla de empleados del admin. */
export interface MiembroPersonal {
  id: string;             // id del perfil, o el email si el alta está pendiente
  email: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  rol: 'empleado' | 'admin';
  estado: 'activo' | 'pendiente';   // pendiente = autorizado, todavía sin cuenta
}

export interface DatosEmpleado {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;       // contraseña inicial con la que ingresa
}
