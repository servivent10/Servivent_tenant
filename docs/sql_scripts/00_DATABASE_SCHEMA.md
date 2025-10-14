# Esquema de Base de Datos Simplificado: ServiVENT

Este documento define la estructura de la base de datos de forma simplificada, mostrando las tablas y columnas principales.

## Tablas Core y de Empresa

### `empresas`
Almacena la información de cada empresa (tenant).
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `nombre` | `text` |
| `nit` | `text` |
| `logo` | `text` |
| `timezone` | `text` |
| `moneda` | `text` |
| `modo_caja` | `text` |
| `slug` | `text` |
| `created_at` | `timestamptz` |

### `licencias`
Gestiona el estado de las licencias.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `tipo_licencia` | `text` |
| `fecha_inicio` | `date` |
| `fecha_fin` | `date` |
| `estado` | `text` |

### `pagos_licencia`
Historial de pagos de licencias.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `licencia_id` | `uuid` |
| `monto` | `numeric` |
| `fecha_pago` | `timestamptz` |
| `metodo_pago` | `text` |
| `notas` | `text` |

### `sucursales`
Puntos de venta de cada empresa.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `direccion` | `text` |
| `telefono` | `text` |

### `usuarios`
Perfiles de los usuarios del sistema.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `nombre_completo` | `text` |
| `rol` | `text` |
| `correo` | `text` |
| `avatar` | `text` |

---

## Tablas de Catálogo y Precios

### `categorias`
Clasificación de productos.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |

### `productos`
Catálogo maestro de artículos.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `sku` | `text` |
| `marca` | `text` |
| `modelo` | `text` |
| `descripcion` | `text` |
| `precio_compra` | `numeric` |
| `categoria_id` | `uuid` |
| `unidad_medida`| `text` |

### `imagenes_productos`
Galería de imágenes para cada producto.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `producto_id` | `uuid` |
| `imagen_url` | `text` |
| `orden` | `int` |

### `listas_precios`
Define diferentes políticas de precios.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `descripcion` | `text` |
| `es_predeterminada`| `boolean`|
| `orden` | `integer` |

### `precios_productos`
Vincula un producto a una lista de precios con sus reglas.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `producto_id` | `uuid` |
| `lista_precio_id`| `uuid` |
| `precio` | `numeric` |
| `ganancia_maxima`| `numeric` |
| `ganancia_minima`| `numeric` |

---

## Tablas de Inventario

### `inventarios`
Stock de cada producto en cada sucursal.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `producto_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `cantidad` | `numeric` |
| `stock_minimo` | `numeric` |

### `movimientos_inventario`
Registro de auditoría de cada cambio de stock.
| Columna | Tipo |
|---|---|
| `id` | `bigserial` |
| `producto_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `usuario_id` | `uuid` |
| `tipo_movimiento`| `text` |
| `cantidad_ajustada`| `numeric`|
| `stock_anterior` | `numeric` |
| `stock_nuevo` | `numeric` |
| `referencia_id` | `uuid` |
| `motivo` | `text` |
| `created_at` | `timestamptz`|

---

## Tablas de Terceros (Clientes y Proveedores)

### `clientes`
Base de datos de clientes.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `auth_user_id`| `uuid` |
| `nombre` | `text` |
| `nit_ci` | `text` |
| `telefono` | `text` |
| `correo` | `text` |
| `direccion` | `text` |
| `avatar_url` | `text` |
| `saldo_pendiente`| `numeric` |

### `direcciones_clientes`
Direcciones de envío para clientes.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `cliente_id`| `uuid` |
| `empresa_id`| `uuid` |
| `nombre` | `text` |
| `direccion_texto`| `text` |
| `latitud` | `numeric` |
| `longitud` | `numeric` |
| `es_principal`| `boolean` |

### `proveedores`
Base de datos de proveedores.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `nombre_contacto`| `text` |
| `nit` | `text` |
| `telefono` | `text` |
| `email` | `text` |
| `direccion` | `text` |

---

## Tablas Operacionales (Ventas, Compras, Gastos, etc.)

### `compras`
Cabecera de las compras a proveedores.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `proveedor_id`| `uuid` |
| `usuario_id`| `uuid` |
| `folio` | `text` |
| ... | ... |

### `compra_items`
Detalle de productos en una compra.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `compra_id` | `uuid` |
| `producto_id` | `uuid` |
| `cantidad` | `numeric` |
| `costo_unitario`| `numeric` |

### `pagos_compras`
Abonos realizados a una compra a crédito.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `compra_id` | `uuid` |
| `monto` | `numeric` |
| `metodo_pago` | `text` |

### `ventas`
Cabecera de las ventas a clientes.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `cliente_id`| `uuid` |
| `usuario_id`| `uuid` |
| `folio` | `text` |
| `direccion_entrega_id`|`uuid`|
| ... | ... |

### `venta_items`
Detalle de productos en una venta.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `venta_id` | `uuid` |
| `producto_id` | `uuid` |
| `cantidad` | `numeric` |
| `precio_unitario_aplicado`|`numeric`|
| `costo_unitario_en_venta`|`numeric`|

### `pagos_ventas`
Abonos a una venta a crédito.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `venta_id` | `uuid` |
| `monto` | `numeric` |
| `metodo_pago` | `text` |

### `gastos_categorias`
Categorías para los gastos.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |

### `gastos`
Registro de gastos operativos.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| ... | ... |
| `concepto`| `text` |
| `monto` | `numeric` |
| `fecha` | `date` |
| `comprobante_url`| `text` |

### `traspasos`
Transferencias de stock entre sucursales.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `sucursal_origen_id`|`uuid` |
| `sucursal_destino_id`|`uuid` |
| `usuario_envio_id`| `uuid` |
| `usuario_recibio_id`| `uuid`|
| `folio` | `text` |
| `estado` | `text` |
| ... | ... |

### `traspaso_items`
Detalle de productos en un traspaso.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `traspaso_id` | `uuid` |
| `producto_id` | `uuid` |
| `cantidad` | `numeric` |

### `sesiones_caja`
Registro de aperturas y cierres de caja.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| ... | ... |
| `estado` | `text` |
| `saldo_inicial`| `numeric` |
| `saldo_final_real_efectivo`|`numeric`|
| `diferencia_efectivo`| `numeric` |
| ... | ... |

---

## Tablas de Auditoría y Sistema

### `historial_cambios`
"Caja negra" que registra todas las modificaciones importantes.
| Columna | Tipo |
|---|---|
| `id` | `bigserial` |
| `accion` | `text` |
| `tabla_afectada`| `text` |
| `registro_id` | `text` |
| `datos_anteriores`| `jsonb` |
| `datos_nuevos` | `jsonb` |
| ... | ... |

### `notificaciones`
Almacena las notificaciones en tiempo real para los usuarios.
| Columna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `usuario_generador_id` | `uuid` |
| `usuario_generador_nombre` | `text` |
| `mensaje` | `text` |
| `tipo_evento` | `text` |
| `entidad_id` | `uuid` |
| `leido_por` | `uuid[]` |
| `created_at` | `timestamptz` |
| `sucursales_destino_ids` | `uuid[]` |
