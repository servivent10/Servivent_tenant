/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';

export function NuevoTraspasoPage({ user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [step, setStep] = useState(1);
    const [branches, setBranches] = useState([]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        sucursal_origen_id: user.sucursal_id,
        sucursal_destino_id: '',
        fecha: new Date().toISOString(),
        notas: '',
        items: []
    });
    
    const [isPreloading, setIsPreloading] = useState(true);

    const loadDataFromRequest = useCallback(async (requestId) => {
        startLoading();
        setIsPreloading(true);
        try {
            const { data, error } = await supabase.rpc('get_solicitud_traspaso_details', { p_solicitud_id: requestId });
            if (error) throw error;
            
            if (data) {
                setFormData({
                    sucursal_origen_id: data.sucursal_origen_id,
                    sucursal_destino_id: data.sucursal_destino_id,
                    fecha: new Date().toISOString(),
                    notas: `Traspaso generado a partir de la solicitud para la proforma ${data.proforma_folio}.`,
                    items: data.items.map(item => ({
                        producto_id: item.producto_id,
                        nombre: item.producto_nombre,
                        modelo: item.producto_modelo,
                        imagen_principal: item.producto_imagen,
                        stock_origen: item.stock_origen,
                        cantidad: item.cantidad_solicitada > item.stock_origen ? item.stock_origen : item.cantidad_solicitada,
                    }))
                });
                
                if (data.items.some(item => item.cantidad_solicitada > item.stock_origen)) {
                    addToast({ message: 'Advertencia: El stock de algunos productos es insuficiente para cubrir la solicitud. Las cantidades se han ajustado al máximo disponible.', type: 'warning', duration: 10000 });
                }
                
                setStep(2); // Automatically advance to step 2
            }
        } catch (err) {
            addToast({ message: `Error al cargar la solicitud: ${err.message}`, type: 'error' });
            navigate('/traspasos');
        } finally {
            stopLoading();
            setIsPreloading(false);
        }
    }, [startLoading, stopLoading, addToast, navigate]);

    useEffect(() => {
        const hash = window.location.hash;
        const queryParams = new URLSearchParams(hash.split('?')[1]);
        const requestId = queryParams.get('solicitud');
        
        const fetchInitialData = async () => {
            startLoading();
            try {
                const { data, error } = await supabase.rpc('get_data_for_new_traspaso');
                if (error) throw error;
                setBranches(data.sucursales);
                if (requestId) {
                    await loadDataFromRequest(requestId);
                } else {
                    setIsPreloading(false);
                }
            } catch (err) {
                addToast({ message: `Error al cargar datos: ${err.message}`, type: 'error' });
                setIsPreloading(false);
            } finally {
                stopLoading();
            }
        };

        fetchInitialData();
    }, [loadDataFromRequest]);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!formData.sucursal_origen_id) {
                setProducts([]);
                return;
            }
            try {
                const { data, error } = await supabase.rpc('get_products_for_traspaso', { p_sucursal_id: formData.sucursal_origen_id });
                if (error) throw error;
                setProducts(data);
            } catch (err) {
                addToast({ message: `Error al cargar productos: ${err.message}`, type: 'error' });
            }
        };
        fetchProducts();
    }, [formData.sucursal_origen_id]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = () => {
        if (step === 1) {
            if (!formData.sucursal_origen_id || !formData.sucursal_destino_id) {
                addToast({ message: 'Debes seleccionar una sucursal de origen y una de destino.', type: 'warning' });
                return;
            }
            if (formData.sucursal_origen_id === formData.sucursal_destino_id) {
                addToast({ message: 'La sucursal de origen y destino no pueden ser la misma.', type: 'warning' });
                return;
            }
        }
        if (step === 2 && formData.items.length === 0) {
            addToast({ message: 'Debes añadir al menos un producto para el traspaso.', type: 'warning' });
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => setStep(prev => prev - 1);

    const handleAddItem = (product) => {
        const existingItem = formData.items.find(item => item.producto_id === product.id);
        if (existingItem) {
            addToast({ message: `${product.nombre} ya está en la lista.`, type: 'info' });
            return;
        }
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                producto_id: product.id,
                nombre: product.nombre,
                modelo: product.modelo,
                imagen_principal: product.imagen_principal,
                stock_origen: product.stock_sucursal,
                cantidad: 1
            }]
        }));
    };
    
    const handleUpdateQuantity = (productId, newQuantityStr) => {
        const newQuantity = parseInt(newQuantityStr, 10);
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.producto_id === productId) {
                    if (isNaN(newQuantity) || newQuantity < 1) {
                        return { ...item, cantidad: 1 };
                    }
                    if (newQuantity > item.stock_origen) {
                        addToast({ message: `Stock máximo (${item.stock_origen}) alcanzado.`, type: 'warning' });
                        return { ...item, cantidad: item.stock_origen };
                    }
                    return { ...item, cantidad: newQuantity };
                }
                return item;
            })
        }));
    };

    const handleRemoveItem = (productId) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.producto_id !== productId)
        }));
    };

    const handleConfirmSave = async () => {
        setIsLoading(true);
        startLoading();
        try {
            const payload = {
                p_origen_id: formData.sucursal_origen_id,
                p_destino_id: formData.sucursal_destino_id,
                p_fecha: formData.fecha,
                p_notas: formData.notas,
                p_items: formData.items.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad
                }))
            };
            
            const { error } = await supabase.rpc('registrar_traspaso', payload);
            if (error) throw error;
            
            addToast({ message: 'Traspaso registrado con éxito.', type: 'success' });
            navigate('/traspasos');
        } catch (err) {
            addToast({ message: `Error al registrar el traspaso: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
            stopLoading();
        }
    };
    
    const [searchTerm, setSearchTerm] = useState('');
    const availableProducts = useMemo(() => {
        const addedIds = new Set(formData.items.map(i => i.producto_id));
        const lowerCaseSearch = searchTerm.toLowerCase();
        return products
            .filter(p => !addedIds.has(p.id))
            .filter(p => p.nombre.toLowerCase().includes(lowerCaseSearch) || (p.modelo && p.modelo.toLowerCase().includes(lowerCaseSearch)));
    }, [products, formData.items, searchTerm]);

    const steps = [
        { name: 'Origen y Destino', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'Productos', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Confirmación', status: step === 3 ? 'current' : 'upcoming' },
    ];
    
    const breadcrumbs = [ { name: 'Traspasos', href: '#/traspasos' }, { name: 'Nuevo Traspaso', href: '#/traspasos/nuevo' } ];

    if (isPreloading) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Traspasos" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} />`;
    }

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Traspasos" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo}>
            <div class="flex justify-between items-center gap-4 mb-6">
                <div class="flex items-center gap-4">
                    <button onClick=${() => navigate('/traspasos')} class="p-2 rounded-full hover:bg-gray-100" aria-label="Volver">
                        ${ICONS.arrow_back}
                    </button>
                    <h1 class="text-2xl font-semibold text-gray-900">Nuevo Traspaso de Inventario</h1>
                </div>
                <div class="flex items-center gap-2">
                     <button 
                        type="button"
                        onClick=${step === 1 ? () => navigate('/traspasos') : handleBack} 
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
                        ${isLoading ? html`<${Spinner}/>` : (step === 3 ? 'Confirmar y Guardar' : 'Siguiente')}
                    </button>
                </div>
            </div>

            <div class="bg-white p-6 sm:p-8 rounded-xl shadow-sm border">
                 <nav aria-label="Progress" class="mb-8">
                    <ol role="list" class="space-y-4 md:flex md:space-x-8 md:space-y-0">
                        ${steps.map((s, index) => html`
                        <li class="md:flex-1">
                            <div class="flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4
                                ${s.status === 'complete' ? 'border-primary' : (s.status === 'current' ? 'border-primary' : 'border-gray-200')}">
                                <span class="text-sm font-medium ${s.status === 'current' || s.status === 'complete' ? 'text-primary' : 'text-gray-500'}">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </div>
                        </li>
                        `)}
                    </ol>
                </nav>

                <div class="min-h-[25rem]">
                    ${step === 1 && html`
                        <div class="max-w-xl mx-auto space-y-6 animate-fade-in-down">
                            <h3 class="text-lg font-semibold text-gray-900">1. Define el Origen y Destino</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label for="sucursal_origen_id" class="block text-sm font-medium text-gray-900">Enviar Desde (Origen)</label>
                                    <select id="sucursal_origen_id" name="sucursal_origen_id" value=${formData.sucursal_origen_id} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                        <option value="">-- Selecciona Origen --</option>
                                        ${branches.map(b => html`<option value=${b.id}>${b.nombre}</option>`)}
                                    </select>
                                </div>
                                <div>
                                    <label for="sucursal_destino_id" class="block text-sm font-medium text-gray-900">Enviar A (Destino)</label>
                                    <select id="sucursal_destino_id" name="sucursal_destino_id" value=${formData.sucursal_destino_id} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                        <option value="">-- Selecciona Destino --</option>
                                        ${branches.filter(b => b.id !== formData.sucursal_origen_id).map(b => html`<option value=${b.id}>${b.nombre}</option>`)}
                                    </select>
                                </div>
                            </div>
                            <${FormInput} label="Fecha y Hora del Traspaso" name="fecha" type="datetime-local" value=${formData.fecha} onInput=${handleInput} />
                            <${FormInput} label="Notas (Opcional)" name="notas" type="text" value=${formData.notas} onInput=${handleInput} required=${false} />
                        </div>
                    `}
                    ${step === 2 && html`
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-down">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">2. Productos a Traspasar</h3>
                                <div class="mt-4 p-4 bg-gray-50 rounded-lg border max-h-[25rem] overflow-y-auto">
                                    ${formData.items.length === 0 ? html`<p class="text-center text-gray-500 py-10">Añade productos del catálogo.</p>` :
                                    html`<ul class="divide-y divide-gray-200">
                                        ${formData.items.map(item => html`
                                            <li class="py-3 flex items-center gap-3">
                                                <img src=${item.imagen_principal || NO_IMAGE_ICON_URL} class="h-12 w-12 rounded-md object-cover flex-shrink-0 bg-white" />
                                                <div class="flex-1 min-w-0">
                                                    <p class="font-medium text-gray-800 truncate">${item.nombre}</p>
                                                    <p class="text-sm text-gray-500">Stock Origen: ${item.stock_origen}</p>
                                                </div>
                                                <div class="flex-shrink-0 flex items-center gap-2">
                                                    <input type="number" value=${item.cantidad} onInput=${e => handleUpdateQuantity(item.producto_id, e.target.value)} onFocus=${e => e.target.select()} class="w-20 text-center rounded-md border-gray-300 bg-white text-gray-900 shadow-sm p-1 text-sm font-semibold focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25" />
                                                    <button onClick=${() => handleRemoveItem(item.producto_id)} class="p-2 text-gray-400 hover:text-red-600 rounded-full">${ICONS.delete}</button>
                                                </div>
                                            </li>
                                        `)}
                                    </ul>`}
                                </div>
                            </div>
                             <div>
                                <h3 class="text-lg font-semibold text-gray-900">Catálogo de Origen</h3>
                                <div class="mt-4"><input type="text" value=${searchTerm} onInput=${e => setSearchTerm(e.target.value)} placeholder="Buscar producto..." class="block w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" /></div>
                                <div class="mt-2 p-2 bg-gray-50 border rounded-lg max-h-[25rem] overflow-y-auto">
                                    <ul class="divide-y divide-gray-200">
                                        ${availableProducts.map(p => html`
                                            <li onClick=${() => handleAddItem(p)} class="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 rounded-md">
                                                <img src=${p.imagen_principal || NO_IMAGE_ICON_URL} class="h-10 w-10 rounded-md object-cover flex-shrink-0 bg-white" />
                                                <div class="flex-1 min-w-0">
                                                    <p class="font-medium text-gray-800 truncate">${p.nombre}</p>
                                                    <p class="text-xs text-gray-500 truncate" title=${p.modelo || ''}>${p.modelo || 'Sin modelo'}</p>
                                                    <p class="text-xs text-gray-500">Stock disponible: <span class="font-bold text-emerald-600">${p.stock_sucursal}</span></p>
                                                </div>
                                                <div class="text-primary">${ICONS.add_circle}</div>
                                            </li>
                                        `)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `}
                    ${step === 3 && html`
                        <div class="max-w-2xl mx-auto space-y-6 animate-fade-in-down">
                            <h3 class="text-lg font-semibold text-gray-900">3. Confirmar Traspaso</h3>
                            <div class="p-4 bg-slate-50 border rounded-lg space-y-4">
                                <div class="flex justify-between items-center text-center">
                                    <div><p class="text-sm text-gray-600">Origen</p><p class="font-bold text-lg text-gray-800">${branches.find(b => b.id === formData.sucursal_origen_id)?.nombre}</p></div>
                                    <div class="text-3xl text-primary mt-4">${ICONS.transfers}</div>
                                    <div><p class="text-sm text-gray-600">Destino</p><p class="font-bold text-lg text-gray-800">${branches.find(b => b.id === formData.sucursal_destino_id)?.nombre}</p></div>
                                </div>
                                <div class="text-sm text-center text-gray-600 border-t pt-2">Fecha: ${new Date(formData.fecha).toLocaleString()}</div>
                            </div>
                            <div>
                                <h4 class="font-medium text-gray-800 mb-2">Productos a transferir:</h4>
                                <ul class="divide-y divide-gray-200 border rounded-md max-h-60 overflow-y-auto">
                                    ${formData.items.map(item => html`
                                        <li class="p-3 flex justify-between items-center">
                                            <span class="text-sm text-gray-700">${item.nombre}</span>
                                            <span class="font-bold text-primary">${item.cantidad}</span>
                                        </li>
                                    `)}
                                </ul>
                            </div>
                            ${formData.notas && html`<div><h4 class="font-medium text-gray-800">Notas:</h4><p class="text-sm text-gray-600 p-2 bg-gray-50 border rounded-md">${formData.notas}</p></div>`}
                        </div>
                    `}
                </div>
            </div>
        <//>
    `;
}