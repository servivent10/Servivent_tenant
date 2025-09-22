# Especificación del Proyecto: ServiVENT

## 1. Descripción General

ServiVENT será una aplicación web multi-tenant enfocada en la gestión integral de empresas comerciales. Cada empresa usuaria operará de forma independiente dentro de la plataforma, teniendo acceso a sus propios módulos de gestión.

La aplicación debe ser:

-   **Rápida y en tiempo real:** sincronización instantánea entre usuarios de la misma empresa.
-   **SPA (Single Page Application):** con navegación fluida.
-   **Responsiva:** y adaptable a escritorio, tablet y móvil.
-   **Moderna, profesional y elegante** en diseño.
-   **Construida con Supabase** como backend (auth, base de datos, storage, RLS, realtime).
-   **Frontend modular** con separación clara de páginas, componentes reutilizables y estilos.

## 2. Roles y Accesos

### Roles por empresa:

-   **Propietario:**
    -   Acceso total a su empresa.
    -   Puede gestionar usuarios, sucursales y configuración general.
-   **Administrador:**
    -   Puede gestionar inventarios, productos, compras, ventas, gastos, etc.
    -   Tiene acceso avanzado, pero no al control de pagos/licencias de la empresa.
-   **Empleado:**
    -   Acceso restringido a módulos operativos (ej. ventas, caja, inventario básico).

### Rol global:

-   **SuperAdmin** (único, usado por el dueño de ServiVENT).
    -   **Credenciales iniciales:**
        -   correo: `servivent10@gmail.com`
        -   contraseña: `servivent123`
    -   **Funciones:**
        -   Acceso a un panel exclusivo para gestionar todas las empresas.
        -   Alta/baja de empresas.
        -   Gestión de licencias y pagos.
        -   Supervisión de uso y métricas.

## 3. Funcionalidades Principales

Cada empresa podrá gestionar de manera independiente los siguientes módulos:

-   Inventarios
-   Productos
-   Compras
-   Ventas
-   Proformas
-   Traspasos de productos entre sucursales
-   Gastos
-   Sucursales
-   Usuarios internos
-   Proveedores
-   Clientes

## 4. Arquitectura Técnica

-   **Backend:** Supabase (Postgres + Auth + RLS + Storage + Realtime).
-   **Frontend:** SPA moderna (React, Vue o framework equivalente recomendado por el ingeniero).
-   **Base de datos:**
    -   Todas las tablas y columnas en minúscula.
    -   Uso de row-level security (RLS) para separar datos por empresa.

## 5. Diseño y Estilo

-   UI moderna, profesional y limpia.
-   Experiencia fluida tipo dashboard empresarial.
-   Diseño responsivo (desktop, tablet, móvil).
-   Componentes reutilizables (botones, tablas, modales, formularios).
-   Paleta de colores corporativa definida (puede proponerse en fase de diseño).

## 6. Mantenibilidad y Organización del Código

-   Separación estricta de:
    -   Páginas.
    -   Componentes reutilizables.
    -   Estilos propios de cada página.
-   Código limpio, modular y documentado.
-   Preparado para escalabilidad futura (más módulos o integraciones).

## 7. Panel de SuperAdmin

Debe incluir:

-   Gestión de empresas (crear, editar, suspender, eliminar).
-   Gestión de licencias y pagos.
-   Métricas y reportes de uso.
-   Control de usuarios propietarios.
