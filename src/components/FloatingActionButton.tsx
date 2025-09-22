/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from './Icons.js';

export function FloatingActionButton({ onClick, children = ICONS.add, label = 'Añadir' }) {
    return html`
        <button
            type="button"
            onClick=${onClick}
            class="fixed bottom-6 right-6 z-30 inline-flex items-center gap-x-2 rounded-full bg-primary p-4 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label=${label}
        >
            ${children}
        </button>
    `;
}