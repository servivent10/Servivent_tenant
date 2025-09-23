/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ServiVentLogo } from './Logo.js';
import { Spinner } from './Spinner.js';
import { ICONS } from './Icons.js';

const AnimatedServiVentLogo = () => {
    // Se cambia a `inline-flex` para que el logo pueda ser centrado
    // por la propiedad `text-center` de su contenedor padre.
    return html`
        <${ServiVentLogo} className="inline-flex h-12 w-auto" textColor="text-white" accentColor="text-primary-light animate-pulse-opacity" />
    `;
};

const StatusIndicator = ({ status }) => {
    if (status === 'loading') {
        return html`<${Spinner} size="h-5 w-5" color="text-gray-300" />`;
    }
    if (status === 'success') {
        return html`<div class="text-emerald-400">${ICONS.success}</div>`;
    }
    if (status === 'error') {
        return html`<div class="text-red-400">${ICONS.error}</div>`;
    }
    return null;
};

export function LoadingPage({ onForceLogout, steps = [] }) {
    const [showForceButton, setShowForceButton] = useState(false);

    useEffect(() => {
        const forceButtonTimeout = setTimeout(() => {
            setShowForceButton(true);
        }, 10000);

        return () => clearTimeout(forceButtonTimeout);
    }, []);
    
    const visibleSteps = steps.filter(step => step.status !== 'pending');

    return html`
        <div class="relative flex min-h-full w-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
             <div class="absolute inset-0 -z-20">
                <img class="h-full w-full object-cover" src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2830&q=80" alt="Team working" />
                <div class="absolute inset-0 bg-secondary-dark/70"></div>
            </div>

            <div class="w-full max-w-md rounded-xl bg-black/20 shadow-2xl backdrop-blur-lg text-center overflow-hidden">
                <div class="relative py-6 bg-black/10 overflow-hidden">
                    <${AnimatedServiVentLogo} />
                    <div class="shine-effect"></div>
                </div>
                
                <div class="p-8 pt-4 space-y-6">
                    <div class="text-left space-y-3 min-h-[6rem]">
                        ${visibleSteps.map(step => html`
                            <div key=${step.key} class="flex items-center justify-between text-gray-200 text-sm animate-fade-in-down">
                                <span>${step.label}...</span>
                                <${StatusIndicator} status=${step.status} />
                            </div>
                        `)}
                    </div>

                    <div class="pt-4">
                        ${showForceButton && html`
                            <button 
                                onClick=${onForceLogout} 
                                class="text-sm text-gray-300 hover:text-primary-light underline transition-opacity duration-300 animate-pulse-opacity"
                            >
                                ¿Tarda más de lo esperado? Haz clic aquí.
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}