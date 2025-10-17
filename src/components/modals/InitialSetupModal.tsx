/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useInitialSetup } from '../../contexts/StatePersistence.js';

export function InitialSetupModal({ onSave, branches, companyInfo }) {
    const { addToast } = useToast();
    const { isModalOpen, setIsModalOpen, productForSetup: product, draft, setDraft, clearDraft } = useInitialSetup();
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ costoInicial?: string; precioBase?: string; }>({});

    const { costoInicial, precioBase, inventoryData } = draft;

    const handleClose = () => {
        clearDraft();
        setIsModalOpen(false);
    };

    useEffect(() => {
        if (isModalOpen && product) {
            setDraft(prev => ({
                ...prev,
                costoInicial: product.precio_compra > 0 ? String(product.precio_compra) : '',
                precioBase: product.precio_base > 0 ? String(product.precio_base) : '',
                inventoryData: {},
            }));
            setErrors({});
        }
    }, [isModalOpen, product, setDraft]);

    const handleInventoryInput = (branchId, field, value) => {
        const numValue = value === '' ? '' : Math.max(0, Number(value));
        setDraft(prev => ({
            ...prev,
            inventoryData: {
                ...prev.inventoryData,
                [branchId]: {
                    ...(prev.inventoryData[branchId] || {}),
                    [field]: numValue
                }
            }
        }));
    };

    const handleConfirm = async () => {
        const newErrors: { costoInicial?: string; precioBase?: string; } = {};
        if (Number(costoInicial) <= 0) newErrors.costoInicial = 'Debe ser mayor a 0.';
        if (Number(precioBase) <= 0) newErrors.precioBase = 'Debe ser mayor a 0.';
        if (Number(precioBase) < Number(costoInicial)) newErrors.precioBase = 'No puede ser menor al costo.';

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            addToast({ message: 'Por favor, corrige los errores.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const ajustes = Object.entries(inventoryData)
                .map(([sucursal_id, data]) => ({
                    sucursal_id,
                    cantidad_inicial: Number(data.cantidad) || 0,
                    stock_minimo: Number(data.stock_minimo) || 0,
                }))
                .filter(a => a.cantidad_inicial > 0 || a.stock_minimo > 0);

            const { error } = await supabase.rpc('set_initial_product_setup', {
                p_producto_id: product.id,
                p_costo_inicial: Number(costoInicial),
                p_precio_base: Number(precioBase),
                p_ajustes: ajustes,
            });

            if (error) throw error;
            addToast({ message: 'Configuración inicial guardada con éxito.', type: 'success' });
            onSave();
            handleClose();
        } catch (err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!product) return null;

    return html`
        <${ConfirmationModal}
            isOpen=${isModalOpen}
            onClose=${handleClose}
            onConfirm=${handleConfirm}
            title="Configuración Inicial Rápida"
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar Configuración'}
            icon=${ICONS.bolt}
            maxWidthClass="max-w-3xl"
        >
            <div class="md:flex md:flex-col md:max-h-[65vh] overflow-y-auto md:overflow-y-hidden">
                <div class="md:flex-shrink-0">
                    <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 class="text-lg font-bold text-blue-900">${product.nombre}</h3>
                        <dl class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div>
                                <dt class="text-gray-500">Marca:</dt>
                                <dd class="font-medium text-gray-800">${product.marca || 'N/A'}</dd>
                            </div>
                            <div>
                                <dt class="text-gray-500">Modelo:</dt>
                                <dd class="font-medium text-gray-800">${product.modelo || 'N/A'}</dd>
                            </div>
                        </dl>
                    </div>
                    <p class="text-sm text-gray-600 my-4">Establece el costo, precio e inventario inicial para este producto.</p>
                    
                    <section class="p-4 bg-slate-50 border rounded-lg">
                        <h3 class="text-base font-semibold text-gray-800 mb-2">Precios y Costos</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <${FormInput} label="Costo Inicial (${companyInfo.monedaSimbolo})" name="costo_inicial" type="number" value=${costoInicial} onInput=${e => setDraft(d => ({...d, costoInicial: e.target.value}))} error=${errors.costoInicial} />
                            <${FormInput} label="Precio Venta Base (${companyInfo.monedaSimbolo})" name="precio_base" type="number" value=${precioBase} onInput=${e => setDraft(d => ({...d, precioBase: e.target.value}))} error=${errors.precioBase} />
                        </div>
                    </section>
                </div>

                <section class="mt-4 md:flex md:flex-col md:flex-grow md:min-h-0">
                    <h3 class="text-base font-semibold text-gray-800 mb-2 md:flex-shrink-0">Inventario Inicial por Sucursal</h3>
                    <div class="md:overflow-y-auto md:pr-2 md:flex-grow">
                        <div class="space-y-3">
                            ${branches.map(branch => html`
                                <div key=${branch.id} class="grid grid-cols-1 sm:grid-cols-3 items-end gap-3 p-3 border rounded-md bg-white">
                                    <label class="text-sm font-medium text-gray-700 col-span-3 sm:col-span-1">${branch.nombre}</label>
                                    <div class="col-span-3 sm:col-span-2 grid grid-cols-2 gap-3">
                                        <${FormInput} label="Cantidad Inicial" name="cantidad" type="number" placeholder="0" required=${false} value=${inventoryData[branch.id]?.cantidad || ''} onInput=${e => handleInventoryInput(branch.id, 'cantidad', e.target.value)} />
                                        <${FormInput} label="Stock Mínimo" name="stock_minimo" type="number" placeholder="0" required=${false} value=${inventoryData[branch.id]?.stock_minimo || ''} onInput=${e => handleInventoryInput(branch.id, 'stock_minimo', e.target.value)} />
                                    </div>
                                </div>
                            `)}
                        </div>
                    </div>
                </section>
            </div>
        <//>
    `;
}