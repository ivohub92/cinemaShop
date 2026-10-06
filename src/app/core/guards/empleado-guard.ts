import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const empleadoGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.perfilListo();

  if (perfil?.rol === 'empleado' || perfil?.rol === 'admin') return true;

  router.navigate(['/cartelera']);
  return false;
};