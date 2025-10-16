# Plan de Implementación y Arquitectura: Gestión de Planes Dinámicos y Módulos

## 1. Visión y Objetivo

-   **Visión:** Dar al SuperAdmin control total sobre el modelo de negocio de ServiVENT, permitiendo la creación, modificación y gestión de planes de suscripción, sus características y módulos adicionales sin necesidad de tocar el código.
-   **Objetivo:** Migrar la configuración de planes, anteriormente "quemada" en el código, a una estructura de tablas en la base de datos, convirtiéndola en la **fuente única de la verdad** para los permisos y límites de cada empresa.

---

## 2. Arquitectura de Backend (Base de Datos)

El sistema se basa en un esquema de tablas interconectadas que modelan los planes, sus capacidades y los módulos opcionales.

### 2.1. Estructura de Tablas

1.  **`planes`:**
    -   **Propósito:** Almacena la definición de cada plan de suscripción base (ej. "Emprendedor", "Profesional").
    -   **Columnas Clave:** `nombre`, `descripcion`, `precio_mensual`, `precio_anual`, `es_publico`, `es_recomendado`, `orden` (para controlar el orden de aparición en la UI).

2.  **`caracteristicas`:**
    -   **Propósito:** Es el catálogo maestro de todas las posibles funcionalidades o límites que un plan puede tener.
    -   **Columnas Clave:**
        -   `codigo_interno`: **(CRÍTICO)** Un código único y legible por máquina que usará el sistema para verificar permisos (ej. `MAX_USERS`, `LISTAS_PRECIOS`, `MODULO_TRASPASOS`).
        -   `tipo`: Define cómo se interpreta el valor: `'LIMIT'` (un límite numérico) o `'BOOLEAN'` (una funcionalidad que está activada o desactivada).

3.  **`plan_caracteristicas` (Tabla de Unión):**
    -   **Propósito:** Conecta un plan con sus características y define el valor específico para esa combinación. Es el corazón del sistema de planes base.
    -   **Ejemplo:**
        -   (Plan "Profesional", Característica "MAX_SUCURSALES", Valor "3")
        -   (Plan "Profesional", Característica "LISTAS_PRECIOS", Valor "true")

4.  **`modulos`:**
    -   **Propósito:** Catálogo de funcionalidades **opcionales y de pago adicional** (Add-ons) que una empresa puede contratar independientemente de su plan base.
    -   **Columnas Clave:** `codigo_interno` (ej. `CATALOGO_WEB`, `APERTURAR_CAJAS`), `nombre_visible`, `precio_mensual`.

5.  **`empresa_modulos` (Tabla de Unión):**
    -   **Propósito:** Registra qué empresas han activado qué módulos.
    -   **Columnas Clave:** `empresa_id`, `modulo_id`, `estado` ('activo' o 'inactivo').

---

## 3. Lógica de Consolidación de Permisos (La Fuente de la Verdad)

El núcleo del sistema es la función RPC `get_user_profile_data`, que se ejecuta al iniciar sesión y consolida todos los permisos y límites de una empresa en un único objeto JSON.

### El Objeto `planDetails`

Esta función devuelve un objeto `planDetails` dentro del perfil del usuario (`companyInfo`). Este objeto es la fuente de verdad para toda la UI y contiene dos sub-objetos clave:

1.  **`planDetails.limits`:**
    -   **Contenido:** Un objeto con pares clave-valor para todos los **límites numéricos** del plan.
    -   **Fuente:** Proviene de la tabla `plan_caracteristicas` donde el `tipo` de la característica es `'LIMIT'`.
    -   **Ejemplo:** `{ "max_users": 10, "max_branches": 3 }`

2.  **`planDetails.features`:**
    -   **Contenido:** Un objeto con pares clave-valor para todas las **funcionalidades booleanas**.
    -   **Fuente (Consolidada):** Es el resultado de la **unión** de dos fuentes:
        1.  Las características booleanas del **plan base** de la empresa (de `plan_caracteristicas`).
        2.  Los **módulos adicionales activos** que la empresa ha contratado (de `empresa_modulos`).
    -   **Ejemplo:** `{ "listas_precios": true, "modulo_traspasos": false, "catalogo_web": true, "aperturar_cajas": false }`

