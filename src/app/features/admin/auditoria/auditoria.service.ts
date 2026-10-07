import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { EventoAuditoria } from '../../../core/models/auditoria';


@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly supabase = inject(SupabaseService);


  async listar(desde: number, cantidad: number, entidad = '', rol = ''): Promise<EventoAuditoria[]> {
    let consulta = this.supabase.client
      .from('auditoria')
      .select('id, usuario_email, usuario_nombre, usuario_rol, accion, entidad, descripcion, detalle, creado_en')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + cantidad - 1);

    if (entidad) consulta = consulta.eq('entidad', entidad);
    if (rol) consulta = consulta.eq('usuario_rol', rol);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      usuarioEmail: fila.usuario_email,
      usuarioNombre: fila.usuario_nombre,
      usuarioRol: fila.usuario_rol,
      accion: fila.accion,
      entidad: fila.entidad,
      descripcion: fila.descripcion,
      cambios: fila.accion === 'modificar' && fila.detalle
        ? Object.entries(fila.detalle).map(([campo, valor]: [string, any]) => ({
            campo,
            antes: valor?.antes,
            despues: valor?.despues,
          }))
        : [],
      creadoEn: fila.creado_en,
    }));
  }
}
