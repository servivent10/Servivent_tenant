/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput, FormSelect } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { ICONS } from '../Icons.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

export function InventoryAdjustModal({ isOpen, onClose, onSave, product, branchToAdjust, inventory }) {
    const { addToast } = useToast();
    const [adjustment, setAdjustment] = useState('');
    const [stockMinimo, setStockMinimo] = useState('');
    const [reason, setReason] = useState('Carga Inicial de Inventario');
    const [isLoading, setIsLoading] = useState(false);

    const currentInventoryItem = useMemo(() => 
        inventory?.find(item => item.sucursal_id === branchToAdjust?.id),
        [inventory, branchToAdjust]
    );
    
    const currentStock = useMemo(() => 
        Number(currentInventoryItem?.cantidad || 0), 
        [currentInventoryItem]
    );
    
    useEffect(() => {
        if (isOpen && branchToAdjust) {
            setAdjustment('');
            // Set default reason to "Carga Inicial" only if current stock is zero, otherwise "Ajuste manual"
            setReason(currentStock === 0 ? 'Carga Inicial de Inventario' : 'Ajuste manual');
            setStockMinimo(String(currentInventoryItem?.stock_minimo || '0'));
        }
    }, [isOpen, branchToAdjust, currentInventoryItem, currentStock]);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const payload = [{
                sucursal_id: branchToAdjust.id,
                cantidad_ajuste: Number(adjustment) || 0,
                stock_minimo: Number(stockMinimo) || 0
            }];
            const { error } = await supabase.rpc('ajustar_inventario_lote', {
                p_producto_id: product.id,
                p_ajustes: payload,
                p_motivo: reason,
            });
            if (error) throw error;
            onSave();
        } catch (err) {
            addToast({ message: `Error al ajustar inventario: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const newStock = currentStock + (Number(adjustment) || 0);

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title="Ajuste de Inventario"
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar Ajustes'}
            icon=${ICONS.inventory}
            maxWidthClass="max-w-md"
        >
            <div class="space-y-4">
                <p class="text-sm text-gray-600">Ajustando para <b class="text-gray-800">${product?.nombre}</b> en <b class="text-gray-800">${branchToAdjust?.nombre}</b>.</p>
                
                <${FormSelect} 
                    label="Motivo del Ajuste" 
                    name="reason" 
                    value=${reason} 
                    onInput=${e => setReason(e.target.value)}
                >
                    <option value="Carga Inicial de Inventario">Carga Inicial de Inventario</option>
                    <option value="Ajuste manual">Ajuste Manual</option>
                    <option value="Pérdida/Daño">Pérdida o Daño</option>
                    <option value="Devolución de cliente">Devolución de Cliente</option>
                    <option value="Error de conteo">Error de Conteo</option>
                <//>

                <div class="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-lg border">
                    <div>
                        <p class="text-xs font-medium text-gray-500">Stock Actual</p>
                        <p class="text-2xl font-bold text-gray-800">${currentStock}</p>
                    </div>
                    <div class="flex items-center justify-center text-2xl text-gray-400">+</div>
                    <div>
                        <p class="text-xs font-medium text-gray-500">Ajuste (+/-)</p>
                        <input 
                            type="number" 
                            value=${adjustment} 
                            onInput=${e => setAdjustment(e.target.value)} 
                            onFocus=${e => e.target.select()}
                            placeholder="0"
                            class="w-full text-center text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-300 focus:ring-0 focus:border-primary p-0" 
                        />
                    </div>
                </div>
                
                <div class="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-sm font-medium text-blue-800">Nuevo Stock Calculado</p>
                    <p class="text-3xl font-bold text-blue-900">${newStock}</p>
                </div>

                <${FormInput} 
                    label="Stock Mínimo de Alerta" 
                    name="stock_minimo" 
                    type="number" 
                    value=${stockMinimo} 
                    onInput=${e => setStockMinimo(e.target.value)}
                    required=${false}
                />
            </div>
        <//>
    `;
}