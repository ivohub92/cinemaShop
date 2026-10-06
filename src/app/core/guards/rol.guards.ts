import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/** Mi cuenta, Mis compras, Mis películas: solo clientes. El personal va a su inicio. */
export const clienteGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();
  if (perfil?.rol === 'cliente') return true;

  return router.parseUrl(perfil ? auth.inicioDe(perfil.rol) : '/cartelera');
};

/** Compra: clientes e invitados (sin sesión). El personal no compra entradas. */
export const compraGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();
  if (!perfil || perfil.rol === 'cliente') return true;

  return router.parseUrl(auth.inicioDe(perfil.rol));
};
