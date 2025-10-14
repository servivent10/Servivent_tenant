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

### Fase 3: Flujo de Acceso de Clientes (Email y Contraseña) y Portal de Cliente

Esta fase implementa un sistema de autenticación robusto y familiar, basado en el método clásico de correo y contraseña, pero con una lógica inteligente para integrar a los clientes ya existentes en ServiVENT.

1.  **Activación del Flujo:** El cliente inicia el proceso haciendo clic en "Identifícate" o "Crear Cuenta", lo que le dirigirá a las nuevas páginas de `login` y `registro` del catálogo.

2.  **Página de Registro (`/registro`):**
    *   El cliente introduce su correo electrónico.
    *   **Verificación Inteligente en Backend:** El sistema comprueba el estado del correo:
        *   **Cliente Nuevo:** Si el correo no existe, se muestran los campos para "Nombre Completo", "telefono" y "Contraseña". Al enviar, se llama a `supabase.auth.signUp()`. Un trigger en la base de datos creará automáticamente el perfil correspondiente en la tabla `public.clientes`.
        *   **Cliente Existente de ServiVENT:** Si el correo ya existe en `public.clientes` pero nunca ha accedido al catálogo web (no tiene cuenta en `auth.users`), la interfaz mostrará un mensaje de bienvenida (ej. "¡Hola de nuevo, Juan!") y solicitará **únicamente la creación de una contraseña** para activar su cuenta web. Al enviar, una Edge Function se encargará de crear el usuario en `auth.users` y vincularlo de forma segura al perfil de cliente ya existente.
    *   El cliente inicia sesión automáticamente tras el registro/activación.

3.  **Página de Inicio de Sesión (`/login`):**
    *   Un formulario estándar de "Correo Electrónico" y "Contraseña".
    *   Al enviar, se llama a `supabase.auth.signInWithPassword()`.

4.  **Gestión de Sesión Segura:**
    *   Tras un inicio de sesión o registro exitoso, Supabase genera un JWT (JSON Web Token) que mantiene la sesión del cliente segura y activa mientras navega por el catálogo.

5.  **Portal de Cliente (`CuentaClientePage.tsx`):**
    *   Una vez autenticado, el cliente puede acceder a su portal personal (`/cuenta`).
    *   Esta página protegida contendrá pestañas para:
        *   **"Mis Pedidos":** Historial de compras y estado de los pedidos.
        *   **"Mis Datos":** Para actualizar su información de perfil.
        *   **"Mis Direcciones":** Para gestionar direcciones de envío (funcionalidad futura).

6.  **Seguridad:** Nuevas políticas RLS garantizarán que un cliente autenticado pueda acceder y modificar **únicamente sus propios datos**, manteniendo la privacidad y la integridad de la información.

### Fase 4: Logística de Entrega y Despacho (Flujo Unificado)

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

### Fase 5: Gestión de Ubicaciones con Mapas

-   **Backend:** Se añadirán columnas `latitud` y `longitud` a la tabla `sucursales`.
-   **UI (Propietario):** El modal `SucursalFormModal` incluirá un mapa interactivo para que el propietario establezca la ubicación exacta de sus sucursales.
-   **UI (Público):** El modal "Nuestra Empresa" usará estas coordenadas para mostrar un mapa por cada sucursal.

### Fase 6: Procesamiento de Pedidos (Interfaz de Empresa)

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

### Fase 7: Notificaciones y Aislamiento

-   **Aislamiento de Pedidos:** Gracias a las políticas RLS, solo los usuarios de la sucursal de destino (para "Retiro") o de la sucursal de despacho (para "Envío") verán el pedido y la notificación correspondiente. El Propietario tendrá visibilidad total.