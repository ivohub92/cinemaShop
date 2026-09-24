import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const adminGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();

  if (perfil?.rol === 'admin') return true;

  router.navigate(['/cartelera']);
  return false;
};