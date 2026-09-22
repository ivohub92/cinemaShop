import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'cartelera', pathMatch: 'full' },
  {
    path: 'cartelera',
    loadComponent: () =>
      import('./features/home/cartelera/cartelera').then((m) => m.Cartelera),
  },
];