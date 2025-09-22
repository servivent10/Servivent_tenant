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
    confirmVariant = 'primary'
}) {
    const [showModal, setShowModal] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setShowModal(true);
            document.body.style.overflow = 'hidden';
        } else {
            // Cuando se solicita cerrar, esperamos a que termine la animación
            // antes de ocultar completamente el componente del DOM.
            const timer = setTimeout(() => {
                setShowModal(false);
                document.body.style.overflow = 'auto';
            }, 200); // Debe coincidir con la duración de la animación de salida

            return () => clearTimeout(timer);
        }

        // Función de limpieza para re-habilitar el scroll si el componente se desmonta inesperadamente
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    const handleClose = () => {
        if (onClose) onClose();
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
            <div class="fixed inset-0 bg-black/60 backdrop-blur-md" aria-hidden="true"></div>
            
            <div class="relative w-full max-w-lg rounded-xl bg-secondary-dark/75 shadow-2xl backdrop-blur-2xl border border-white/20 text-white ${modalAnimation}">
                
                <!-- Header -->
                <div class="flex items-start justify-between p-4 border-b border-white/10">
                    <h2 id="modal-title" class="text-lg font-semibold">${title}</h2>
                    <button onClick=${handleClose} class="p-1 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Cerrar">
                        ${ICONS.close}
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6">
                    <div class="flex items-start">
                        ${icon && html`<div class="flex-shrink-0 mr-4">${icon}</div>`}
                        <div class="flex-1">
                            ${children}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex justify-end items-center p-4 bg-white/5 rounded-b-xl space-x-3">
                    <button 
                        type="button" 
                        onClick=${handleClose} 
                        class="rounded-md bg-transparent px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-gray-400 hover:bg-white/10 transition-colors"
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
            </div>
        </div>
    `;
}
