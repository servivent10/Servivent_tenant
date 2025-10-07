# Instrucciones Maestras para el Desarrollo de ServiVENT

Este documento es la guía fundamental que define las reglas, arquitecturas y patrones que debo seguir rigurosamente en cada interacción para el desarrollo de la aplicación ServiVENT. Su propósito es garantizar la consistencia, calidad y mantenibilidad del proyecto.

## 1. Reglas Generales de Interacción

1.  **Idioma:** Mis respuestas siempre deben ser en español.
2.  **Formato de Respuesta:** Al recibir una solicitud para modificar el código, mi respuesta principal debe ser el bloque XML con los archivos actualizados. Fuera de ese bloque, debo añadir una breve explicación en lenguaje natural, siguiendo este formato: `"Entendido. He [acción realizada] en [módulo/componente]. Para lograrlo, modifiqué los archivos X y Z haciendo [breve descripción del cambio]. Aquí tienes los archivos actualizados:"`.
3.  **Proactividad y Autonomía:** Debo actuar directamente sobre el código para satisfacer la solicitud del usuario de la mejor manera posible, sin necesidad de pedir confirmación. La solicitud del usuario es la confirmación.
4.  **Calidad de las Propuestas:** Siempre debo ofrecer soluciones profesionales, con un enfoque moderno, y que sigan las mejores prácticas de la industria y las establecidas en este documento.

## 2. Arquitectura y Lógica de Backend (Supabase)

1.  **Prioridad a Funciones RPC:** La lógica de negocio compleja, especialmente la que requiere acceso a múltiples tablas o necesita eludir políticas RLS, **DEBE** encapsularse en funciones de PostgreSQL con `SECURITY DEFINER`. Esto centraliza el código, mejora el rendimiento y previene errores de recursión.
2.  **Uso de Edge Functions:** Las Edge Functions se reservan para operaciones que involucren el esquema `auth` de Supabase (crear o eliminar usuarios) o que requieran una secuencia de pasos controlada que podría fallar (ej. la eliminación forzosa de una empresa). Esto garantiza transacciones seguras y el manejo correcto de permisos.
3.  **Arquitectura JWT para RLS (Regla Crítica):** Toda política de seguridad a nivel de fila (RLS) **DEBE** basarse en la lectura del `empresa_id` directamente del token del usuario a través de la función `public.get_empresa_id_from_jwt()`. Esto es fundamental para prevenir la recursión infinita que bloquea las notificaciones en tiempo real.
4.  **Sistema de Tiempo Real:**
    *   La comunicación en tiempo real se basa en la suscripción a `postgres_changes`.
    *   Cualquier nueva tabla que requiera notificaciones en vivo **DEBE** ser añadida a la publicación `supabase_realtime` en PostgreSQL usando `ALTER PUBLICATION`.
    *   En el frontend, la actualización de datos se orquesta a través del `RealtimeProvider`, que incrementa un `changeCounter`, y el hook `useRealtimeListener`, que ejecuta un callback (`fetchData`) cuando el contador cambia.

## 3. Diseño de Interfaz y Experiencia de Usuario (UI/UX)

La excelencia en la UI/UX es un pilar fundamental de ServiVENT. Todas las interfaces deben ser intuitivas, responsivas y visualmente coherentes.

### 3.1. Principios Fundamentales

1.  **Estética de Interfaz Clara y Profesional (Tema Ligero):** La interfaz de usuario **DEBE** seguir un diseño limpio, moderno y profesional con un **tema claro/ligero**. Se prohíbe el uso de fondos oscuros (`bg-gray-800`, `bg-black`, etc.) para componentes principales como paneles, tarjetas, modales, formularios y layouts generales. El fondo base debe ser blanco (`bg-white`) o un gris muy claro (`bg-slate-50`, `bg-gray-100`) para crear una sensación de amplitud y legibilidad.
2.  **Diseño Responsivo (La Regla de Oro):** Es la máxima prioridad.
    *   **Escritorio:** Se debe favorecer el uso de **tablas (`<table>`)** para listas de datos y **botones estándar** en las cabeceras o paneles.
    *   **Móvil y Tablet:** Las tablas deben transformarse en **listas de tarjetas (`<cards>`)** para una mejor legibilidad. Las acciones principales deben moverse a un **Botón de Acción Flotante (`FloatingActionButton`)** en la esquina inferior.
3.  **Retroalimentación Constante al Usuario:**
    *   **Operaciones Asíncronas:** Toda operación que implique una espera (llamadas a la API, procesamiento) **DEBE** estar cubierta por el sistema de carga global (`useLoading`), que activará la `ProgressBar` superior.
    *   **Notificaciones:** El resultado de las acciones (éxito, error, advertencia) **DEBE** comunicarse al usuario a través de notificaciones `Toast` (`useToast`).
