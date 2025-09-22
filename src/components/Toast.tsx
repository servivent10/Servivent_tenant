/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { ICONS } from './Icons.js';

const toastStyles = {
    success: {
        container: 'bg-green-600/50 backdrop-blur-xl border border-green-500/80',
        text: 'text-green-50',
        closeButton: 'text-green-200 hover:text-white',
        icon: ICONS.success,
    },
    error: {
        container: 'bg-red-600/50 backdrop-blur-xl border border-red-500/80',
        text: 'text-red-50',
        closeButton: 'text-red-200 hover:text-white',
        icon: ICONS.error,
    },
    warning: {
        container: 'bg-yellow-500/50 backdrop-blur-xl border border-yellow-400/80',
        text: 'text-yellow-50',
        closeButton: 'text-yellow-200 hover:text-white',
        icon: ICONS.warning,
    },
    info: {
        container: 'bg-blue-600/50 backdrop-blur-xl border border-blue-500/80',
        text: 'text-blue-50',
        closeButton: 'text-blue-200 hover:text-white',
        icon: ICONS.info,
    },
};


export const Toast = ({ toast, onDismiss }) => {
    const { message, type = 'info', duration = 5000 } = toast;
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (duration === Infinity) return;

        const timer = setTimeout(() => {
            handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onDismiss]);
    
    const handleDismiss = () => {
        setIsExiting(true);
        // Esperar a que la animación de salida termine antes de llamar a onDismiss
        setTimeout(onDismiss, 300); 
    };

    const animationClasses = isExiting ? 'animate-toast-out' : 'animate-toast-in';
    const styles = toastStyles[type] || toastStyles.info;

    return html`
        <div class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden ${animationClasses} ${styles.container}">
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        ${styles.icon}
                    </div>
                    <div class="ml-3 w-0 flex-1 pt-0.5">
                        <p class="text-sm font-medium ${styles.text}">${message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button onClick=${handleDismiss} class="rounded-md inline-flex focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 ${styles.closeButton}">
                            <span class="sr-only">Cerrar</span>
                            ${ICONS.close}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};