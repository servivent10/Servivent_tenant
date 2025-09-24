/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export function Tabs({ tabs, activeTab, onTabClick }) {
    return html`
        <div>
            <div class="border-b border-gray-200">
                <nav class="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                    ${tabs.map(tab => {
                        const isActive = tab.id === activeTab;
                        const classes = isActive 
                            ? 'border-primary text-primary' 
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700';

                        return html`
                            <button
                                key=${tab.id}
                                onClick=${() => onTabClick(tab.id)}
                                class="whitespace-nowrap border-b-2 py-4 px-3 text-sm font-medium ${classes}"
                                aria-current=${isActive ? 'page' : undefined}
                            >
                                ${tab.label}
                            </button>
                        `;
                    })}
                </nav>
            </div>
        </div>
    `;
}