4.  **Consistencia a través de Componentes Reutilizables:** Se **DEBE** priorizar el uso del sistema de componentes existente.
    *   **Layout:** `DashboardLayout.tsx` es la base para todas las páginas autenticadas.
    *   **Indicadores:** `KPI_Card.tsx`, `Tabs.tsx`, `Avatar.tsx`.
    *   **Iconografía:** Todos los iconos **DEBEN** provenir del objeto `ICONS` en `src/components/Icons.tsx`.

### 3.2. Reglas Específicas para Formularios

Todos los formularios deben seguir un comportamiento y estilo unificado para garantizar una experiencia predecible.

1.  **Estilo Visual Unificado (Estilo Bootstrap):**
    *   **Estado Normal:** Todos los campos (`input`, `select`, `textarea`) deben tener un borde gris claro.
    *   **Estado Enfocado (`:focus`):** Al recibir el foco, el campo **DEBE** cambiar su borde al color azul `#0d6efd` y mostrar un resplandor azul alrededor. Esto se logra con las clases de Tailwind: `focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25`.
    *   **Componente Central:** `FormInput.tsx` **DEBE** ser el componente base para implementar este estilo en todos los campos de entrada.

2.  **Comportamiento de Selección Automática:**
    *   Todos los campos de entrada de texto (`text`, `email`, `number`, `password`, `date`) **DEBEN** seleccionar automáticamente todo su contenido cuando el usuario hace clic o navega a ellos.
    *   **Implementación:** Esto se logra añadiendo el manejador de eventos `onFocus={e => e.target.select()}` a cada `input`.

3.  **Navegación por Teclado en Selectores:**
    *   Todos los componentes de selección personalizados (ej. `SearchableSelect`, `MultiSelectDropdown`) **DEBEN** ser completamente accesibles mediante teclado.
    *   **Flechas Arriba/Abajo:** El usuario debe poder navegar por las opciones de la lista desplegable.
    *   **Tecla Enter:** Al presionar `Enter`, se debe seleccionar la opción actualmente resaltada.
    *   **Tecla Escape:** Debe cerrar la lista desplegable.

### 3.3. Reglas Específicas para Modales

Los modales son una parte crítica de la interacción y deben ser robustos y responsivos.

1.  **Diseño Responsivo Crítico (Header y Footer Fijos):**
    *   **Estructura:** Los modales **DEBEN** usar Flexbox para su layout interno (`flex flex-col max-h-[90vh]`).
    *   **Cabecera (Header) y Pie (Footer):** Deben tener la clase `flex-shrink-0` para evitar que se encojan y permanezcan siempre visibles.
    *   **Cuerpo (Body):** Debe tener las clases `flex-grow overflow-y-auto` para que ocupe el espacio restante y permita el scroll vertical de su contenido de forma independiente, sin mover la cabecera ni el pie.
    *   **Dispositivos Móviles:** El contenido del cuerpo debe organizarse en una sola columna para una legibilidad óptima.

2.  **Componente Base:**
    *   `ConfirmationModal.tsx` es el componente base que ya implementa esta estructura responsiva. Todos los modales de formulario (`UserFormModal`, `ProductFormModal`, etc.) **DEBEN** usar `ConfirmationModal` como su contenedor principal para heredar este comportamiento.

## 4. Flujos y Patrones Específicos de Módulos

1.  **Gestión de Entidades (CRUD):** El patrón estándar para módulos como Clientes, Proveedores, Productos, etc., es:
    *   Una **página de lista** que incluye KPIs, filtros de búsqueda y la lista responsiva (tabla/tarjetas).
    *   Un **botón de "Añadir"** (en la cabecera en escritorio, en un FAB en móvil) que abre un **modal de formulario** para la creación.
    *   Las acciones de **editar** y **eliminar** en cada ítem de la lista abren el mismo modal de formulario (en modo edición) o un `ConfirmationModal`.
2.  **Navegación por Roles:**
    *   **Propietario:** Generalmente ve vistas de lista con datos de toda la empresa (ej. `SucursalesListPage`).
    *   **Administrador/Empleado:** A menudo son redirigidos a una vista de detalle filtrada para su contexto (ej. `SucursalDetailPage` de su propia sucursal). Este patrón debe mantenerse para simplificar la experiencia de estos roles.

## 5. Flexibilidad

Este es un documento vivo. Puede y debe ser actualizado para reflejar nuevas decisiones de arquitectura y patrones a medida que el proyecto evoluciona.