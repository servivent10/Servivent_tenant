# MÓDULO 04: GESTIÓN DE UBICACIONES
## Depósitos (Almacenes)

Este documento define la arquitectura y el plan de implementación para la nueva entidad "Depósito". Su propósito es crear un tipo de ubicación que sirva exclusivamente para el almacenamiento de inventario y la logística de traspasos, sin tener capacidades de venta ni visibilidad pública.

## 1. Decisión Arquitectónica: Reutilización de la Tabla `sucursales`

Para implementar la funcionalidad de "Depósitos", se ha optado por la **Opción 2**, que consiste en **reutilizar la tabla existente `public.sucursales`**, añadiendo una columna para diferenciar el tipo de ubicación.

Esta decisión se basa en los siguientes principios de arquitectura robusta:

-   **Mínimo Impacto:** Evita una re-arquitectura masiva. Casi todas las tablas del sistema que manejan inventario (`inventarios`, `traspasos`, `compras`, etc.) ya tienen una relación con `sucursal_id`. Crear una tabla separada para `depositos` requeriría modificar decenas de tablas y funciones, introduciendo un riesgo innecesario.
-   **Consistencia de Datos:** Mantiene una única "fuente de verdad" para todas las ubicaciones físicas de la empresa. Un depósito es, conceptualmente, un tipo de sucursal con capacidades restringidas.
-   **Mantenibilidad:** Simplifica las consultas y la lógica de negocio. Para operaciones como los traspasos, donde tanto sucursales como depósitos pueden participar, se puede seguir consultando una única tabla de ubicaciones.
-   **Escalabilidad:** El modelo está preparado para futuras expansiones. Si en el futuro se necesitara un tercer tipo de ubicación (ej. "Oficina Administrativa"), el sistema ya estaría diseñado para soportarlo.

## 2. Plan de Implementación Técnico

La implementación se divide en dos fases principales: cambios en el backend para enforzar las reglas de negocio de forma segura, y cambios en el frontend para la interacción del usuario.

### 2.1. Backend (Base de Datos)

Las restricciones críticas se implementarán directamente en la base de datos para garantizar la máxima seguridad e integridad.

#### A. Modificación de la Tabla `sucursales`

Se añadirá una columna `tipo` para distinguir entre un punto de venta y un almacén.

```sql
-- Añadir la columna 'tipo' que por defecto será 'Sucursal' para todos los registros existentes.
ALTER TABLE public.sucursales
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'Sucursal';

-- Añadir una restricción CHECK para asegurar que solo los valores permitidos puedan ser insertados.
ALTER TABLE public.sucursales
ADD CONSTRAINT sucursales_tipo_check CHECK (tipo IN ('Sucursal', 'Depósito'));
```

#### B. Restricción de Ventas (Trigger)

Para garantizar que un `Depósito` **nunca** pueda registrar una venta, se creará un trigger en la tabla `ventas`. Esta es la medida de seguridad más importante, ya que protege la lógica de negocio incluso si hubiera un error en el frontend.

```sql
-- 1. Crear la función del trigger
CREATE OR REPLACE FUNCTION prevent_deposito_sales()
RETURNS TRIGGER AS $$
DECLARE
    v_sucursal_tipo text;
BEGIN
    -- Obtener el tipo de la sucursal donde se está intentando registrar la venta.
    SELECT tipo INTO v_sucursal_tipo FROM public.sucursales WHERE id = NEW.sucursal_id;

    -- Si la sucursal es un 'Depósito', abortar la transacción con un error.
    IF v_sucursal_tipo = 'Depósito' THEN
        RAISE EXCEPTION 'Operación no permitida: No se pueden registrar ventas en un Depósito.';
    END IF;

    -- Si no es un depósito, permitir que la inserción continúe.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincular el trigger a la tabla 'ventas'
DROP TRIGGER IF EXISTS on_before_venta_insert_check_deposito ON public.ventas;
CREATE TRIGGER on_before_venta_insert_check_deposito
BEFORE INSERT ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION prevent_deposito_sales();
```

#### C. Restricción de Sesiones de Caja (Trigger) - **ACTUALIZADO**

De manera similar a las ventas, se impedirá la apertura de una sesión de caja en una ubicación que sea un `Depósito`.

```sql
-- 1. Crear la función del trigger
CREATE OR REPLACE FUNCTION prevent_deposito_cash_session()
RETURNS TRIGGER AS $$
DECLARE
    v_sucursal_tipo text;
BEGIN
    SELECT tipo INTO v_sucursal_tipo FROM public.sucursales WHERE id = NEW.sucursal_id;
    IF v_sucursal_tipo = 'Depósito' THEN
        RAISE EXCEPTION 'Operación no permitida: No se puede abrir una caja en un Depósito.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincular el trigger a la tabla 'sesiones_caja'
DROP TRIGGER IF EXISTS on_before_caja_insert_check_deposito ON public.sesiones_caja;
CREATE TRIGGER on_before_caja_insert_check_deposito
BEFORE INSERT ON public.sesiones_caja
FOR EACH ROW
EXECUTE FUNCTION prevent_deposito_cash_session();
```

#### D. Ocultar en Catálogo Público (RPC)

Para asegurar que los depósitos no aparezcan en la lista de ubicaciones del catálogo web, se modificará la función `get_public_catalog_data`.

-   **Función a Modificar:** `get_public_catalog_data(p_slug text)`
-   **Cambio Requerido:** En la consulta que obtiene la lista de sucursales (`sucursales_list`), se deberá añadir una cláusula `WHERE` para filtrar solo las de tipo 'Sucursal'.

