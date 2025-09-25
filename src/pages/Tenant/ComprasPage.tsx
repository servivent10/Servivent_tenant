/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ProveedorFormModal } from '../../components/modals/ProveedorFormModal.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';

export function ComprasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [compras, setCompras] = useState([]);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_purchases');
            if (error) throw error;
            setCompras(data);
        } catch (err) {
            addToast({ message: `Error al cargar compras: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const kpis = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let totalMes = 0;
        let cuentasPorPagar = 0;
        let comprasCredito = 0;

        compras.forEach(c => {
            const fechaCompra = new Date(c.fecha);
            if (fechaCompra >= startOfMonth) {
                totalMes += Number(c.total_bob || 0);
            }
            if (c.estado_pago !== 'Pagada') {
                cuentasPorPagar += Number(c.saldo_pendiente || 0);
            }
            if (c.tipo_pago === 'Crédito') {
                comprasCredito++;
            }
        });
        
        return { totalMes, cuentasPorPagar, comprasCredito };
    }, [compras]);

    const breadcrumbs = [ { name: 'Compras', href: '#/compras' } ];

    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'Pagada': return `${baseClasses} bg-green-100 text-green-800`;
            case 'Pendiente': return `${baseClasses} bg-red-100 text-red-800`;
            case 'Abono Parcial': return `${baseClasses} bg-amber-100 text-amber-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };
    
    const ComprasList = ({ compras }) => {
        const handleRowClick = (compra) => {
            navigate(`/compras/${compra.id}`);
        };
        
        return html`
            <div class="space-y-4 md:hidden">
                ${compras.map(c => html`
                    <div key=${c.id} onClick=${() => handleRowClick(c)} class="bg-white p-4 rounded-lg shadow border cursor-pointer">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="font-bold text-gray-800">${c.proveedor_nombre}</div>
                                <div class="text-sm text-gray-600">Folio: ${c.folio}</div>
                            </div>
                            <span class=${getStatusPill(c.estado_pago)}>${c.estado_pago}</span>
                        </div>
                        <div class="flex justify-between items-end mt-2 pt-2 border-t">
                            <div class="text-sm">
                                <p class="text-gray-500">${new Date(c.fecha).toLocaleDateString()}</p>
                                <p class="text-lg font-bold text-gray-900">${Number(c.total).toFixed(2)} <span class="text-xs font-normal">${c.moneda}</span></p>
                            </div>
                            <span class="text-xs text-primary font-semibold">Ver Detalles ${ICONS.chevron_right}</span>
                        </div>
                    </div>
                `)}
            </div>

            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Proveedor</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${compras.map(c => html`
                            <tr key=${c.id} onClick=${() => handleRowClick(c)} class="hover:bg-gray-50 cursor-pointer">
                                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${c.folio}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${c.proveedor_nombre}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(c.fecha).toLocaleDateString()}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">${Number(c.total).toFixed(2)} <span class="text-xs font-normal text-gray-500">${c.moneda}</span></td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm"><span class=${getStatusPill(c.estado_pago)}>${c.estado_pago}</span></td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    };
    
    const handleSave = () => {
        setIsModalOpen(false);
        addToast({ message: 'Compra registrada con éxito.', type: 'success' });
        fetchData();
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Compras"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Compras</h1>
                    <p class="mt-1 text-sm text-gray-600">Registra y supervisa las adquisiciones de tu negocio.</p>
                </div>
                 <button 
                    onClick=${() => setIsModalOpen(true)}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Registrar Nueva Compra
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                 <${KPI_Card} title="Total Comprado (Mes)" value=${`Bs ${kpis.totalMes.toFixed(2)}`} icon=${ICONS.shopping_cart} color="primary" />
                 <${KPI_Card} title="Cuentas por Pagar" value=${`Bs ${kpis.cuentasPorPagar.toFixed(2)}`} icon=${ICONS.credit_score} color="amber" />
                 <${KPI_Card} title="Compras a Crédito" value=${kpis.comprasCredito} icon=${ICONS.newExpense} color="green" />
            </div>

            <div class="mt-8">
                <${ComprasList} compras=${compras} />
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${() => setIsModalOpen(true)} label="Registrar Nueva Compra" />
            </div>

            <${NewPurchaseModal} isOpen=${isModalOpen} onClose=${() => setIsModalOpen(false)} onSave=${handleSave} user=${user} />
        <//>
    `;
}

// --- NEW PURCHASE WIZARD MODAL COMPONENTS ---

function PurchaseItemDetailModal({ isOpen, onClose, onSave, item, currency, exchangeRate, addToast }) {
    // FIX: Add guard to ensure `item` is not null, which helps TypeScript infer its type correctly.
    if (!isOpen || !item) return null;
    
    const [localItem, setLocalItem] = useState(item);
    // FIX: Provide an explicit type for the `errors` state to prevent type errors when accessing its properties.
    const [errors, setErrors] = useState<{ cantidad?: string; costo_unitario?: string; }>({});

    useEffect(() => {
        setLocalItem(item); // Sync with prop change
        setErrors({});
    }, [item]);

    const handleItemChange = (field, value) => {
        setLocalItem(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        const newErrors: { cantidad?: string; costo_unitario?: string } = {};
        const cantidad = Number(localItem.cantidad || 0);
        const costo = Number(localItem.costo_unitario || 0);
        
        if (isNaN(cantidad) || cantidad <= 0) newErrors.cantidad = 'Debe ser > 0.';
        if (isNaN(costo) || costo <= 0) newErrors.costo_unitario = 'Debe ser > 0.';
        
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            addToast({ message: 'Revisa los campos marcados en rojo.', type: 'error' });
            return;
        }
        onSave(localItem);
    }
    
    const stock_actual = Number(localItem.stock_sucursal || 0);
    const capp_actual = Number(localItem.precio_compra || 0);
    const cantidad_comprada = Number(localItem.cantidad || 0);
    
    const costo_unitario_ingresado = Number(localItem.costo_unitario || 0);
    const tasa_cambio_numerica = Number(exchangeRate || 1);
    const costo_compra = currency === 'USD' ? costo_unitario_ingresado * tasa_cambio_numerica : costo_unitario_ingresado;
    
    const nuevo_stock = stock_actual + cantidad_comprada;
    const nuevo_capp = (stock_actual + cantidad_comprada) > 0 ? ((stock_actual * capp_actual) + (cantidad_comprada * costo_compra)) / (stock_actual + cantidad_comprada) : costo_compra;
    const nuevo_precio_base = Number(localItem.nuevo_precio_base);
    const margen_ganancia = nuevo_capp > 0 && !isNaN(nuevo_precio_base) && nuevo_precio_base > 0 ? ((nuevo_precio_base - nuevo_capp) / nuevo_capp) * 100 : 0;
    const margen_bs = isNaN(nuevo_precio_base) || isNaN(nuevo_capp) ? 0 : nuevo_precio_base - nuevo_capp;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleSave}
            title="Detalle del Producto en Compra"
            confirmText="Aceptar"
            icon=${ICONS.edit_note}
            maxWidthClass="max-w-2xl"
        >
            <div class="space-y-4">
                <div class="flex items-center gap-4 p-2 bg-slate-50 rounded-lg">
                    ${localItem.imagen_principal ? html`<img src=${localItem.imagen_principal} class="h-14 w-14 rounded-md object-cover flex-shrink-0" />` : html`<div class="h-14 w-14 flex-shrink-0 rounded-md bg-white flex items-center justify-center text-slate-400">${ICONS.products}</div>`}
                    <p class="font-bold text-lg text-gray-800">${localItem.producto_nombre}</p>
                </div>

                <div class="p-4 bg-white rounded-lg border space-y-4">
                    <h4 class="text-base font-semibold text-gray-800">Datos de la Compra</h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <${FormInput} label="Cantidad a Comprar" name="cantidad" type="number" value=${localItem.cantidad} onInput=${e => handleItemChange('cantidad', e.target.value)} error=${errors.cantidad} />
                        <${FormInput} label="Costo Unitario (${currency})" name="costo_unitario" type="number" value=${localItem.costo_unitario} onInput=${e => handleItemChange('costo_unitario', e.target.value)} error=${errors.costo_unitario} />
                    </div>
                </div>

                <div class="p-4 bg-slate-50 rounded-lg border space-y-4">
                    <h4 class="text-base font-semibold text-gray-800">Impacto en Inventario y Costos</h4>
                    <div class="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Costo Actual (CAPP)</label>
                            <p class="text-lg font-bold text-gray-700 mt-1">Bs ${capp_actual.toFixed(2)}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Stock Actual (Sucursal)</label>
                            <p class="text-lg font-bold text-gray-700 mt-1">${stock_actual}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-center border-t border-slate-200 pt-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-600">Nuevo Costo Ponderado</label>
                            <p class="text-lg font-bold text-primary mt-1">Bs ${nuevo_capp.toFixed(2)}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-600">Nuevo Stock (Sucursal)</label>
                            <p class="text-lg font-bold text-primary mt-1">${nuevo_stock}</p>
                        </div>
                    </div>
                </div>
                
                <div class="p-4 bg-white rounded-lg border space-y-4">
                    <h4 class="text-base font-semibold text-gray-800">Precio de Venta y Margen</h4>
                    <div class="flex items-end gap-4">
                        <div class="flex-grow">
                            <label for="nuevo_precio_base" class="block text-sm font-medium text-gray-700">Nuevo Precio Base Venta</label>
                            <input type="number" id="nuevo_precio_base" value=${localItem.nuevo_precio_base} onInput=${e => handleItemChange('nuevo_precio_base', e.target.value)} class="w-full block rounded-md border-0 mt-1 p-2 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset ring-gray-300 focus:ring-primary sm:text-sm bg-white" />
                            ${(localItem.precio_base == null || localItem.precio_base <= 0) && html`<p class="text-xs text-amber-600 mt-1">⚠️ Sin precio base asignado.</p>`}
                        </div>
                        <div class="text-center">
                            <label class="block text-sm font-medium text-gray-600">Margen Estimado</label>
                            <p class=${`font-bold text-lg ${margen_ganancia < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ${margen_ganancia.toFixed(1)}%
                                <span class="font-normal text-sm text-gray-500 ml-1">(Bs ${margen_bs.toFixed(2)})</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        <//>
    `;
}

const ProveedorSelector = ({ formData, setFormData, proveedores, setIsProveedorFormOpen }) => {
    const [searchTerm, setSearchTerm] = useState(formData.proveedor_nombre);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

    const filteredProveedores = useMemo(() => {
        const allOptions = [
            { id: 'add_new', nombre: 'Añadir Nuevo Proveedor' },
            ...proveedores
        ];
        if (!searchTerm) return allOptions;
        const lowerCaseTerm = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Añadir Nuevo Proveedor' },
            ...proveedores.filter(p => p.nombre.toLowerCase().includes(lowerCaseTerm) || p.nombre_contacto?.toLowerCase().includes(lowerCaseTerm))
        ];
    }, [searchTerm, proveedores]);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        setSearchTerm(formData.proveedor_nombre);
    }, [formData.proveedor_nombre]);

    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isDropdownOpen]);

    const handleSelect = (proveedor) => {
        if (proveedor.id === 'add_new') {
            setIsProveedorFormOpen(true);
        } else {
            setFormData(prev => ({...prev, proveedor_id: proveedor.id, proveedor_nombre: proveedor.nombre }));
        }
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredProveedores.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredProveedores.length) % filteredProveedores.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(filteredProveedores[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return html`
        <div ref=${wrapperRef} class="relative">
            <label class="block text-sm font-medium text-gray-700">Proveedor</label>
             <input 
                type="text" 
                value=${searchTerm} 
                onInput=${e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
                onClick=${() => setDropdownOpen(true)}
                onFocus=${() => setDropdownOpen(true)}
                onKeyDown=${handleKeyDown}
                placeholder="Buscar o seleccionar proveedor..."
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            />
            ${isDropdownOpen && html`
                <ul class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredProveedores.map((p, index) => html`
                        <li 
                            key=${p.id}
                            ref=${el => itemRefs.current[index] = el}
                            onClick=${() => handleSelect(p)} 
                            class="relative cursor-pointer select-none py-2 pl-3 pr-9
                            ${p.id === 'add_new' ? 'text-primary font-semibold' : 'text-gray-900'}
                            ${highlightedIndex === index ? 'bg-primary-light' : 'hover:bg-slate-100'}"
                        >
                            ${p.id === 'add_new' ? html`<span class="flex items-center gap-2">${ICONS.add} ${p.nombre}</span>` : html`
                                <span class="block truncate font-medium">${p.nombre}</span>
                                <span class="block truncate text-xs text-gray-500">${p.nombre_contacto || 'Sin contacto'}</span>
                            `}
                        </li>
                    `)}
                </ul>
            `}
        </div>
    `;
};

const ProductoSearch = ({ productos, onProductSelected, onAddedProductClick, setIsProductFormOpen, addedProductIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

    const filteredProductos = useMemo(() => {
        const allOptions = [{ id: 'add_new', nombre: 'Crear Nuevo Producto' }, ...productos];
        if (!searchTerm) return allOptions;
        const lower = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Crear Nuevo Producto' },
            ...productos.filter(p => 
                p.nombre.toLowerCase().includes(lower) || 
                p.sku?.toLowerCase().includes(lower) || 
                p.modelo?.toLowerCase().includes(lower)
            )
        ];
    }, [searchTerm, productos]);
    
    const handleSelect = (producto) => {
        if (producto.id === 'add_new') {
            setIsProductFormOpen(true);
        } else if (addedProductIds.has(producto.id)) {
            onAddedProductClick(producto.id);
        } else {
            onProductSelected(producto);
        }
        setSearchTerm('');
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    useEffect(() => {
        const handleClickOutside = (e) => wrapperRef.current && !wrapperRef.current.contains(e.target) && setDropdownOpen(false);
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isDropdownOpen]);

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredProductos.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredProductos.length) % filteredProductos.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(filteredProductos[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return html`
        <div ref=${wrapperRef} class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
            <input
                type="text"
                placeholder="Buscar producto por SKU, nombre o modelo para añadirlo..."
                value=${searchTerm}
                onInput=${e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
                onClick=${() => setDropdownOpen(true)}
                onFocus=${() => setDropdownOpen(true)}
                onKeyDown=${handleKeyDown}
                class="block w-full rounded-md border-0 p-2 pl-10 bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            />
             ${isDropdownOpen && html`
                <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredProductos.map((p, index) => {
                        const isAdded = addedProductIds.has(p.id);
                        return html`
                        <li 
                            key=${p.id}
                            ref=${el => itemRefs.current[index] = el}
                            onClick=${() => handleSelect(p)} 
                            class="cursor-pointer select-none relative p-2 text-gray-900
                            ${p.id === 'add_new' ? 'text-primary font-semibold' : ''}
                            ${highlightedIndex === index ? 'bg-primary-light' : 'hover:bg-slate-100'}"
                        >
                            ${p.id === 'add_new' ? html`<span class="flex items-center gap-2">${ICONS.add} ${p.nombre}</span>` : html`
                                <div class="flex items-center gap-3">
                                     <div class="relative h-10 w-10 flex-shrink-0">
                                        ${p.imagen_principal ? html`<img src=${p.imagen_principal} class="h-10 w-10 rounded object-cover" />` : html`<div class="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">${ICONS.products}</div>`}
                                        ${isAdded && html`
                                            <div class="absolute inset-0 bg-green-600/70 flex items-center justify-center rounded">
                                                <span class="material-symbols-outlined text-white" style="font-size: 2rem;">check_circle</span>
                                            </div>
                                        `}
                                    </div>
                                    <div class="flex-grow min-w-0">
                                        <p class="font-medium truncate">${p.nombre}</p>
                                        <p class="text-xs text-gray-500 truncate">${p.modelo || `SKU: ${p.sku || 'N/A'}`}</p>
                                    </div>
                                    <div class="flex-shrink-0 text-xs text-right">
                                        <p class="font-semibold text-gray-700">Stock</p>
                                        <p>${p.stock_sucursal}</p>
                                    </div>
                                </div>
                            `}
                        </li>
                    `})}
                     ${filteredProductos.length === 0 && searchTerm && html`
                        <li class="relative select-none py-2 px-4 text-gray-700">No se encontraron productos.</li>
                    `}
                </ul>
            `}
        </div>
    `;
};

const Step1 = ({ formData, handleInput, setFormData, proveedores, setIsProveedorFormOpen }) => (
    html`
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
        <div class="space-y-4">
            <${ProveedorSelector} formData=${formData} setFormData=${setFormData} proveedores=${proveedores} setIsProveedorFormOpen=${setIsProveedorFormOpen} />
            <div class="grid grid-cols-2 gap-4">
                <${FormInput} label="Fecha de Compra" name="fecha" type="date" value=${formData.fecha} onInput=${handleInput} />
                <${FormInput} label="N° Factura/Nota" name="n_factura" type="text" value=${formData.n_factura} onInput=${handleInput} required=${false} />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Moneda</label>
                <div class="mt-2 grid grid-cols-2 gap-3">
                    <button type="button" onClick=${() => setFormData({...formData, moneda: 'BOB'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.moneda === 'BOB' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">BOB</button>
                    <button type="button" onClick=${() => setFormData({...formData, moneda: 'USD'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.moneda === 'USD' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">USD</button>
                </div>
            </div>
            ${formData.moneda === 'USD' && html`
                <${FormInput} label="Tasa de Cambio (1 USD a BOB)" name="tasa_cambio" type="number" value=${formData.tasa_cambio} onInput=${handleInput} />
            `}
        </div>
    `
);

const Step2 = ({ formData, handleEditItem, handleRemoveItem, total, productos, onProductSelected, onAddedProductClick, setIsProductFormOpen, addedProductIds }) => (
    html`
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Detalle de Productos</h3>
    <div class="mb-4">
        <${ProductoSearch} productos=${productos} onProductSelected=${onProductSelected} onAddedProductClick=${onAddedProductClick} setIsProductFormOpen=${setIsProductFormOpen} addedProductIds=${addedProductIds} />
    </div>
    <div class="space-y-3 max-h-80 overflow-y-auto pr-2 -mr-2">
        ${formData.items.length === 0 ? html`
             <div class="text-center py-10 rounded-lg border-2 border-dashed border-gray-200">
                <p class="text-gray-500">Añade productos usando el buscador.</p>
            </div>
        ` : formData.items.map((item, index) => html`
            <div key=${item.producto_id} class="flex items-center gap-4 p-2 bg-slate-50 rounded-lg border">
                <div class="flex-shrink-0">
                    ${item.imagen_principal ? html`<img src=${item.imagen_principal} class="h-12 w-12 rounded-md object-cover bg-white" />` : html`<div class="h-12 w-12 rounded-md bg-white flex items-center justify-center text-slate-400">${ICONS.products}</div>`}
                </div>
                <div class="flex-grow min-w-0">
                    <p class="font-medium text-sm text-gray-800 truncate">${item.producto_nombre}</p>
                </div>
                <div class="flex-shrink-0 text-sm text-center w-16">
                    <p class="text-xs text-gray-500">Cant.</p>
                    <p class="font-semibold">${item.cantidad}</p>
                </div>
                <div class="flex-shrink-0 text-sm text-center w-20">
                    <p class="text-xs text-gray-500">Costo U.</p>
                    <p class="font-semibold">${Number(item.costo_unitario).toFixed(2)}</p>
                </div>
                <div class="flex-shrink-0 text-sm text-center w-24">
                    <p class="text-xs text-gray-500">Subtotal</p>
                    <p class="font-bold text-primary">${(item.cantidad * item.costo_unitario).toFixed(2)}</p>
                </div>
                <div class="flex-shrink-0 flex items-center gap-2">
                    <button onClick=${() => handleEditItem(item)} class="p-2 bg-white rounded-md shadow-sm text-gray-500 hover:bg-blue-100 hover:text-blue-600">${ICONS.edit}</button>
                    <button onClick=${() => handleRemoveItem(index)} class="p-2 bg-white rounded-md shadow-sm text-gray-500 hover:bg-red-100 hover:text-red-600">${ICONS.delete}</button>
                </div>
            </div>
        `)}
    </div>
    <div class="mt-4 pt-4 border-t text-right">
         <p class="text-sm text-gray-500">Total Compra</p>
         <p class="text-2xl font-bold text-gray-900">${total.toFixed(2)} <span class="text-base font-normal">${formData.moneda}</span></p>
    </div>
    `
);

const Step3 = ({ formData, handleInput, setFormData, total }) => {
    const calculateDaysRemaining = () => {
        if (!formData.fecha_vencimiento) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(formData.fecha_vencimiento.replace(/-/g, '/'));
        
        if (isNaN(dueDate.getTime())) return null;

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return html`<span class="text-sm font-semibold text-red-600">Vencido hace ${Math.abs(diffDays)} días</span>`;
        if (diffDays === 0) return html`<span class="text-sm font-semibold text-amber-600">Vence hoy</span>`;
        return html`<span class="text-sm font-semibold text-green-700">Vence en ${diffDays} días</span>`;
    };
    const daysRemaining = calculateDaysRemaining();

    return html`
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Condiciones de Pago</h3>
        <div>
            <label class="block text-sm font-medium text-gray-700">Tipo de Compra</label>
            <div class="mt-2 grid grid-cols-2 gap-3">
                <button type="button" onClick=${() => setFormData({...formData, tipo_pago: 'Contado'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.tipo_pago === 'Contado' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.paid} Al Contado</button>
                <button type="button" onClick=${() => setFormData({...formData, tipo_pago: 'Crédito'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.tipo_pago === 'Crédito' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.credit_score} A Crédito</button>
            </div>
        </div>
        ${formData.tipo_pago === 'Crédito' && html`
            <div class="mt-4 space-y-4 animate-fade-in-down">
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <${FormInput} label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value=${formData.fecha_vencimiento} onInput=${handleInput} />
                         ${daysRemaining && html`<div class="mt-2 text-right">${daysRemaining}</div>`}
                    </div>
                    <${FormInput} label="Abono Inicial (Opcional)" name="abono_inicial" type="number" value=${formData.abono_inicial} onInput=${handleInput} required=${false} />
                </div>
                <div>
                     <label class="block text-sm font-medium text-gray-700">Método de Pago del Abono</label>
                     <div class="mt-2 grid grid-cols-3 gap-3">
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'Efectivo'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'Efectivo' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.payments} Efectivo</button>
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'QR'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'QR' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.qr_code_2} QR</button>
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'Tarjeta'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'Tarjeta' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.credit_card} Tarjeta</button>
                     </div>
                </div>
            </div>
        `}
        <div class="mt-6 p-4 rounded-lg bg-slate-50 border">
            <h4 class="font-semibold">Resumen</h4>
            <dl class="mt-2 text-sm space-y-1">
                <div class="flex justify-between"><dt class="text-gray-600">Total:</dt><dd class="font-medium">${total.toFixed(2)} ${formData.moneda}</dd></div>
                <div class="flex justify-between"><dt class="text-gray-600">Tipo Pago:</dt><dd class="font-medium">${formData.tipo_pago}</dd></div>
                ${formData.tipo_pago === 'Crédito' && html`
                    <div class="flex justify-between"><dt class="text-gray-600">Abono Inicial:</dt><dd class="font-medium">${Number(formData.abono_inicial).toFixed(2)} ${formData.moneda}</dd></div>
                    <div class="flex justify-between font-bold"><dt>Saldo Pendiente:</dt><dd class="text-red-600">${(total - Number(formData.abono_inicial)).toFixed(2)} ${formData.moneda}</dd></div>
                `}
            </dl>
        </div>
    `
};

function getLocalDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function NewPurchaseModal({ isOpen, onClose, onSave, user }) {
    const [step, setStep] = useState(1);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const [isProveedorFormOpen, setIsProveedorFormOpen] = useState(false);
    const [isProductFormOpen, setIsProductFormOpen] = useState(false);
    const [itemDetail, setItemDetail] = useState(null); // State for the new item detail modal

    const [formData, setFormData] = useState({
        proveedor_id: '',
        proveedor_nombre: '',
        sucursal_id: user.sucursal_id,
        fecha: getLocalDateString(),
        n_factura: '',
        moneda: 'BOB',
        tasa_cambio: '6.96',
        items: [],
        tipo_pago: 'Contado',
        fecha_vencimiento: '',
        abono_inicial: '0',
        metodo_abono_inicial: 'Efectivo',
    });

    const fetchInitialData = async () => {
        try {
            const [provRes, prodRes] = await Promise.all([
                supabase.rpc('get_company_providers'),
                supabase.rpc('get_company_products_for_dropdown')
            ]);
            if (provRes.error) throw provRes.error;
            if (prodRes.error) throw prodRes.error;
            setProveedores(provRes.data);
            setProductos(prodRes.data);
        } catch (err) {
            addToast({ message: `Error al cargar datos iniciales: ${err.message}`, type: 'error' });
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            // Reset state
            setStep(1);
            setFormData({
                proveedor_id: '', proveedor_nombre: '', sucursal_id: user.sucursal_id,
                fecha: getLocalDateString(), n_factura: '', moneda: 'BOB',
                tasa_cambio: '6.96', items: [], tipo_pago: 'Contado',
                fecha_vencimiento: '', abono_inicial: '0', metodo_abono_inicial: 'Efectivo',
            });
        }
    }, [isOpen]);

    const total = useMemo(() => 
        formData.items.reduce((sum, item) => sum + (Number(item.cantidad || 0) * Number(item.costo_unitario || 0)), 0)
    , [formData.items]);

    const addedProductIds = useMemo(() => new Set(formData.items.map(item => item.producto_id)), [formData.items]);
    
    const handleNext = () => {
        if (step === 2 && formData.items.length === 0) {
            addToast({ message: 'Debes añadir al menos un producto a la compra.', type: 'warning' });
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => setStep(prev => prev - 1);
    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleProductSelected = (product) => {
        setItemDetail({
            isNew: true,
            producto_id: product.id,
            producto_nombre: product.nombre,
            imagen_principal: product.imagen_principal,
            cantidad: 1,
            costo_unitario: '',
            stock_sucursal: product.stock_sucursal,
            precio_compra: product.precio_compra,
            precio_base: product.precio_base,
            nuevo_precio_base: product.precio_base?.toString() || ''
        });
    };
    
    const handleEditItem = (item) => {
        setItemDetail({ ...item, isNew: false });
    };
    
    const handleAddedProductClick = (productId) => {
        const item = formData.items.find(i => i.producto_id === productId);
        if(item) handleEditItem(item);
    };

    const handleSaveItem = (itemFromModal) => {
        const { isNew, ...itemData } = itemFromModal;
        setFormData(prev => {
            const newItems = [...prev.items];
            const index = newItems.findIndex(i => i.producto_id === itemData.producto_id);
            if (index > -1) {
                newItems[index] = itemData;
            } else {
                newItems.push(itemData);
            }
            return { ...prev, items: newItems };
        });
        setItemDetail(null); // Close modal
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };
    
    const handleSaveProveedor = (action, newId) => {
        setIsProveedorFormOpen(false);
        addToast({ message: `Proveedor ${action === 'edit' ? 'actualizado' : 'creado'}.`, type: 'success' });
        fetchInitialData().then(() => {
            if (action === 'create' && newId) {
                setTimeout(() => {
                    setProveedores(currentProveedores => {
                        const newProvider = currentProveedores.find(p => p.id === newId);
                        if (newProvider) {
                             setFormData(prev => ({ ...prev, proveedor_id: newId, proveedor_nombre: newProvider.nombre }));
                        }
                        return currentProveedores;
                    });
                }, 0);
            }
        });
    };

    const handleSaveProduct = (action, newProductId) => {
        setIsProductFormOpen(false);
        addToast({ message: 'Producto creado con éxito.', type: 'success' });
        fetchInitialData().then(() => {
             setTimeout(() => {
                setProductos(currentProductos => {
                    const newProduct = currentProductos.find(p => p.id === newProductId);
                    if (newProduct) {
                       handleProductSelected(newProduct);
                    }
                    return currentProductos;
                });
             }, 0);
        });
    };
    
    const handleConfirmSave = async () => {
        setIsLoading(true);
        try {
            const payload = {
                p_compra: {
                    proveedor_id: formData.proveedor_id,
                    sucursal_id: user.sucursal_id,
                    fecha: formData.fecha,
                    moneda: formData.moneda,
                    tasa_cambio: formData.moneda === 'USD' ? Number(formData.tasa_cambio) : null,
                    tipo_pago: formData.tipo_pago,
                    n_factura: formData.n_factura,
                    fecha_vencimiento: formData.tipo_pago === 'Crédito' ? formData.fecha_vencimiento : null,
                    abono_inicial: formData.tipo_pago === 'Crédito' ? Number(formData.abono_inicial) : null,
                    metodo_abono: formData.tipo_pago === 'Crédito' && Number(formData.abono_inicial) > 0 ? formData.metodo_abono_inicial : null
                },
                p_items: formData.items.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: Number(item.cantidad),
                    costo_unitario: Number(item.costo_unitario),
                    nuevo_precio_base: item.nuevo_precio_base !== '' ? Number(item.nuevo_precio_base) : null
                }))
            };

            const { error } = await supabase.rpc('registrar_compra', payload);
            if (error) throw error;
            onSave();
        } catch(err) {
            addToast({ message: `Error al registrar la compra: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const stepperSteps = [
        { name: 'Información', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'Productos', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Pago', status: step === 3 ? 'current' : 'upcoming' },
    ];
    
    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            title="Registrar Nueva Compra"
            isProcessing=${true}
            maxWidthClass="max-w-4xl"
        >
            <div class="mb-8">
                <nav aria-label="Progress">
                    <ol role="list" class="space-y-4 md:flex md:space-x-8 md:space-y-0">
                        ${stepperSteps.map((s, index) => html`
                        <li class="md:flex-1">
                            ${s.status === 'complete' ? html`
                            <a href="#" onClick=${(e) => { e.preventDefault(); if (index < step - 1) setStep(index + 1); }} class="group flex flex-col border-l-4 border-primary py-2 pl-4 transition-colors hover:border-primary-dark md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                                <span class="text-sm font-medium text-primary transition-colors">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </a>
                            ` : s.status === 'current' ? html`
                            <div class="flex flex-col border-l-4 border-primary py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4" aria-current="step">
                                <span class="text-sm font-medium text-primary">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </div>
                            ` : html`
                            <div class="group flex flex-col border-l-4 border-gray-200 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                                <span class="text-sm font-medium text-gray-500 transition-colors">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-500">${s.name}</span>
                            </div>
                            `}
                        </li>
                        `)}
                    </ol>
                </nav>
            </div>

            <div class="max-h-[65vh] overflow-y-auto -m-6 p-6">
                 ${step === 1 && html`<${Step1} formData=${formData} handleInput=${handleInput} setFormData=${setFormData} proveedores=${proveedores} setIsProveedorFormOpen=${setIsProveedorFormOpen} />`}
                 ${step === 2 && html`<${Step2} formData=${formData} handleEditItem=${handleEditItem} handleRemoveItem=${handleRemoveItem} total=${total} productos=${productos} onProductSelected=${handleProductSelected} onAddedProductClick=${handleAddedProductClick} setIsProductFormOpen=${setIsProductFormOpen} addedProductIds=${addedProductIds} />`}
                 ${step === 3 && html`<${Step3} formData=${formData} handleInput=${handleInput} setFormData=${setFormData} total=${total} />`}
            </div>

            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-b-xl">
                <button 
                    type="button"
                    onClick=${step === 1 ? onClose : handleBack} 
                    class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                    ${step === 1 ? 'Cancelar' : 'Volver'}
                </button>
                <button 
                    type="button"
                    onClick=${step === 3 ? handleConfirmSave : handleNext}
                    disabled=${isLoading}
                    class="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400 min-w-[120px] flex justify-center"
                >
                    ${isLoading ? html`<${Spinner}/>` : (step === 3 ? 'Guardar Compra' : 'Siguiente')}
                </button>
            </div>
             <${ProveedorFormModal} 
                isOpen=${isProveedorFormOpen} 
                onClose=${() => setIsProveedorFormOpen(false)} 
                onSave=${handleSaveProveedor} 
            />
            <${ProductFormModal}
                isOpen=${isProductFormOpen}
                onClose=${() => setIsProductFormOpen(false)}
                onSave=${handleSaveProduct}
                user=${user}
            />
            <${PurchaseItemDetailModal}
                isOpen=${!!itemDetail}
                onClose=${() => setItemDetail(null)}
                onSave=${handleSaveItem}
                item=${itemDetail}
                currency=${formData.moneda}
                exchangeRate=${formData.tasa_cambio}
                addToast=${addToast}
            />
        <//>
    `;
}