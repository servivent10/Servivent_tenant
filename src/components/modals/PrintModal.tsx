/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../Icons.js';

export function PrintModal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    return html`
        <div 
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/75 animate-modal-fade-in" 
            role="dialog" 
            aria-modal="true"
        >
            <div class="fixed inset-0 no-print" onClick=${onClose} aria-hidden="true"></div>
            
            <div class="relative w-full max-w-5xl rounded-xl bg-slate-100 shadow-2xl flex flex-col max-h-[90vh] animate-modal-scale-in">
                <header class="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white rounded-t-xl no-print">
                    <h2 class="text-lg font-semibold text-gray-800">${title}</h2>
                    <div class="flex items-center gap-2">
                        <button onClick=${handlePrint} class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                            ${ICONS.print} Imprimir
                        </button>
                        <button onClick=${onClose} class="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700">
                            ${ICONS.close}
                        </button>
                    </div>
                </header>
                
                <main class="print-modal-body p-4 sm:p-6 flex-grow overflow-y-auto">
                    <div class="print-section">
                        ${children}
                    </div>
                </main>
            </div>
        </div>
    `;
}