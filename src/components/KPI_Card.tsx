/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export function KPI_Card({ title, value, icon, subtext, color = 'primary' }) {
    const colorClasses = {
        primary: 'bg-primary-light text-primary',
        green: 'bg-emerald-100 text-emerald-600',
        amber: 'bg-amber-100 text-amber-600',
        red: 'bg-red-100 text-red-600',
    };
    
    const valueColorClasses = {
        primary: 'text-gray-900',
        green: 'text-emerald-800',
        amber: 'text-amber-800',
        red: 'text-red-800',
    };

    return html`
        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200/80">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-500 truncate">${title}</p>
                    <div class="mt-1">
                        <p class="text-3xl font-bold ${valueColorClasses[color]}">${value}</p>
                    </div>
                </div>
                <div class="flex-shrink-0 ml-2">
                    <div class="flex items-center justify-center h-12 w-12 rounded-lg ${colorClasses[color]}">
                        ${icon}
                    </div>
                </div>
            </div>
            ${subtext && html`
                <div class="mt-2 text-sm text-gray-500">
                    ${subtext}
                </div>
            `}
        </div>
    `;
}