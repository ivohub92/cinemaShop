import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Home } from './features/home/home/home';
import { adminGuard } from './core/auth/guards/admin-guard'; 

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
    {
    path: 'admin',
    canMatch: [adminGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', redirectTo: 'peliculas', pathMatch: 'full' },
      {
        path: 'peliculas',
        loadComponent: () =>
          import('./features/admin/peliculas/lista-peliculas/lista-peliculas').then((m) => m.ListaPeliculas),
      },
      {
        path: 'peliculas/nueva',
        loadComponent: () =>
          import('./features/admin/peliculas/form-pelicula/form-pelicula').then((m) => m.FormPelicula),
      },
    ],
  },
];