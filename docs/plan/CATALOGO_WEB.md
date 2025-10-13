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

### Fase 3: Flujo de Acceso de Clientes ("Passwordless") y Portal de Cliente (Post-Autenticación)

Esta fase es crítica para ofrecer una experiencia de acceso segura y sin fricción antes de permitir la compra.

1.  **Activación del Flujo:** El proceso se inicia cuando un usuario no autenticado intenta realizar una acción que requiere una sesión, como **"Añadir al Carrito"** o acceder a **"Mi Cuenta"**.
2.  **Modal de Identificación:** Se presenta un modal simple (`IdentificacionClienteModal`) que solo solicita una cosa: el **correo electrónico** del cliente.
3.  **Verificación en Tiempo Real:** Mientras el cliente escribe su correo, el sistema verifica si el correo ya existe en la base de clientes de la empresa.
    *   **Si el correo existe:** El formulario muestra un mensaje de bienvenida (ej. "¡Hola de nuevo!" mas su nombre completo).
    *   **Si el correo no existe:** El formulario se expande para solicitar los campos adicionales "Nombre Completo" y "Teléfono".
4.  **Envío de Enlace Mágico:** El cliente hace clic en "Enviar enlace de acceso".
    *   El backend utiliza la función `signInWithOtp` de Supabase para enviar un **enlace mágico** de un solo uso al correo proporcionado.
    *   Si es un cliente nuevo, primero se crea su registro en la tabla `clientes` si es exitoso se agrega a `historial_cambios` y `notificaciones` para el historia de auditoria y la notificacion en tiempo real en el sistema ServiVENT y luego se envía el enlace.
5.  **Confirmación en la UI:** El modal se cierra y la interfaz muestra una notificación (`Toast`) o un mensaje indicando: **"¡Listo! Revisa tu correo para acceder a tu cuenta."**
6.  **Acceso y Sesión Segura:**
    *   El cliente abre su correo y hace clic en el enlace.
    *   Es redirigido de vuelta al catálogo web, pero ahora ya tiene una **sesión segura y activa**.
7.  **Continuación de la Compra:** Con la sesión activa, el cliente ya puede añadir productos al carrito, gestionar sus direcciones y finalizar sus pedidos con normalidad.

-   **Acceso:** Un enlace "Identificate" en el header permitirá a los clientes iniciar sesión con el flujo de "enlace mágico".
-   **`CuentaClientePage.tsx`:** Una nueva página protegida con las siguientes pestañas:
    -   **"Mis Pedidos":** Historial completo de compras y pedidos.
    -   **"Mis Datos":** Para actualizar información personal.
    -   **"Mis Direcciones":** Para gestionar direcciones de envío.
-   **Seguridad:** Nuevas políticas RLS permitirán que un cliente autenticado acceda **únicamente a sus propios datos**.

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

### Fase 6: Gestión de Ubicaciones con Mapas

-   **Backend:** Se añadirán columnas `latitud` y `longitud` a la tabla `sucursales`.
-   **UI (Propietario):** El modal `SucursalFormModal` incluirá un mapa interactivo para que el propietario establezca la ubicación exacta de sus sucursales.
-   **UI (Público):** El modal "Nuestra Empresa" usará estas coordenadas para mostrar un mapa por cada sucursal.

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