```sql
-- Ejemplo del cambio en la subconsulta de la función:
...
SELECT json_agg(s_info) INTO sucursales_list FROM (
    SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales
    WHERE empresa_id = v_empresa_id AND tipo = 'Sucursal' -- <-- LÍNEA AÑADIDA
    ORDER BY nombre
) AS s_info;
...
```

### 2.2. Frontend (Interfaz de Usuario)

#### A. Formulario de Creación/Edición (`SucursalFormModal.tsx`)

-   **Cambio:** Se añadirá un nuevo campo en el formulario para seleccionar el tipo de ubicación.
-   **Implementación Sugerida:** Un grupo de botones de radio con dos opciones:
    -   `Sucursal (Punto de Venta)`
    -   `Depósito (Solo Almacén)`
-   **Lógica:** El valor seleccionado (`'Sucursal'` o `'Depósito'`) se guardará en la nueva columna `tipo` de la tabla `sucursales`.

#### B. Vista de Lista (`SucursalesListPage.tsx`)

-   **Cambio:** Se añadirá un indicador visual en cada tarjeta o fila de la tabla para diferenciar rápidamente entre sucursales y depósitos.
-   **Implementación Sugerida:** Una etiqueta (`badge`) con un color distintivo.
    -   Ejemplo: `<span class="bg-blue-100 text-blue-800 ...">Sucursal</span>`
    -   Ejemplo: `<span class="bg-slate-100 text-gray-800 ...">Depósito</span>`

#### C. Módulo de Traspasos (`NuevoTraspasoPage.tsx`, etc.)

-   **Cambio:** **No se requieren cambios funcionales.**
-   **Justificación:** Gracias a la reutilización de la tabla `sucursales`, los menús desplegables de "Sucursal de Origen" y "Sucursal de Destino" ya obtendrán automáticamente tanto sucursales como depósitos, ya que ambos son tipos de "ubicaciones" válidos para la transferencia de inventario. Esto demuestra la eficiencia de la arquitectura elegida.

#### D. Módulo de Ventas y Otros (`TerminalVentaPage.tsx`, etc.) - **ACTUALIZADO**

-   **Cambio:** Se debe asegurar que los `Depósitos` no aparezcan en los selectores de sucursal para operaciones que no les corresponden (como registrar una venta, un gasto o consultar historiales de caja).
-   **Implementación Sugerida:** Al obtener la lista de sucursales para estos componentes (ej. a través de las funciones RPC `get_gastos_filter_data` y `get_historial_cajas`), se debe filtrar `WHERE tipo = 'Sucursal'`.
-   **Red de Seguridad:** Incluso si un depósito se mostrara por error en la UI, los `TRIGGERS` de la base de datos (puntos 2.1.B y 2.1.C) impedirían la transacción, garantizando la integridad de los datos.

---

## 3. Contexto de Reversión: Estado Actual del Sistema (Snapshot)

Esta sección documenta el comportamiento de las funcionalidades clave del sistema **antes** de la implementación de "Depósitos". Sirve como referencia técnica para revertir los cambios si fuera necesario.

### 3.1. Visión General del Flujo Actual

Actualmente, el sistema opera bajo la premisa de que toda "ubicación" es una `Sucursal` con plenas capacidades. No existe una distinción entre puntos de venta y almacenes. Todas las sucursales pueden vender, comprar, recibir traspasos y aparecen en el catálogo público por defecto.

### 3.2. Funciones RPC Clave a ser Modificadas

-   **`create_sucursal` / `update_sucursal`:**
    -   **Estado Actual:** Estas funciones solo aceptan parámetros relacionados con la información de la sucursal (`nombre`, `direccion`, `telefono`, `latitud`, `longitud`). No tienen un parámetro `tipo`. Al crearse, toda nueva ubicación es inherentemente una `Sucursal` con todas las capacidades.

-   **`registrar_venta`:**
    -   **Estado Actual:** Esta función asocia una venta a un `sucursal_id` sin realizar ninguna validación sobre el tipo de sucursal, ya que este concepto no existe. Cualquier `sucursal_id` válido es aceptado para registrar una venta.

-   **`get_public_catalog_data`:**
    -   **Estado Actual:** Esta función, al obtener la lista de ubicaciones de la empresa, selecciona **todas** las filas de la tabla `sucursales` que pertenecen a la empresa del `slug` proporcionado. No aplica ningún filtro de tipo.
    -   **Impacto:** Todas las ubicaciones físicas son visibles públicamente en el catálogo web.

-   **Funciones de Gestión de Caja (`abrir_caja`, `get_sesion_activa`, etc.):**
    -   **Estado Actual:** La lógica de las cajas está vinculada a una `sucursal_id` (en modo "por sucursal") o a un `usuario_id`. No hay ninguna restricción que impida abrir una caja en una ubicación que no sea un punto de venta.

### 3.3. Componentes y Flujos de Frontend Afectados

-   **`SucursalFormModal.tsx`:**
    -   **Estado Actual:** El formulario de creación y edición de sucursales solo contiene los campos de información básica (nombre, dirección, etc.) y el mapa. No existe un campo para seleccionar el "Tipo" de ubicación.

-   **`SucursalesListPage.tsx`:**
    -   **Estado Actual:** La interfaz muestra una lista homogénea de sucursales. No hay ningún indicador visual que las diferencie por tipo o capacidad.

-   **`TerminalVentaPage.tsx` / `NuevaCompraPage.tsx` / `NuevoTraspasoPage.tsx`:**
    -   **Estado Actual:** Todos los menús desplegables que permiten seleccionar una sucursal (para filtrar, para distribuir stock, para definir origen/destino de traspaso) obtienen y muestran la lista completa de `sucursales` de la empresa sin distinción.