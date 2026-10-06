/** Un registro del log de actividad (RF-62, RN-05). */
export interface EventoAuditoria {
  id: number;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  usuarioRol: string | null;   // el que tenía al momento de la acción
  accion: string;
  entidad: string;
  descripcion: string | null;
  cambios: { campo: string; antes: unknown; despues: unknown }[];
  creadoEn: string;
}