**Convención de Nombres:** Todos los `codigo_interno` de la base de datos (ej. `MAX_USERS`, `LISTAS_PRECIOS`) se convierten a formato **`snake_case`** (ej. `max_users`, `listas_precios`) en el objeto `planDetails` para una consistencia total en el frontend.

---

## 4. Arquitectura de Frontend (UI Dinámica)

### 4.1. Panel de SuperAdmin

-   **`PlanesPage.tsx`:** Permite al SuperAdmin gestionar la tabla `planes`. La interfaz permite crear y editar los detalles de cada plan, así como **reordenarlos mediante drag-and-drop**, lo cual invoca la RPC `update_plan_order`.
-   **`PlanFormModal.tsx`:** Es el modal de edición de un plan. Contiene pestañas para:
    -   **General:** Editar nombre, precios, etc.
    -   **Características del Sistema:** Configurar los valores de las `caracteristicas` lógicas (límites y booleanos).
    -   **Características para Mostrar:** Gestionar la lista de puntos de marketing que aparecen en la tarjeta del plan.
-   **`ModulosPage.tsx`:** Permite al SuperAdmin gestionar el catálogo de `modulos` disponibles.
-   **`CompanyDetailsPage.tsx`:** Incluye una pestaña "Módulos" donde el SuperAdmin puede activar o desactivar add-ons para una empresa específica, invocando la RPC `toggle_company_module`.

### 4.2. Aplicación de Permisos en la UI del Tenant

La aplicación lee constantemente el objeto `companyInfo.planDetails` para adaptar la interfaz de usuario en tiempo real.

-   **`tenantLinks.ts`:** Genera los enlaces de la barra lateral. Oculta el enlace a "Traspasos" si `companyInfo.planDetails.features.modulo_traspasos` es `false`. Oculta "Historial de Cajas" si `aperturar_cajas` es `false`.
-   **`SucursalesListPage.tsx`:** Antes de permitir la creación de una nueva sucursal, comprueba si `branchCount >= companyInfo.planDetails.limits.max_branches`. Si se alcanza el límite, el botón "Añadir" se deshabilita.
-   **`SucursalDetailPage.tsx`:** Aplica la misma lógica para el límite de `max_users`.
-   **`ConfiguracionPage.tsx`:** La pestaña "Listas de Precios" solo es visible si `companyInfo.planDetails.features.listas_precios` es `true`. La pestaña "Catálogo Web" solo es visible si `catalogo_web` es `true`.
-   **`TerminalVentaPage.tsx`:** El comportamiento del selector de listas de precios se basa en una combinación de `listas_precios` y `catalogo_web` para determinar si está habilitado, deshabilitado o muestra un conjunto limitado de opciones.
-   **Páginas de Módulos (`TraspasosPage.tsx`, etc.):** Estas páginas ahora comprueban el flag de su característica correspondiente al cargar. Si es `false`, renderizan un componente `PremiumModuleMessage` en lugar de la funcionalidad de la página.

---

## 5. Seguridad y Reglas de Negocio en Backend

La validación no solo ocurre en la interfaz, sino que se refuerza en el backend para máxima seguridad.

-   **Funciones RPC Críticas:** Funciones como `create_sucursal` y la Edge Function `create-company-user` ahora incluyen una lógica de validación inicial. Antes de ejecutar la inserción, consultan el plan de la empresa y verifican si la acción violaría los límites (`MAX_BRANCHES`, `MAX_USERS`). Si lo hace, la función devuelve un error.
-   **`update_company_info`:** Esta función contiene una regla de negocio clave: si el SuperAdmin desactiva el módulo `CATALOGO_WEB` para una empresa, esta función se asegura de que el campo `slug` de la empresa se establezca automáticamente en `NULL`, deshabilitando efectivamente su catálogo público y manteniendo la integridad de los datos.