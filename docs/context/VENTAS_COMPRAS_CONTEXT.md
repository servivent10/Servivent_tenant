# Contexto y Especificación: Módulos de Ventas (POS) y Compras

Este documento define la arquitectura y el diseño del módulo de **Ventas (Punto de Venta)** y la especificación futura del módulo de **Compras**.

## 1. Módulo de Ventas: Punto de Venta (POS)

### Objetivo

Proporcionar una interfaz rápida, intuitiva y optimizada para pantallas táctiles que permita a los empleados registrar ventas de manera eficiente, aplicando dinámicamente diferentes políticas de precios.

-   **Página:** `TerminalVentaPage.tsx`.

### Diseño y Experiencia de Usuario (UI/UX)

-   **Layout de 3 Columnas (Escritorio):**
    1.  **Catálogo de Productos:** Una cuadrícula visual de productos con un buscador rápido (por nombre o SKU) y botones de filtro por categoría. Los productos sin stock en la sucursal actual se muestran deshabilitados para prevenir errores.
    2.  **Carrito de Compra:** La lista de productos seleccionados, con opciones para ajustar la cantidad con botones `+` y `-`, eliminar artículos y ver el subtotal y total actualizándose en tiempo real.
    3.  **Panel de Venta:** Contiene los controles para finalizar la transacción.
-   **Diseño Responsivo (Móvil/Tablet):** El layout se adapta a un flujo de 2 columnas en tablets y 1 columna en móviles. El catálogo de productos y el carrito se apilan verticalmente para una experiencia de usuario fluida en cualquier dispositivo.

### Lógica de Negocio Clave: Selector de Listas de Precios

La funcionalidad más potente del nuevo Punto de Venta es el **selector de listas de precios**.
-   **Funcionamiento:** En la parte superior del panel de venta, un menú desplegable muestra todas las listas de precios creadas en la configuración (ej. "General", "Mayorista", "Oferta Black Friday").
-   **Recálculo Instantáneo:** Al seleccionar una lista diferente, **todos los precios de los productos en el carrito se recalculan automáticamente**. El sistema busca el precio específico para cada producto en la lista seleccionada. Si no existe un precio específico, utiliza el precio de la lista "General" como respaldo.
-   **Beneficios Estratégicos:**
    -   **Flexibilidad:** Permite vender a diferentes tipos de clientes (minoristas, mayoristas) con precios distintos desde la misma interfaz y sin cometer errores.
    -   **Promociones:** Facilita la activación de precios de oferta para toda la tienda con un solo clic.
    -   **Control:** Centraliza la gestión de precios en el módulo de configuración, asegurando consistencia en todas las ventas.

### Base de Datos Propuesta para el Futuro

Para registrar las ventas finalizadas (funcionalidad futura), se utilizarán las siguientes tablas:
-   **`ventas`:** Almacenará la cabecera de cada transacción (ID, cliente_id, sucursal_id, total, fecha, lista_precio_id).
-   **`venta_items`:** Guardará cada producto vendido en una transacción (venta_id, producto_id, cantidad, precio_unitario_aplicado).
-   **`caja_sesiones`:** Registrará la apertura y cierre de caja de cada empleado.

---

## 2. Módulo de Compras (Planificación Futura)

### Objetivo

Permitir el registro de las compras de mercancía a proveedores, actualizando tanto el costo de los productos como el inventario.

-   **Página:** `ComprasPage.tsx`.

### Diseño y Experiencia de Usuario (UI/UX)

-   **Página Principal:** Una lista (tabla/tarjetas) del historial de compras realizadas.
-   **Formulario de Nueva Compra:**
    1.  Selección de proveedor.
    2.  Fecha de la compra y número de factura/referencia.
    3.  Un buscador de productos para añadir artículos a la orden de compra.
    4.  Campos para especificar la **cantidad** y el **costo de adquisición** de cada producto.
    5.  Cálculo del total de la compra.

### Base de Datos Propuesta

-   **`proveedores`:** Tabla para gestionar la información de los proveedores.
-   **`compras`:** Almacenará la cabecera de cada compra (ID, proveedor_id, sucursal_id, total, fecha).
-   **`compra_items`:** Guardará cada producto comprado (compra_id, producto_id, cantidad, costo_unitario).

## 3. Integración con Inventarios

Ambos módulos son críticos para el control de inventario:
-   **Ventas:** Cada venta finalizada **disminuirá** la cantidad en la tabla `inventarios` para el `producto_id` y `sucursal_id` correspondientes.
-   **Compras:** Cada compra registrada **aumentará** la cantidad en la tabla `inventarios` y actualizará el `precio_compra` (Costo Promedio Ponderado) en la tabla `productos`.

Esta lógica se encapsulará en funciones de base de datos (`triggers` o `RPCs`) para garantizar la consistencia de los datos (atomicidad).