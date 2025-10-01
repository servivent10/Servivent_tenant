/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ICONS } from '../Icons.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';

const PaymentButton = ({ icon, label, method, activeMethod, onClick }) => {
    const isActive = method === activeMethod;
    const baseClasses = "flex-1 flex flex-col items-center justify-center p-3 rounded-lg text-sm font-semibold transition-colors border";
    const activeClasses = "bg-primary text-white border-primary-dark";
    const inactiveClasses = "bg-slate-100 text-gray-700 border-gray-200 hover:bg-slate-200";

    return html`
        <button onClick=${() => onClick(method)} class="${baseClasses} ${isActive ? activeClasses : inactiveClasses}">
            ${icon}
            <span class="mt-1">${label}</span>
        </button>
    `;
};

const SaleTypeButton = ({ label, type, activeType, onClick, disabled = false }) => {
    const isActive = type === activeType;
    const baseClasses = "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors";
    const activeClasses = "bg-primary text-white";
    const inactiveClasses = "bg-slate-100 text-gray-700 hover:bg-slate-200";
    const disabledClasses = "disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed";

    return html`
        <button type="button" onClick=${() => onClick(type)} disabled=${disabled} class="${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${disabledClasses}">
            ${label}
        </button>
    `;
};


export function CheckoutModal({ isOpen, onClose, onConfirm, total = 0, clienteId }) {
    const [montoRecibido, setMontoRecibido] = useState('');
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [tipoVenta, setTipoVenta] = useState('Contado');
    const [isProcessing, setIsProcessing] = useState(false);
    const [fechaVencimiento, setFechaVencimiento] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMontoRecibido(total > 0 ? total.toFixed(2) : '');
            setMetodoPago('Efectivo');
            setTipoVenta('Contado');
            setFechaVencimiento('');
            setIsProcessing(false);
        }
    }, [isOpen, total]);
    
    useEffect(() => {
        // If client is deselected, sale cannot be credit
        if (!clienteId) {
            setTipoVenta('Contado');
        }
    }, [clienteId]);

    useEffect(() => {
        if (tipoVenta === 'Crédito') {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            const year = dueDate.getFullYear();
            const month = (dueDate.getMonth() + 1).toString().padStart(2, '0');
            const day = dueDate.getDate().toString().padStart(2, '0');
            setFechaVencimiento(`${year}-${month}-${day}`);
        } else {
            setFechaVencimiento('');
        }
    }, [tipoVenta]);


    const handleConfirm = () => {
        onConfirm({
            total,
            metodoPago,
            tipoVenta,
            montoRecibido: Number(montoRecibido) || 0,
            cambio: cambio,
            fechaVencimiento: tipoVenta === 'Crédito' ? fechaVencimiento : null,
        });
    };

    const cambio = Number(montoRecibido) - total;
    const canConfirm = () => {
        if (isProcessing) return false;
        if (total <= 0) return false;
        if (tipoVenta === 'Crédito') return true; // Can register a debt
        if (metodoPago === 'Tarjeta' || metodoPago === 'QR') return true;
        // Efectivo y Contado
        return Number(montoRecibido) >= total;
    };
    const isConfirmDisabled = !canConfirm();
    
    const [showModal, setShowModal] = useState(isOpen);
    useEffect(() => {
        if (isOpen) {
            setShowModal(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setShowModal(false);
                document.body.style.overflow = 'auto';
            }, 200);
            return () => clearTimeout(timer);
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!showModal) return null;

    const overlayAnimation = isOpen ? 'animate-modal-fade-in' : 'animate-modal-fade-out';
    const modalAnimation = isOpen ? 'animate-modal-scale-in' : 'animate-modal-scale-out';
    
    return html`
        <div 
            class="fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayAnimation}" 
            onClick=${onClose}
            role="dialog"
            aria-modal="true"
        >
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
            
            <div onClick=${e => e.stopPropagation()} class="relative w-full max-w-md rounded-xl bg-slate-50 text-gray-900 shadow-2xl ${modalAnimation} flex flex-col max-h-[90vh]">
                
                <header class="flex-shrink-0 flex items-start justify-between p-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold">Finalizar Venta</h2>
                    <button onClick=${onClose} class="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors" aria-label="Cerrar">
                        ${ICONS.close}
                    </button>
                </header>

                <div class="flex-grow p-6 overflow-y-auto space-y-6">
                    <div class="text-center">
                        <p class="text-sm text-gray-600">Total a Pagar</p>
                        <p class="text-5xl font-bold text-primary">Bs ${total.toFixed(2)}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                         <${FormInput} label="Monto Recibido" name="monto_recibido" type="number" value=${montoRecibido} onInput=${e => setMontoRecibido(e.target.value)} required=${false} />
                        <div>
                            <label class="block text-sm font-medium leading-6 text-gray-900">Cambio</label>
                            <div class="mt-2 p-2 rounded-md bg-gray-200 text-right h-[42px]">
                                <span class="text-lg font-semibold text-gray-800">Bs ${cambio > 0 ? cambio.toFixed(2) : '0.00'}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">Método de Pago</label>
                        <div class="flex items-center gap-2">
                             <${PaymentButton} icon=${ICONS.payments} label="Efectivo" method="Efectivo" activeMethod=${metodoPago} onClick=${setMetodoPago} />
                             <${PaymentButton} icon=${ICONS.credit_card} label="Tarjeta" method="Tarjeta" activeMethod=${metodoPago} onClick=${setMetodoPago} />
                             <${PaymentButton} icon=${ICONS.qr_code_2} label="QR" method="QR" activeMethod=${metodoPago} onClick=${setMetodoPago} />
                        </div>
                    </div>
                    
                     <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">Tipo de Venta</label>
                        <div class="flex items-center gap-2">
                            <${SaleTypeButton} label="Al Contado" type="Contado" activeType=${tipoVenta} onClick=${setTipoVenta} />
                            <${SaleTypeButton} label="A Crédito" type="Crédito" activeType=${tipoVenta} onClick=${setTipoVenta} disabled=${!clienteId} />
                        </div>
                         ${!clienteId && tipoVenta !== 'Crédito' && html`<p class="text-xs text-gray-500 mt-1">Selecciona un cliente para habilitar la venta a crédito.</p>`}
                    </div>
                    
                    ${tipoVenta === 'Crédito' && html`
                        <div class="animate-fade-in-down">
                            <${FormInput}
                                label="Fecha de Vencimiento"
                                name="fecha_vencimiento"
                                type="date"
                                value=${fechaVencimiento}
                                onInput=${e => setFechaVencimiento(e.target.value)}
                            />
                        </div>
                    `}
                </div>

                <footer class="flex-shrink-0 flex justify-end items-center p-4 bg-gray-100 rounded-b-xl space-x-3 border-t border-gray-200">
                    <button type="button" onClick=${onClose} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancelar</button>
                    <button 
                        type="button" 
                        onClick=${handleConfirm}
                        disabled=${isConfirmDisabled}
                        class="min-w-[150px] flex justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        ${isProcessing ? html`<${Spinner}/>` : 'Confirmar Venta'}
                    </button>
                </footer>
            </div>
        </div>
    `;
}