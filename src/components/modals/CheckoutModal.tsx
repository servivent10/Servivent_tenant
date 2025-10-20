/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { ICONS } from '../Icons.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { ConfirmationModal } from '../ConfirmationModal.js';

const PaymentMethodButton = ({ icon, label, method, onClick }) => {
    return html`
        <button 
            type="button"
            onClick=${() => onClick(method)} 
            class="flex-1 flex flex-col items-center justify-center p-3 rounded-lg text-sm font-semibold transition-colors border bg-slate-100 text-gray-700 border-gray-200 hover:bg-slate-200 hover:border-slate-300"
        >
            ${icon}
            <span class="mt-1">${label}</span>
        </button>
    `;
};

const SaleTypeButton = ({ label, type, activeType, onClick, disabled = false }) => {
    const isActive = type === activeType;
    const baseClasses = "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors";
    const activeClasses = "bg-primary text-white shadow-md";
    const inactiveClasses = "bg-slate-200 text-gray-700 hover:bg-slate-300";
    const disabledClasses = "disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed";

    return html`
        <button type="button" onClick=${() => onClick(type)} disabled=${disabled} class="${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${disabledClasses}">
            ${label}
        </button>
    `;
};

export function CheckoutModal({ isOpen, onClose, onConfirm, total = 0, clienteId, companyInfo }) {
    const [pagos, setPagos] = useState([]);
    const [tipoVenta, setTipoVenta] = useState('Contado');
    const [isProcessing, setIsProcessing] = useState(false);
    const [fechaVencimiento, setFechaVencimiento] = useState('');

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

    const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0), [pagos]);
    const montoRestante = useMemo(() => total - totalPagado, [total, totalPagado]);
    const cambio = useMemo(() => (tipoVenta === 'Contado' && totalPagado > total) ? totalPagado - total : 0, [total, totalPagado, tipoVenta]);

    useEffect(() => {
        if (isOpen) {
            setTipoVenta('Contado');
            setFechaVencimiento('');
            setIsProcessing(false);
            setPagos([{ id: Date.now(), metodo: 'Efectivo', monto: total > 0 ? total.toFixed(2) : '' }]);
        }
    }, [isOpen, total]);
    
    useEffect(() => {
        if (tipoVenta === 'Crédito') {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            setFechaVencimiento(dueDate.toISOString().split('T')[0]);
            // If user switches to credit with a full payment, clear it to represent an initial payment.
            if (totalPagado.toFixed(2) === total.toFixed(2)) {
                setPagos(prev => prev.map(p => ({...p, monto: ''})));
            }
        } else {
            setFechaVencimiento('');
            if (pagos.length === 1) {
                setPagos(prev => [{...prev[0], monto: total.toFixed(2)}]);
            }
        }
    }, [tipoVenta, total]);

    const handleAddPago = (metodo) => {
        setPagos(prev => [...prev, {
            id: Date.now(),
            metodo,
            monto: montoRestante > 0 ? montoRestante.toFixed(2) : ''
        }]);
    };

    const handleUpdatePago = (id, newMonto) => {
        setPagos(prev => prev.map(p => p.id === id ? { ...p, monto: newMonto } : p));
    };

    const handleRemovePago = (id) => {
        setPagos(prev => prev.filter(p => p.id !== id));
    };

    const handleConfirm = () => {
        setIsProcessing(true);
        const finalPayments = pagos.filter(p => Number(p.monto) > 0).map(({ id, ...rest }) => rest);
        onConfirm({
            total,
            tipoVenta,
            pagos: finalPayments,
            fechaVencimiento: tipoVenta === 'Crédito' ? fechaVencimiento : null,
        });
    };

    const isConfirmDisabled = useMemo(() => {
        if (isProcessing || total <= 0) return true;
        if (tipoVenta === 'Crédito' && clienteId) return false;
        if (tipoVenta === 'Contado') return montoRestante > 0.005; // Allow for tiny float inaccuracies
        return true;
    }, [isProcessing, total, tipoVenta, montoRestante, clienteId]);
    
    const title = "Finalizar Venta";

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isProcessing ? html`<${Spinner}/>` : 'Confirmar Venta'}
            icon=${ICONS.pos}
            maxWidthClass="max-w-xl"
            isProcessing=${isProcessing}
            confirmVariant="primary"
            customFooter=${html`
                <div class="flex-shrink-0 flex justify-end items-center p-4 bg-gray-100 rounded-b-xl space-x-3 border-t">
                    <button type="button" onClick=${onClose} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancelar</button>
                    <button type="button" onClick=${handleConfirm} disabled=${isConfirmDisabled} class="min-w-[150px] flex justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        ${isProcessing ? html`<${Spinner}/>` : 'Confirmar Venta'}
                    </button>
                </div>
            `}
        >
            <div class="space-y-6">
                <div class="text-center p-4 bg-slate-100 rounded-lg">
                    <p class="text-sm text-gray-600">Total a Pagar</p>
                    <p class="text-5xl font-bold text-primary">${formatCurrency(total)}</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-900 mb-2">Tipo de Venta</label>
                    <div class="flex items-center gap-2">
                        <${SaleTypeButton} label="Al Contado" type="Contado" activeType=${tipoVenta} onClick=${setTipoVenta} />
                        <${SaleTypeButton} label="A Crédito" type="Crédito" activeType=${tipoVenta} onClick=${setTipoVenta} disabled=${!clienteId} />
                    </div>
                    ${!clienteId && html`<p class="text-xs text-gray-500 mt-1">Selecciona un cliente para habilitar la venta a crédito.</p>`}
                </div>
                
                ${tipoVenta === 'Crédito' && html`
                    <div class="animate-fade-in-down">
                        <${FormInput} label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value=${fechaVencimiento} onInput=${e => setFechaVencimiento(e.target.value)} />
                    </div>
                `}

                <div>
                    <label class="block text-sm font-medium text-gray-900 mb-2">Métodos de Pago</label>
                    <div class="space-y-3">
                        ${pagos.map(pago => html`
                            <div key=${pago.id} class="flex items-center gap-2 animate-fade-in-down">
                                <span class="font-semibold text-gray-700 w-24 text-right">${pago.metodo}</span>
                                <div class="flex-grow">
                                    <input 
                                        type="number" 
                                        value=${pago.monto} 
                                        onInput=${e => handleUpdatePago(pago.id, e.target.value)}
                                        onFocus=${e => e.target.select()}
                                        placeholder="0.00"
                                        class="block w-full rounded-md border border-gray-300 p-2 text-gray-900 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25"
                                    />
                                </div>
                                <button onClick=${() => handleRemovePago(pago.id)} class="text-gray-400 hover:text-red-600" title="Eliminar método de pago">${ICONS.delete}</button>
                            </div>
                        `)}
                    </div>
                    <div class="mt-3 flex items-center gap-2">
                        <${PaymentMethodButton} icon=${ICONS.payments} label="Efectivo" method="Efectivo" onClick=${handleAddPago} />
                        <${PaymentMethodButton} icon=${ICONS.credit_card} label="Tarjeta" method="Tarjeta" onClick=${handleAddPago} />
                        <${PaymentMethodButton} icon=${ICONS.qr_code_2} label="QR" method="QR" onClick=${handleAddPago} />
                        <${PaymentMethodButton} icon=${ICONS.currency_exchange} label="Transf." method="Transferencia Bancaria" onClick=${handleAddPago} />
                    </div>
                </div>

                <div class="border-t pt-4 space-y-2">
                    <div class="flex justify-between font-medium">
                        <span>Total Pagado</span>
                        <span>${formatCurrency(totalPagado)}</span>
                    </div>
                    <div class="flex justify-between font-medium ${montoRestante > 0.005 ? 'text-red-600' : 'text-gray-800'}">
                        <span>${tipoVenta === 'Crédito' ? 'Saldo Pendiente' : 'Monto Restante'}</span>
                        <span>${formatCurrency(montoRestante)}</span>
                    </div>
                    ${tipoVenta === 'Contado' && html`
                        <div class="flex justify-between font-bold text-lg text-green-600">
                            <span>Cambio</span>
                            <span>${formatCurrency(cambio)}</span>
                        </div>
                    `}
                </div>
            </div>
        <//>
    `;
}
