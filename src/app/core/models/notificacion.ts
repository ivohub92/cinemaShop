/** Aviso para un usuario registrado (por ahora, alertas de estreno: RF-14). */
export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  url: string | null;   
  leida: boolean;
  creadoEn: string;
}
