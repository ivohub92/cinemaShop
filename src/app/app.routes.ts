import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Home } from './features/home/home/home';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      {
        path: '',
        component: Home,
        children: [
          { path: '', redirectTo: 'cartelera', pathMatch: 'full' },
          {
            path: 'cartelera',
            loadComponent: () =>
              import('./features/home/cartelera/cartelera').then((m) => m.Cartelera),
          },
          {
            path: 'proximamente',
            loadComponent: () =>
              import('./features/home/proximamente/proximamente').then((m) => m.Proximamente),
          },
        ],
      },
      {
        path: 'registro',
        loadComponent: () => import('./features/auth/registro/registro').then((m) => m.Registro),
      },
      
    ],
  },
];