import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { Notificacion } from '../models/notificacion';


type Permiso = NotificationPermission | 'no-soportado';


@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);


  readonly lista = signal<Notificacion[]>([]);
  readonly noLeidas = computed(() => this.lista().filter((n) => !n.leida).length);

  readonly alertas = signal<ReadonlySet<string>>(new Set());

  readonly permiso = signal<Permiso>('Notification' in window ? Notification.permission : 'no-soportado');

  private canal: RealtimeChannel | null = null;
  private usuarioId: string | null = null;


  async iniciar(usuarioId: string): Promise<void> {
    if (this.usuarioId === usuarioId) return;
    this.detener();
    this.usuarioId = usuarioId;


    await Promise.all([this.cargar(), this.cargarAlertas()]);

    this.canal = this.supabase.client
      .channel(`notificaciones:${usuarioId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` },
        ({ new: fila }) => {
          const notificacion = this.aNotificacion(fila);
          this.lista.update((lista) => [notificacion, ...lista]);
          this.mostrarEnSistema(notificacion);

          this.cargarAlertas();
        },
      )
      .subscribe();
  }


  detener(): void {
    if (this.canal) this.supabase.client.removeChannel(this.canal);
    this.canal = null;
    this.usuarioId = null;
    this.lista.set([]);
    this.alertas.set(new Set());
  }

  private async cargar(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('notificaciones')
      .select('id, titulo, mensaje, url, leida_en, creado_en')
      .order('creado_en', { ascending: false })
      .limit(20);

    if (!error) this.lista.set((data ?? []).map((fila) => this.aNotificacion(fila)));
  }

  async marcarLeidas(): Promise<void> {
    if (!this.noLeidas()) return;

    this.lista.update((lista) => lista.map((n) => ({ ...n, leida: true })));
    await this.supabase.client.rpc('marcar_notificaciones_leidas');
  }



  private async cargarAlertas(): Promise<void> {
    const { data } = await this.supabase.client.from('alertas_estreno').select('pelicula_id');
    this.alertas.set(new Set((data ?? []).map((fila: any) => fila.pelicula_id)));
  }


  async activarAlerta(peliculaId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('alertas_estreno')
      .insert({ usuario_id: this.usuarioId, pelicula_id: peliculaId });


    if (error && error.code !== '23505') throw error;

    this.alertas.update((alertas) => new Set(alertas).add(peliculaId));
    await this.pedirPermiso();
  }

  async quitarAlerta(peliculaId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('alertas_estreno')
      .delete()
      .eq('pelicula_id', peliculaId);

    if (error) throw error;

    this.alertas.update((alertas) => {
      const copia = new Set(alertas);
      copia.delete(peliculaId);
      return copia;
    });
  }


  async pedirPermiso(): Promise<void> {
    if (this.permiso() !== 'default') return;
    this.permiso.set(await Notification.requestPermission());
  }

  private async mostrarEnSistema(notificacion: Notificacion): Promise<void> {
    if (this.permiso() !== 'granted') return;


    const registro = await navigator.serviceWorker?.getRegistration();

    if (registro) {
      await registro.showNotification(notificacion.titulo, {
        body: notificacion.mensaje,
        icon: 'icons/icon-192x192.png',
        tag: notificacion.id,
        data: {
          onActionClick: {
            default: { operation: 'navigateLastFocusedOrOpen', url: notificacion.url ?? '/' },
          },
        },
      });
      return;
    }


    const aviso = new Notification(notificacion.titulo, {
      body: notificacion.mensaje,
      icon: 'icons/icon-192x192.png',
      tag: notificacion.id,
    });

    aviso.onclick = () => {
      window.focus();
      if (notificacion.url) this.router.navigateByUrl(notificacion.url);
      aviso.close();
    };
  }

  private aNotificacion(fila: any): Notificacion {
    return {
      id: fila.id,
      titulo: fila.titulo,
      mensaje: fila.mensaje,
      url: fila.url,
      leida: !!fila.leida_en,
      creadoEn: fila.creado_en,
    };
  }
}
