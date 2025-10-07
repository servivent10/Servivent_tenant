# MÓDULO 07: TERCEROS
## Proveedores

Este documento define la arquitectura y funcionalidad del módulo de **Proveedores**, enfocado en la gestión de la información de los proveedores y sus cuentas por pagar.

## 1. Objetivo del Módulo

-   Centralizar la información de contacto y fiscal de todos los proveedores.
-   Mantener un registro del saldo pendiente (cuentas por pagar) a cada proveedor, calculado a partir de las compras a crédito.
-   Facilitar la creación y edición de la información de los proveedores.

## 2. Página Clave: `ProveedoresPage.tsx`

-   **KPIs:** Muestra tarjetas con el número total de proveedores activos y el monto total de la deuda a proveedores (cuentas por pagar).
-   **Acciones Principales:**
    -   **Añadir Proveedor:** Abre el modal `ProveedorFormModal` para registrar un nuevo proveedor.
-   **Visualización Responsiva:**
    -   **Escritorio:** Una tabla muestra la información clave de cada proveedor, incluyendo nombre, contacto y saldo pendiente.
    -   **Móvil/Tablet:** Se utilizan tarjetas que resumen la información de cada proveedor.
-   **Acciones por Fila:** Permite editar la información de un proveedor. La eliminación no está permitida si el proveedor tiene un historial de compras para mantener la integridad de los datos.

## 3. Componentes y Modales

-   **`ProveedorFormModal.tsx`:** Un modal para crear o editar la información de un proveedor. Incluye campos para nombre de la empresa, nombre del contacto, NIT, teléfono, correo y dirección.

## 4. Lógica de Backend (Funciones RPC)

-   **`get_company_providers()`:** Obtiene la lista completa de proveedores de la empresa. Para cada proveedor, calcula la suma de los `saldo_pendiente` de todas sus compras asociadas para mostrar el total de cuentas por pagar.
-   **`upsert_proveedor()`:** Función para crear un nuevo proveedor o actualizar la información de uno existente.
