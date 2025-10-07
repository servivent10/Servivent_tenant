# MÓDULO 07: TERCEROS
## Clientes

Este documento define la arquitectura y funcionalidad del módulo de **Clientes**, diseñado para la gestión de la base de datos de clientes y sus cuentas por cobrar.

## 1. Objetivo del Módulo

-   Centralizar la información de contacto y fiscal de todos los clientes.
-   Llevar un registro del saldo pendiente (cuentas por cobrar) de cada cliente.
-   Facilitar la creación, edición, eliminación e importación/exportación masiva de clientes.

## 2. Página Clave: `ClientesPage.tsx`

-   **KPIs:** Muestra tarjetas con el número total de clientes y el monto total de las cuentas por cobrar.
-   **Acciones Principales:**
    -   **Añadir Cliente:** Abre el modal `ClienteFormModal` para registrar un nuevo cliente.
    -   **Importar/Exportar:** Permite la importación masiva desde un archivo CSV (usando `ImportClientesModal`) y la exportación de la base de datos actual a CSV.
-   **Visualización Responsiva:**
    -   **Escritorio:** Una tabla muestra la información clave de cada cliente, incluyendo su avatar, nombre, código, contacto y saldo pendiente.
    -   **Móvil/Tablet:** Se utilizan tarjetas que resumen la información de cada cliente para una mejor legibilidad.
-   **Acciones por Fila:** Permite editar y eliminar clientes individuales.

## 3. Componentes y Modales

-   **`ClienteFormModal.tsx`:** Un modal para crear o editar la información de un cliente. Incluye campos para nombre, NIT/CI, contacto y dirección, además de una opción para subir una foto de perfil (avatar).
-   **`ImportClientesModal.tsx`:** Un modal de varios pasos que guía al usuario para:
    1.  Descargar una plantilla CSV.
    2.  Subir el archivo CSV con los datos de los clientes.
    3.  Confirmar la importación. El backend procesa el archivo, actualizando clientes existentes (basado en NIT/CI) y creando los nuevos.

## 4. Lógica de Backend (Funciones RPC)

-   **`get_company_clients()`:** Obtiene la lista completa de clientes de la empresa, incluyendo su saldo pendiente calculado.
-   **`upsert_client()`:** Función para crear un nuevo cliente o actualizar uno existente. Al crear, genera un `codigo_cliente` único y aleatorio.
-   **`delete_client()`:** Elimina un cliente. Las ventas asociadas no se eliminan, sino que se desvinculan (el campo `cliente_id` en la venta pasa a ser `NULL`).
-   **`import_clients_in_bulk()`:** Procesa un array de datos de clientes desde el frontend. Itera sobre los registros, actualizando los existentes y creando los nuevos, y devuelve un resumen de la operación.
