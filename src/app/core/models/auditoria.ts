export interface EventoAuditoria {
  id: number;
  usuarioEmail: string | null;
  accion: string;
  entidad: string;
  descripcion: string | null;
  cambios: { campo: string; antes: unknown; despues: unknown }[];
  creadoEn: string;
}
