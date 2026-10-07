import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';


export const clienteGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();
  if (perfil?.rol === 'cliente') return true;

  return router.parseUrl(perfil ? auth.inicioDe(perfil.rol) : '/cartelera');
};


export const compraGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();
  if (!perfil || perfil.rol === 'cliente') return true;

  return router.parseUrl(auth.inicioDe(perfil.rol));
};
