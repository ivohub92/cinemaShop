export interface MiembroPersonal {
  id: string;             
  email: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  rol: 'empleado' | 'admin';
  estado: 'activo' | 'pendiente';  
}

export interface DatosEmpleado {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;  
}
