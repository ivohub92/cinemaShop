import { Component, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';

/**
 * RF-49: lee el QR de la entrada con la cámara del dispositivo.
 * Usa jsQR (se descarga recién al abrir la cámara: import dinámico).
 * La cámara del navegador solo funciona en HTTPS o en localhost.
 */
@Component({
  selector: 'app-escaner-qr',
  templateUrl: './escaner-qr.html',
  styleUrl: './escaner-qr.scss',
})
export class EscanerQr implements OnDestroy {
  /** El texto del QR leído (el código de la orden). */
  readonly leido = output<string>();

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly activo = signal(false);
  readonly error = signal('');

  private stream?: MediaStream;
  private cuadro?: number;
  private lienzo = document.createElement('canvas');

  async abrir(): Promise<void> {
    this.error.set('');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Este navegador no permite usar la cámara. Ingresá el código a mano.');
      return;
    }

    try {

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      this.error.set('No pudimos usar la cámara. Revisá el permiso del navegador o ingresá el código a mano.');
      return;
    }

    const { default: jsQR } = await import('jsqr');

    this.activo.set(true);
    const video = this.video().nativeElement;
    video.srcObject = this.stream;
    await video.play();

    const contexto = this.lienzo.getContext('2d', { willReadFrequently: true })!;

  
    const leerCuadro = () => {
      if (!this.activo()) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        this.lienzo.width = video.videoWidth;
        this.lienzo.height = video.videoHeight;
        contexto.drawImage(video, 0, 0);
        const imagen = contexto.getImageData(0, 0, this.lienzo.width, this.lienzo.height);
        const qr = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'dontInvert' });

        if (qr?.data) {
          this.cerrar();
          this.leido.emit(qr.data.trim());
          return;
        }
      }

      this.cuadro = requestAnimationFrame(leerCuadro);
    };

    this.cuadro = requestAnimationFrame(leerCuadro);
  }

  /** Apaga la cámara: si no, la luz del dispositivo queda prendida. */
  cerrar(): void {
    this.activo.set(false);
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.stream?.getTracks().forEach((pista) => pista.stop());
    this.stream = undefined;
  }

  ngOnDestroy(): void {
    this.cerrar();
  }
}
