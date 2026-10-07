# cineShop

Trabajo práctico final de Programación IV (UTN). Docente: Morelli Augusto - Equipo de cátedra: Ledesma Juan Pablo

Alumno: Iván Ramunda

**Demo:** https://cineshop-9a183.web.app


PWA de venta de entradas para un complejo de cines: cartelera, compra con mapa de butacas en tiempo real, candy bar, beneficios para clientes registrados, validación con QR y un panel de administración con reportes y auditoría.




---

## Funcionalidades

| Módulo | Qué incluye |
| --- | --- |
| Catálogo | Portada con destacadas y las 3 más vendidas, cartelera, Próximamente, buscador por nombre y filtro por géneros, detalle con reseñas y promedio |
| Compra | Compra como invitado o con cuenta, control de edad, mapa de butacas en vivo (VIP y accesibles), reserva temporal de 10 minutos, candy bar y combos, comprobante PDF con QR |
| Beneficios | Cupón de bienvenida y para mayores de 50, puntos canjeables por entradas o productos, crédito por cancelación, alertas de estreno y notificaciones |
| Cuenta | Mi cuenta (puntos, crédito, cupones, compras con cancelación) y Mis películas (lo que vio, con su calificación) |
| Validación | Escaneo del QR con la cámara o código manual; acceso a sala y entrega del candy, cada uno de un solo uso |
| Administración | Películas (póster por URL o subido desde la computadora, preventa, portada), funciones (programación semanal con sala automática, edición, baja), recargos por formato y VIP, salas, candy bar, cupones, recompensas, empleados, reportes con exportación a PDF y Excel, auditoría |

### Roles

| Rol | Qué puede hacer |
| --- | --- |
| Invitado | Ver la cartelera y comprar con email y fecha de nacimiento |
| Cliente | Comprar y usar beneficios (cupones, puntos, crédito), reseñar, activar alertas, Mi cuenta y Mis películas |
| Empleado | Solo validar códigos QR (acceso y candy). Al ingresar va directo a esa pantalla |
| Administrador | El panel de administración completo y la validación |

El personal (empleado y admin) no compra, no reseña ni activa alertas: se oculta en la pantalla y además lo rechaza la base.

## Tecnologías

- **Angular 22**: componentes standalone, signals, zoneless, rutas con lazy loading y guards `canMatch`, formularios reactivos, service worker (PWA).
- **Supabase**: PostgreSQL con Row Level Security, funciones RPC, triggers, Realtime, pg_cron, Auth y Storage (pósters).
- **Firebase Hosting** para la publicación.
- **Librerías**: `@supabase/supabase-js`, `jspdf`, `qrcode`, `jsqr` (lectura del QR), `xlsx` (exportación a Excel).

## Arquitectura

```
Navegador (Angular)                        Supabase (PostgreSQL)
┌──────────────────────────┐               ┌───────────────────────────────┐
│ layouts/  público, admin │               │ Auth          sesión (JWT)    │
│ features/ pantallas      │  consultas    │ Tablas + RLS  cada uno lo suyo│
│ core/     servicios,     │ ── y rpc() ─► │ Funciones RPC reglas de       │
│           guards, modelos│               │               negocio         │
│ shared/   formularios,   │ ◄─ Realtime ─ │ Triggers y pg_cron            │
│           directivas     │               │ Realtime      butacas, avisos │
└──────────────────────────┘               └───────────────────────────────┘
```

**La base de datos decide.** Precios, control de edad, disponibilidad de butacas, cupones, puntos, crédito y permisos se calculan en funciones de PostgreSQL (`reservar_butacas`, `confirmar_compra`, `cancelar_compra`, `validar_acceso`, etc.). Angular muestra, valida los formularios para guiar al usuario y pide: así ninguna regla se puede saltear desde el navegador. Un usuario no puede modificar su propio perfil desde la API (ni su rol ni su fecha de nacimiento); los cambios de rol pasan solo por funciones del administrador.

```
src/app/
├── core/        servicios compartidos, AuthService, SupabaseService, guards y modelos
├── features/    una carpeta por módulo: home, peliculas, compra, cuenta, validacion, auth, admin/*
├── shared/      SelectorFecha, SelectorEstrellas, validadores, PanelLateral, toasts, campana de notificaciones, directivas, pipe
└── layouts/     PublicLayout y AdminLayout
public/img/            póster de respaldo ("Póster no disponible")
supabase/migrations/   migraciones SQL (en orden) y seed.sql con datos de demo
supabase/limpiar_demo.sql   vacía los datos para armar la demo de cero
```


## Decisiones principales

Respecto de lo pedido, se adoptaron estas definiciones:

| ID | Decisión |
| --- | --- |
| D-01 | La compra como invitado exige correo y fecha de nacimiento; los beneficios son solo para registrados |
| D-02 | "Las más vendidas" se calcula sobre los últimos 30 días |
| D-03 | Filas J y K accesibles de 14 butacas: 532 por sala, 84 VIP (filas R, S y T) |
| D-04 | El solapamiento de funciones se controla en el servidor, con una restricción de exclusión y 30 minutos de limpieza |
| D-05 | Las butacas se bloquean 10 minutos durante la compra; un cron libera las vencidas cada minuto |
| D-06 | Precio = base de la función (o de preventa) + recargo por formato + recargo VIP, configurables |
| D-07 | Un QR por compra, con dos validaciones de un solo uso: acceso y candy |
| D-08 | Mis películas muestra lo validado; las reseñas son abiertas, con distintivo de compra verificada |

Además:

- **Orden de beneficios:** cupón → puntos → crédito → dinero. Solo lo pagado en dinero suma puntos (1 por peso).
- **Cancelación:** hasta 2 horas antes; el importe vuelve como crédito, sin vencimiento.
- **Preventa:** precio especial para las compras hechas en los 7 días previos al estreno.
- **Combos:** cada combo incluye una entrada; reemplaza su precio base y mantiene los recargos.
- **Precio histórico:** cada entrada guarda lo que pagó; cambiar precios no altera ventas ni reportes.
- **Notificaciones:** por Realtime y como notificación del sistema mientras la app está abierta.
- **Auditoría:** registrada por triggers, con nombre, email y rol del autor en ese momento, y los cambios campo por campo; nadie puede editarla ni borrarla.
- **Edad para registrarse:** entre 13 y 120 años. La fecha de nacimiento no puede ser futura.
- **Funciones:** solo a futuro. Con entradas vendidas no se borran ni cambian de horario, formato o idioma; el precio sí.
- **Compra como invitado:** el email se escribe dos veces y se valida su formato. Si hay una sesión abierta, no se puede comprar como invitado.
- **Pósters:** se pegan como URL o se suben (JPG, PNG o WebP hasta 2 MB) a Supabase Storage. Si no hay póster o no carga, se muestra una imagen de respaldo incluida en la app.

## Limitaciones y mejoras posibles

- Las notificaciones llegan con la app abierta; con la app cerrada haría falta Web Push.
- El pago es simulado: el cliente no definió pasarela.
- El mapa general del complejo no se implementó: el cliente no lo aprobó.
- Una función con entradas vendidas no se puede reprogramar.
