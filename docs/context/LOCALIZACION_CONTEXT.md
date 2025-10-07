# MÓDULO 03: GESTIÓN DE EMPRESA
## Localización (Zona Horaria y Moneda)

Este documento detalla la arquitectura y el flujo de la funcionalidad de localización, una característica clave para garantizar la precisión de los datos de fecha, hora y moneda en toda la aplicación.

## 1. Objetivo del Módulo

El objetivo principal es hacer que la aplicación sea **consciente de la ubicación operativa de la empresa**. Esto resuelve dos problemas críticos:

1.  **Inconsistencia de Fechas:** Sin esta funcionalidad, un filtro como "Hoy" en el dashboard podría mostrar datos incorrectos si la zona horaria del servidor de la base de datos es diferente a la del usuario.
2.  **Formato de Moneda:** Permite mostrar los símbolos de moneda correctos (ej. `Bs`, `$`, `€`) en toda la interfaz de usuario.

## 2. Arquitectura y Flujo de Datos

La implementación de la localización sigue un flujo claro a través de las diferentes capas de la aplicación:

### a. Registro (`RegistrationFlow.tsx`)

-   **`StepLocalizacion`:** Durante el proceso de registro de una nueva empresa, se introdujo un paso específico donde el usuario debe seleccionar su país de operación.
-   **Array `countries`:** Este componente contiene un array predefinido que mapea cada país a su `timezone` (ej. 'America/La_Paz') y `moneda` (ej. 'BOB').
-   **Captura de Datos:** Al seleccionar un país, estos dos valores se guardan en el estado del formulario de registro.

### b. Backend (Edge Function y Base de Datos)

-   **`create-company-user` (Edge Function):** La función de Supabase que orquesta la creación de la empresa recibe los parámetros `timezone` y `moneda` desde el frontend.
-   **Tabla `empresas`:** La función inserta estos valores en las nuevas columnas `timezone` y `moneda` de la tabla `empresas` al crear el nuevo registro.

### c. Carga de Sesión (`App.tsx`)

-   **`get_user_profile_data` (Función RPC):** Esta función, que se llama al iniciar sesión, fue actualizada para que también devuelva los campos `empresa_timezone` y `empresa_moneda` junto con el resto del perfil.
-   **Estado `companyInfo`:** El componente `App.tsx` recibe estos datos y los almacena en el estado global `companyInfo`, haciéndolos accesibles para toda la aplicación. También deriva y almacena el `monedaSimbolo` para un uso fácil.

### d. Uso en la Aplicación (Dashboard Inteligente)

-   **`DashboardPage.tsx`:**
    -   **Paso de Parámetros:** Al llamar a la función de la base de datos para obtener los datos del dashboard, ahora le pasa la `timezone` de la empresa como un parámetro: `supabase.rpc('get_dashboard_data', { ..., p_timezone: companyInfo.timezone })`.
    -   **Formato de Moneda:** Utiliza el `companyInfo.monedaSimbolo` para formatear todos los valores monetarios que se muestran en los KPIs y gráficos.
-   **`get_dashboard_data` (Función RPC):**
    -   **Lógica Clave:** Esta función ahora utiliza el parámetro `p_timezone` para realizar conversiones de zona horaria directamente en la consulta de PostgreSQL usando `AT TIME ZONE`.
    -   **Ejemplo:** `WHERE v.fecha >= (p_start_date::timestamp AT TIME ZONE p_timezone)`
    -   **Impacto:** Esto asegura que cuando un usuario en Bolivia filtra por el 10 de Julio, la base de datos busca registros desde el 10 de Julio a las 00:00 (hora de Bolivia) hasta el 11 de Julio a las 00:00 (hora de Bolivia), sin importar en qué parte del mundo esté alojado el servidor.

## 3. Impacto en el Usuario

-   **Precisión Absoluta:** Los reportes del dashboard y los filtros de fecha son 100% precisos para la zona horaria de la empresa.
-   **Claridad Financiera:** Todos los montos en la aplicación se muestran con el símbolo de moneda local correcto, eliminando ambigüedades.
-   **Escalabilidad:** La arquitectura está preparada para soportar empresas en diferentes países sin necesidad de cambios adicionales en la lógica.