# Plan de Implementación: Módulo de Catálogo Web para Clientes (Versión 3.0 - Refinada)

Este documento es la guía de implementación definitiva para el **Catálogo Web Público**. Integra las mejoras de flujo y lógica para asegurar una experiencia de usuario robusta y una implementación sin ambigüedades.

## 1. Visión y Objetivo

-   **Visión:** Transformar ServiVENT de una herramienta de gestión interna a una plataforma de ventas omnicanal.
-   **Objetivo:** Permitir a los visitantes ver productos, identificarse de forma sencilla y realizar pedidos que se integren directamente en el flujo de trabajo de la empresa dentro de ServiVENT.

---

## Fases de Implementación

### Fase 1: Activación por Plan y URL Amigable (`slug`)

-   **Activación:** El catálogo estará habilitado solo para los planes **Profesional** y **Corporativo**.
-   **URL Única (`slug`):** Cada empresa tendrá una URL del tipo `servivent.app/#/catalogo/{slug}`. Se añadirá una columna `slug` a la tabla `empresas`.
-   **Gestión del Slug:** En `ConfiguracionPage`, el propietario podrá editar su `slug`, con validación en tiempo real para asegurar que sea único.

### Fase 2: Lógica de Precios y Stock (Público)

-   **Precio Público:** Los visitantes anónimos **siempre y únicamente** verán los precios de la lista **"General"**.
-   **Ofertas Web:** Se creará automáticamente una lista de precios **"Ofertas Web"**. Si un producto tiene precio en esta lista, se mostrará como una oferta con el precio "General" tachado.
-   **Stock Consolidado:** La disponibilidad se mostrará como un estado textual (`Disponible`, `Pocas Unidades`, `Agotado`) basado en la **suma del stock de todas las sucursales**.

### Fase 3: Flujo de Acceso Unificado y Portal de Cliente (Implementación Inteligente)

Esta fase implementa un sistema de autenticación robusto y sin fricciones que unifica el inicio de sesión y el registro en una sola página inteligente, además de proporcionar un portal completo para el cliente una vez autenticado.

1.  **Página de Identificación Unificada (`ClienteIdentificacionPage.tsx`):**
    *   **Punto de Entrada Único:** Tanto "Login" como "Registro" dirigen a la misma página, que inicialmente solo muestra un campo: "Ingresa tu correo electrónico para continuar".
    *   **Verificación Inteligente en Tiempo Real:** Mientras el usuario escribe su correo, el sistema invoca la función RPC `validate_client_email_status` en el backend. Esta función es el cerebro del flujo y devuelve uno de tres estados posibles:
        *   **`exists_linked`:** El correo ya pertenece a un cliente con una cuenta web activa. La interfaz se transforma en un **formulario de inicio de sesión**, mostrando únicamente el campo de "Contraseña".
        *   **`exists_unlinked`:** El correo pertenece a un cliente registrado en ServiVENT (ej. de una venta anterior) pero sin cuenta web. La interfaz muestra un mensaje de bienvenida personalizado (ej. "¡Hola de nuevo, Juan!") y le pide **crear una contraseña para activar su cuenta**, vinculando su perfil existente a su nueva cuenta de autenticación.
        *   **`new`:** El correo es completamente nuevo. La interfaz se expande para mostrar un **formulario de registro completo** con campos para "Nombre Completo", "Teléfono" y "Contraseña".
    *   **Vinculación por Número de Teléfono:** En el flujo de registro `new`, mientras el usuario introduce su número de teléfono, el sistema realiza una segunda verificación en tiempo real con `find_client_by_phone`.
        *   Si se encuentra un perfil de cliente existente (sin cuenta web) asociado a ese número, la interfaz cambia y pregunta: "¿Deseas vincular este nuevo correo a tu perfil existente a nombre de [Nombre del Cliente]?".
        *   Si el cliente confirma, el proceso de registro no crea un cliente duplicado, sino que **actualiza el perfil existente** con el nuevo correo y lo vincula a la nueva cuenta de autenticación.

2.  **Lógica de Backend:**
    *   **`link-existing-client` (Edge Function):** Gestiona la activación de cuentas para clientes ya existentes (`exists_unlinked`), creando el usuario en `auth.users` y vinculándolo al `cliente_id` correspondiente.
    *   **`create_client_profile_for_new_user` (Trigger):** Orquesta la creación y vinculación de perfiles para el flujo `new`. Fue mejorado para manejar el `existingClientId` (pasado desde el frontend en caso de vinculación por teléfono) y para **insertar manualmente una notificación** cuando se realiza una vinculación, ya que esta operación es un `UPDATE` y no dispara el trigger de `INSERT`.

