# MÓDULO 03: GESTIÓN DE EMPRESA
## Dashboard

Este documento detalla la arquitectura y funcionalidad del **Dashboard Inteligente**, la página principal para los usuarios de la empresa.

## 1. Objetivo del Módulo

Proporcionar una vista consolidada y de alto nivel sobre el rendimiento del negocio en tiempo real. El dashboard está diseñado para ofrecer una visión rápida de las métricas más importantes, permitiendo a los usuarios tomar decisiones informadas.

## 2. Página Clave: `DashboardPage.tsx`

Esta es la única página del módulo y sirve como el centro de mando visual de la empresa.

### Funcionalidad y UI/UX

-   **Filtros Dinámicos:**
    -   **Rango de Fechas:** Permite al usuario seleccionar rápidamente períodos predefinidos (Hoy, Semana, Mes, Año) o un rango personalizado. Todos los datos de la página se recalculan instantáneamente al cambiar el filtro.
    -   **Sucursal (Solo Propietarios):** Un menú desplegable permite a los Propietarios ver los datos de *todas* las sucursales consolidadas o filtrar por una específica. Para Administradores y Empleados, los datos siempre se muestran para su propia sucursal.

-   **Indicadores Clave de Rendimiento (KPIs):**
    -   Un conjunto de tarjetas (`KPICard`) en la parte superior muestra las métricas más importantes del período seleccionado:
        -   Ventas Totales (con % de cambio vs. período anterior)
        -   Ganancia Bruta (con % de cambio)
        -   Ganancia NETA (calculada como Ganancia Bruta - Gastos)
        -   Total Compras y Gastos.

-   **Visualización de Datos (Gráficos):**
    -   **Gráfico de Barras Comparativo (`ComparativeBarChart.js`):**
        -   Si el Propietario ve "Todas las Sucursales", el gráfico compara las ventas y ganancias entre cada sucursal.
        -   Si se filtra por una sucursal (o para roles no-propietarios), el gráfico muestra la tendencia de ventas y ganancias a lo largo del tiempo (días, meses, etc.).
    -   **Gráfico de Barras Horizontal (`HorizontalBarChart.js`):** Muestra un ranking de los productos más vendidos en el período.

-   **Widgets Informativos (`DashboardWidget`):**
    -   **Productos con Bajo Stock:** Alerta sobre productos que necesitan ser reabastecidos.
    -   **Ranking de Clientes:** Muestra los clientes que más han comprado.
    -   **Actividad Reciente:** Un feed en tiempo real de las últimas ventas, compras y gastos registrados.

## 3. Lógica de Backend (Función RPC `get_dashboard_data`)

Toda la lógica compleja de cálculo de datos está centralizada en la función de PostgreSQL `get_dashboard_data`.

-   **Eficiencia:** Esta función realiza todos los cálculos necesarios en una sola llamada a la base de datos, lo que es mucho más rápido que hacer múltiples consultas desde el frontend.
-   **Conciencia de Zona Horaria:** La función acepta la **zona horaria de la empresa** (`p_timezone`) como parámetro. Utiliza `AT TIME ZONE` en sus consultas para convertir los rangos de fecha y asegurar que un filtro como "Hoy" se corresponda con el día actual en la ubicación del usuario, no en la del servidor. Esto garantiza la precisión de todos los datos mostrados.
-   **Lógica de Roles:** La función adapta sus cálculos según el rol y la sucursal del usuario que la llama.
-   **Datos Devueltos:** Devuelve un único objeto JSON que contiene toda la información necesaria para renderizar el dashboard: KPIs, datos para los gráficos y listas para los widgets.