/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { ICONS } from './Icons.js';

const toastStyles = {
    success: {
        borderColor: 'border-green-500',
        icon: ICONS.success,
    },
    error: {
        borderColor: 'border-red-500',
        icon: ICONS.error,
    },
    warning: {
        borderColor: 'border-yellow-500',
        icon: ICONS.warning,
    },
    info: {
        borderColor: 'border-blue-500',
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
        <div class="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden border-l-4 ${animationClasses} ${styles.borderColor}">
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        ${styles.icon}
                    </div>
                    <div class="ml-3 w-0 flex-1 pt-0.5">
                        <p class="text-sm font-medium text-gray-900" dangerouslySetInnerHTML=${{ __html: message }}></p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button onClick=${handleDismiss} class="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark">
                            <span class="sr-only">Cerrar</span>
                            ${ICONS.close}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};