3.  **Portal de Cliente (`CuentaClientePage.tsx`):**
    *   Una vez autenticado (sea por login, registro o activación), el cliente puede acceder a su portal personal (`/cuenta`).
    *   Esta página protegida contiene pestañas para:
        *   **"Mis Pedidos":** Historial de compras con acceso al detalle de cada una (`ClientePedidoDetailPage.tsx`).
        *   **"Mis Datos":** Para ver su información de perfil.
        *   **"Mis Direcciones":** Donde podrá gestionar sus direcciones de envío.

4.  **Seguridad y Sesión:**
    *   El sistema utiliza JWT para la gestión de sesiones.
    *   Las políticas RLS garantizan que un cliente solo pueda ver y gestionar sus propios datos (perfil y pedidos).

### Fase 4: Gestión de Direcciones de Cliente con Mapas

Esta fase mejorará drásticamente la experiencia del cliente y la logística de la empresa al permitir a los clientes guardar y gestionar múltiples direcciones de envío con ubicaciones precisas en un mapa.

#### 4.1. Backend (Base de Datos)

-   **Nueva Tabla `direcciones_clientes`:**
    -   `id` (uuid, PK), `cliente_id` (uuid, FK a `clientes`), `empresa_id` (uuid, FK a `empresas`).
    -   `nombre` (text): Etiqueta amigable, ej. "Hogar", "Oficina".
    -   `direccion_texto` (text): Detalles adicionales, ej. "Edificio Azul, Apto 5B".
    -   `latitud` (numeric), `longitud` (numeric): Coordenadas para el mapa.
    -   `es_principal` (boolean): `true` si es la dirección por defecto.
-   **Seguridad RLS:** Políticas para asegurar que un cliente solo pueda acceder y gestionar sus propias direcciones.
-   **Funciones RPC:**
    -   `get_my_direcciones()`: Devuelve todas las direcciones del cliente autenticado.
    -   `upsert_direccion(...)`: Crea o actualiza una dirección, gestionando el flag `es_principal` para asegurar que solo una pueda serlo.
    -   `delete_direccion(p_direccion_id)`: Elimina una dirección de forma segura.

#### 4.2. Frontend (Portal de Cliente - "Mis Direcciones")

-   **Actualización de `CuentaClientePage.tsx`:**
    -   **Vista Vacía:** Mensaje "Añadir mi primera dirección".
    -   **Lista de Direcciones:** Tarjetas mostrando nombre, detalles y un indicador de "Principal".
    -   **Acciones por Tarjeta:** "Editar", "Eliminar" y un botón destacado **"Ver en Google Maps"** que abrirá `https://maps.google.com/?q=<latitud>,<longitud>`.
    -   **Botón "Añadir Dirección"**: Abrirá el modal de creación/edición.

#### 4.3. Frontend (Modal Interactivo con Mapa - `DireccionFormModal.tsx`)

-   **Integración con Google Maps API:** Utilizará las APIs "Maps JavaScript API" y "Places API".
-   **Formulario:** Campos para "Nombre del Lugar", "Detalles" y "Es Principal".
-   **Mapa Interactivo:**
    -   Un mapa de Google con una barra de búsqueda de direcciones (usando Places API).
    -   Un marcador (pin) en el centro que el usuario puede posicionar arrastrando el mapa.
    -   La posición del pin actualizará los campos `latitud` y `longitud` del formulario en tiempo real.
    -   el mapa mostrar la ubicacion actual del cliente.

#### 4.4. Integración en el Flujo de Compra

-   **Modificación Tabla `ventas`:** Se añadirá una columna `direccion_entrega_id` (uuid, nullable).
-   **Actualización del Checkout:**
    -   Al elegir "Envío a Domicilio", se mostrará la lista de direcciones guardadas en lugar de un campo de texto.
    -   Habrá una opción para "Añadir otra dirección", que abrirá el `DireccionFormModal`.
    -   Al confirmar el pedido, se guardará el `id` de la dirección seleccionada.
-   **Visibilidad para la Empresa:** En `VentaDetailPage.tsx`, el personal verá los detalles de la dirección de entrega, incluyendo un enlace a Google Maps para facilitar la logística.

### Fase 5: Logística de Entrega y Despacho (Flujo Unificado)

Este paso ocurre durante el checkout, después de que el cliente ya ha iniciado sesión.

1.  **Paso Único: "Método de Entrega"**
    -   Se le presentan al cliente dos opciones principales: **"Retiro en Sucursal"** y **"Envío a Domicilio"**.

2.  **Flujo "Retiro en Sucursal":**
    -   Si la empresa tiene más de una sucursal, se le muestra una lista de las sucursales disponibles para que seleccione una.
    -   El `sucursal_id` seleccionado se asigna al pedido.
    -   (Si solo hay una sucursal, se selecciona automáticamente).

