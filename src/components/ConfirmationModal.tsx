/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ICONS } from './Icons.js';

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    icon = null,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmVariant = 'primary',
    maxWidthClass = 'max-w-lg',
    isProcessing = false,
    customFooter = null
}) {
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

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    const handleClose = () => {
        if (onClose && !isProcessing) onClose();
    };

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (!showModal) {
        return null;
    }
    
    const overlayAnimation = isOpen ? 'animate-modal-fade-in' : 'animate-modal-fade-out';
    const modalAnimation = isOpen ? 'animate-modal-scale-in' : 'animate-modal-scale-out';

    const confirmButtonClasses = {
        primary: 'bg-primary hover:bg-primary-hover focus-visible:outline-primary',
        danger: 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600',
    };

    return html`
        <div 
            class="fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayAnimation}" 
            onClick=${handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            
            <div class="relative w-full ${maxWidthClass} rounded-xl bg-white text-gray-900 shadow-2xl ${modalAnimation} flex flex-col max-h-[90vh]">
                
                <div class="flex-shrink-0 flex items-start justify-between p-4 border-b border-gray-200">
                    <h2 id="modal-title" class="text-lg font-semibold">${title}</h2>
                    <button onClick=${handleClose} class="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors" aria-label="Cerrar" disabled=${isProcessing}>
                        ${ICONS.close}
                    </button>
                </div>

                <div class="flex-grow p-6 overflow-y-auto">
                    <div class="flex items-start">
                        ${!isProcessing && icon && html`<div class="flex-shrink-0 mr-4">${icon}</div>`}
                        <div class="flex-1">
                            ${children}
                        </div>
                    </div>
                </div>

                ${customFooter ? customFooter : !isProcessing && html`
                    <div class="flex-shrink-0 flex justify-end items-center p-4 bg-gray-50 rounded-b-xl space-x-3 border-t border-gray-200">
                        <button 
                            type="button" 
                            onClick=${handleClose} 
                            class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            ${cancelText}
                        </button>
                        <button 
                            type="button" 
                            onClick=${handleConfirm} 
                            class="rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors ${confirmButtonClasses[confirmVariant] || confirmButtonClasses.primary}"
                        >
                            ${confirmText}
                        </button>
                    </div>
                 `}
            </div>
        </div>
    `;
}