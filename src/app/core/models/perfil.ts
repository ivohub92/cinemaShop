export type RolUsuario = 'cliente' | 'empleado' | 'admin';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  rol: RolUsuario;
}