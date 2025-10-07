# MÓDULO 06: OPERACIONES
## Traspasos

Este documento describe el estado actual y la visión futura del módulo de **Traspasos**.

## 1. Objetivo del Módulo (Visión a Futuro)

El objetivo de este módulo será permitir la transferencia de stock de productos entre las diferentes sucursales de la empresa. Esto es crucial para negocios con múltiples ubicaciones que necesitan reequilibrar su inventario sin registrar una compra o una venta.

## 2. Estado Actual

-   **Página:** `TraspasosPage.tsx`
-   **Funcionalidad:** Actualmente, el módulo consiste en una página de marcador de posición (`placeholder`). El enlace de navegación existe en la barra lateral, pero la página en sí no contiene ninguna funcionalidad implementada.

## 3. Flujo de Usuario Futuro

1.  **Creación de Traspaso:** El usuario (Propietario o Administrador) iniciará un nuevo traspaso.
2.  **Definición de Origen y Destino:** Se seleccionará la sucursal de origen (de donde sale el stock) y la sucursal de destino (a donde llega).
3.  **Selección de Productos:** El usuario buscará y añadirá los productos y las cantidades a transferir. El sistema validará que la sucursal de origen tenga stock suficiente.
4.  **Confirmación:** Al confirmar, el sistema registrará el traspaso y generará dos movimientos de inventario:
    -   Un movimiento de **salida** en la sucursal de origen.
    -   Un movimiento de **entrada** en la sucursal de destino.
5.  **Historial:** La página principal del módulo mostrará un historial de todos los traspasos realizados, con la capacidad de ver los detalles de cada uno.
