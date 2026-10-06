export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  url: string | null;   
  leida: boolean;
  creadoEn: string;
}
