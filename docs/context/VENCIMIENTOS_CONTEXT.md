# MÓDULO 06: OPERACIONES
## Gestión de Vencimientos de Ventas a Crédito

Este documento define la arquitectura y el plan de implementación para un sistema completo de gestión de fechas de vencimiento. El objetivo es transformar el módulo de ventas en una herramienta proactiva de gestión de cobranza, alertando al usuario sobre cuentas por cobrar que están próximas a vencer o que ya han vencido.

### 1. Visión y Objetivo

El sistema debe responder de forma automática y visualmente clara a las siguientes preguntas para el usuario:
- ¿Qué ventas a crédito están por vencer?
- ¿Qué ventas ya están vencidas?
- ¿Cuánto dinero representan estas ventas vencidas?
- ¿Cómo puedo contactar rápidamente al cliente de una venta vencida?

### 2. Propuesta de Implementación (En Fases)

#### Fase 1: Enriquecer los Datos (Backend)

1.  **Estado de Vencimiento Calculado (Sin modificar la tabla):**
    -   Se modificará la función RPC `get_company_sales()`.
    -   Esta función calculará un **nuevo campo virtual** llamado `estado_vencimiento` en tiempo real con la siguiente lógica:
        -   Si `estado_pago` es 'Pagada', el `estado_vencimiento` será **'Pagada'**.
        -   Si `estado_pago` es 'Pendiente' o 'Abono Parcial':
            -   Si `fecha_vencimiento` es **mayor** a la fecha actual, el estado será **'Al día'**.
            -   Si `fecha_vencimiento` es **menor** a la fecha actual, el estado será **'Vencida'**.

2.  **KPIs para el Dashboard:**
    -   Se modificará la función RPC `get_dashboard_data()` para que calcule un nuevo KPI: **"Total de Cuentas por Cobrar Vencidas"**.

#### Fase 2: Mejorar la Visualización (Frontend)

1.  **Historial de Ventas (`VentasPage.tsx`):**
    -   **Píldoras de Estado Inteligentes:** La píldora de estado se mejorará para mostrar el nuevo `estado_vencimiento` con colores:
        -   **Verde** para 'Al día'.
        -   **Rojo** para 'Vencida'.
        -   Opcionalmente, mostrará información contextual como "Vence en 5 días" o "Vencida hace 10 días".
    -   **Nuevo Filtro:** Se añadirá un filtro "Estado de Vencimiento" con opciones: "Todas", "Al día", "Vencidas".

2.  **Dashboard (`DashboardPage.tsx`):**
    -   Se añadirá una nueva tarjeta de KPI prominente: **"Cuentas Vencidas"**, de color rojo o ámbar.

3.  **Detalle de Venta (`VentaDetailPage.tsx`):**
    -   Se mostrará una alerta visual clara (ej. un banner rojo) si la venta está vencida, indicando el retraso en días.

#### Fase 3: Notificaciones Proactivas (Inteligencia del Sistema)

1.  **Función Programada Diaria (Supabase Scheduled Edge Function):**
    -   Se creará una función de backend que se ejecutará automáticamente **una vez al día**.
    -   **Lógica de la Función:**
        1.  Buscará todas las ventas a crédito con estado 'Pendiente' o 'Abono Parcial'.
        2.  Identificará dos grupos:
            -   **Ventas Próximas a Vencer:** Aquellas cuya `fecha_vencimiento` sea en los próximos 3 días.
            -   **Ventas Recién Vencidas:** Aquellas cuya `fecha_vencimiento` fue *ayer*.
        3.  Para cada venta encontrada, generará una notificación inteligente en el sistema.

2.  **Nuevos Tipos de Notificación:**
    -   Se crearán dos nuevos `tipo_evento`: `'VENTA_PROXIMA_A_VENCER'` y `'VENTA_VENCIDA'`.
    -   **Mensajes de Ejemplo:**
        -   "La venta `VENTA-00123` al cliente 'Cliente Moroso' está próxima a vencer (en 2 días)."
        -   "La venta `VENTA-00124` al cliente 'Cliente Olvidadizo' ha vencido."
    -   Estas notificaciones aparecerán en el panel de notificaciones y enlazarán directamente al `VentaDetailPage` correspondiente.
