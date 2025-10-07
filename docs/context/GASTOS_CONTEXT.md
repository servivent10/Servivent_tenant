# MÓDULO 06: OPERACIONES
## Gastos

Este documento define la arquitectura y funcionalidad del módulo de **Gastos**, diseñado para registrar y supervisar todos los gastos operativos del negocio.

## 1. Objetivo del Módulo

-   Permitir el registro rápido de cualquier gasto, asociándolo a una fecha, concepto, monto y categoría.
-   Ofrecer la capacidad de adjuntar un comprobante digital (imagen o PDF) a cada gasto para fines de auditoría.
-   Proporcionar herramientas de filtrado para analizar los gastos por período, categoría, usuario o sucursal.

## 2. Página Clave: `GastosPage.tsx`

-   **Acceso:** Disponible solo para roles de **Propietario** y **Administrador**.
-   **KPIs:** Muestra tarjetas con el total gastado, el número de gastos y el gasto promedio, todos calculados en base a los filtros seleccionados.
-   **Filtrado Avanzado:**
    -   Un filtro rápido por rango de fechas.
    -   Un panel de filtros avanzados para buscar por categoría de gasto, usuario que registró el gasto y sucursal.
-   **Visualización Responsiva:**
    -   **Escritorio:** Una tabla muestra el historial de gastos con columnas para fecha, concepto, categoría y monto.
    -   **Móvil/Tablet:** Se utilizan tarjetas que resumen la información de cada gasto.
-   **Acciones:** Permite añadir, editar y eliminar gastos.

## 3. Componentes y Modales

-   **`GastoFormModal.tsx`:** Un modal para crear o editar un gasto. Incluye:
    -   Campos para concepto, monto y fecha.
    -   Un **selector de categorías con búsqueda** que permite seleccionar una categoría existente o crear una nueva sobre la marcha (`GastoCategoriaFormModal`).
    -   Un área para arrastrar y soltar o seleccionar un archivo de comprobante, que se sube a Supabase Storage.
-   **`GastoCategoriaFormModal.tsx`:** Un sub-modal para la creación rápida de nuevas categorías de gastos.

## 4. Lógica de Backend (Funciones RPC)

-   **`get_company_gastos()`:** Obtiene la lista de gastos, aplicando los filtros de fecha, categoría, usuario y sucursal enviados desde el frontend. También devuelve estadísticas (suma y conteo) para los KPIs.
-   **`upsert_gasto()`:** Crea o actualiza un registro de gasto.
-   **`delete_gasto()`:** Elimina un registro de gasto.
-   **`get_gastos_filter_data()`:** Carga las listas de categorías, usuarios y sucursales para poblar los menús de los filtros avanzados.
-   **`upsert_gasto_categoria()` y `delete_gasto_categoria()`:** Gestionan las categorías de gastos.