3.  **Flujo "Envío a Domicilio":**
    -   **Selección de Dirección:** Se le muestra al cliente su lista de direcciones guardadas (gestionadas desde el Portal de Cliente) para que seleccione una. El `id` de la dirección se guardará en la `venta`.
    -   **Selección de Sucursal de Despacho (Lógica Crítica):** Se le pide al cliente que seleccione de qué sucursal se deben despachar los productos. Esto es fundamental para saber de qué inventario descontar el stock.

### Fase 6: Gestión de Ubicaciones de Sucursales con Mapas

Esta fase integra la geolocalización en la gestión de sucursales, mejorando la experiencia tanto para el administrador como para el cliente final. Se implementará en 5 sub-fases.

#### 6.1. Backend: La Base Geográfica

-   **Modificación de Base de Datos:** Se añadirán las columnas `latitud` (numeric) y `longitud` (numeric) a la tabla `public.sucursales`.
-   **Actualización de RPC:** Las funciones `create_sucursal` y `update_sucursal` se modificarán para aceptar y guardar las nuevas coordenadas.

#### 6.2. Modal de Sucursal: El Centro de Mando Geográfico (`SucursalFormModal.tsx`)

-   **Diseño Interactivo:** El modal se rediseñará para incluir un **mapa interactivo de Google Maps** junto a los campos de texto.
-   **Búsqueda Inteligente:** Una barra de búsqueda sobre el mapa utilizará la **API de Google Maps Places** para sugerir direcciones y comercios. Al seleccionar un lugar, el mapa se centrará y posicionará el marcador.
-   **Marcador Arrastrable:** El administrador podrá arrastrar un pin en el mapa para ajustar la ubicación con precisión.
-   **Sincronización Automática:** Al soltar el marcador, los campos `latitud`, `longitud` y `direccion` del formulario se actualizarán automáticamente usando la **API de Geocoding Inverso**.

#### 6.3. Vista de Lista de Sucursales: Reconocimiento Visual (`SucursalesListPage.tsx`)

-   **Tarjetas Enriquecidas (`SucursalCard.tsx`):** Cada tarjeta de sucursal mostrará una pequeña **imagen de mapa estático** (generada con la **API de Google Static Maps**) con la ubicación de la sucursal, además de su nombre, dirección y KPIs de usuarios.

#### 6.4. Vista de Detalle de Sucursal: Gestión y Acceso Rápido (`SucursalDetailPage.tsx`)

-   **Mapa Prominente:** En la pestaña de detalles, se mostrará un mapa estático más grande.
-   **Acceso Directo a Google Maps:** Al hacer clic en el mapa, se abrirá una nueva pestaña en Google Maps con la ubicación exacta de la sucursal, lista para que el administrador obtenga indicaciones.

#### 6.5. Experiencia del Cliente Final: Facilidad de Ubicación

-   **Modal de Sucursal en Catálogo:** En el catálogo público, cuando un cliente vea los detalles de una sucursal, el modal incluirá la **imagen del mapa estático**.
-   **Enlace Directo para Indicaciones:** Al igual que en el panel de administración, este mapa será un enlace directo a Google Maps, permitiendo al cliente obtener la ruta para llegar a la tienda con un solo clic.

### Fase 7: Procesamiento de Pedidos (Interfaz de Empresa)

Este es el flujo que sigue el personal de la empresa después de que un cliente realiza un pedido desde el catálogo web.

1.  **Recepción del Pedido:** Cuando un cliente finaliza su compra, se crea un nuevo registro en la tabla `ventas` con un estado especial: **"Pedido Web Pendiente"**. El inventario **NO** se descuenta en este momento.
2.  **Notificación y Visibilidad:**
    -   Se genera una notificación en tiempo real para alertar al personal.
    -   En la `VentasPage.tsx`, una nueva pestaña o filtro "Pedidos Web" mostrará estas nuevas órdenes para su gestión.
3.  **Gestión en `VentaDetailPage.tsx`:**
    -   Al abrir el detalle de un pedido web, el sistema realizará una **verificación de stock en tiempo real** para la sucursal de despacho asignada.
    -   Se mostrará de forma prominente la información de entrega (dirección de envío o sucursal de retiro).
    -   **Si el stock es correcto:** El personal usará un botón para **"Confirmar y Despachar"**. Esta acción cambiará el estado de la venta (ej. a "Pagada" o "En Preparación") y **finalmente descontará el stock** del inventario.
    -   **Si hay inconsistencias de stock:** Se mostrarán alertas visuales. El personal podrá contactar al cliente o ajustar el pedido.

### Fase 8: Notificaciones y Aislamiento

-   **Aislamiento de Pedidos:** Gracias a las políticas RLS, solo los usuarios de la sucursal de destino (para "Retiro") o de la sucursal de despacho (para "Envío") verán el pedido y la notificación correspondiente. El Propietario tendrá visibilidad total.
