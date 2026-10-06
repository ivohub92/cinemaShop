import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { Home } from './features/home/home/home';
import { adminGuard } from './core/auth/guards/admin-guard'; 
import { empleadoGuard } from './core/guards/empleado-guard';
import { sesionGuard } from './core/guards/session.guards';

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
        path: 'peliculas/:id',
        loadComponent: () =>
          import('./features/peliculas/detalle-pelicula/detalle-pelicula').then((m) => m.DetallePelicula),
      },
      {
        path: 'registro',
        loadComponent: () => import('./features/auth/registro/registro').then((m) => m.Registro),
      },
      {
        path: 'compra/:funcionId',
        loadComponent: () => import('./features/compra/compra/compra').then((m) => m.Compra),
      },
      {
        path: 'mi-cuenta',
        canMatch: [sesionGuard],
        loadComponent: () =>
          import('./features/cuenta/mi-cuenta/mi-cuenta').then((m) => m.MiCuenta),
      },
      {
        path: 'mis-compras',
        canMatch: [sesionGuard],
        loadComponent: () =>
          import('./features/cuenta/mis-compras/mis-compras').then((m) => m.MisCompras),
      },
      {
     path: 'mis-peliculas',
    canMatch: [sesionGuard],
    loadComponent: () =>
      import('./features/cuenta/mis-peliculas/mis-peliculas').then((m) => m.MisPeliculas),
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
      {
        path: 'peliculas/:id',
        loadComponent: () =>
          import('./features/admin/peliculas/form-pelicula/form-pelicula').then((m) => m.FormPelicula),
      },
            {
        path: 'candy',
        loadComponent: () =>
          import('./features/admin/candy/lista-productos/lista-productos').then((m) => m.ListaProductos),
      },
      {
        path: 'candy/nuevo',
        loadComponent: () =>
          import('./features/admin/candy/form-producto/form-producto').then((m) => m.FormProducto),
      },
      {
        path: 'candy/:id',
        loadComponent: () =>
          import('./features/admin/candy/form-producto/form-producto').then((m) => m.FormProducto),
      },
      {
        path: 'candy/combos/nuevo',
        loadComponent: () =>
          import('./features/admin/candy/form-combo/form-combo').then((m) => m.FormCombo),
      },
      {
        path: 'candy/combos/:id',
        loadComponent: () =>
          import('./features/admin/candy/form-combo/form-combo').then((m) => m.FormCombo),
      },
      {
        path: 'recompensas',
        loadComponent: () =>
          import('./features/admin/recompensas/gestion-recompensas/gestion-recompensas').then(
            (m) => m.GestionRecompensas,
          ),
      },
      {
        path: 'cupones',
        loadComponent: () =>
          import('./features/admin/cupones/gestion-cupones/gestion-cupones').then((m) => m.GestionCupones),
      },
      {
        path: 'funciones',
        loadComponent: () =>
          import('./features/admin/funciones/gestion-funciones/gestion-funciones').then(
            (m) => m.GestionFunciones,
          ),
      },
    ],
  },
  {
    path: 'validacion',
    canMatch: [empleadoGuard],
    loadComponent: () =>
      import('./features/validacion/validar-entrada/validar-entrada').then((m) => m.ValidarEntrada),
  },
  
  { path: '**', redirectTo: '' }

];