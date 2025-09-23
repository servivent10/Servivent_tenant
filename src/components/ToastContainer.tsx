/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useToast } from '../hooks/useToast.js';
import { Toast } from './Toast.js';

export const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    return html`
        <div 
            aria-live="assertive" 
            class="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:items-start sm:p-6 sm:pt-20 z-50"
        >
            <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
                ${toasts.map(toast => html`
                    <${Toast}
                        key=${toast.id}
                        toast=${toast}
                        onDismiss=${() => removeToast(toast.id)}
                    />
                `)}
            </div>
        </div>
    `;
};