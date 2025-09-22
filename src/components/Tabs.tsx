/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export function Tabs({ tabs, activeTab, onTabClick }) {
    return html`
        <div>
            <div class="sm:hidden">
                <label for="tabs" class="sr-only">Selecciona una pestaña</label>
                <select 
                    id="tabs" 
                    name="tabs" 
                    class="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                    onChange=${(e) => onTabClick(e.target.value)}
                    value=${activeTab}
                >
                    ${tabs.map(tab => html`
                        <option value=${tab.id} key=${tab.id}>${tab.label}</option>
                    `)}
                </select>
            </div>
            <div class="hidden sm:block">
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        ${tabs.map(tab => {
                            const isActive = tab.id === activeTab;
                            const classes = isActive 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700';

                            return html`
                                <button
                                    key=${tab.id}
                                    onClick=${() => onTabClick(tab.id)}
                                    class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${classes}"
                                    aria-current=${isActive ? 'page' : undefined}
                                >
                                    ${tab.label}
                                </button>
                            `;
                        })}
                    </nav>
                </div>
            </div>
        </div>
    `;
}