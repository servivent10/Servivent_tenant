/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export function BarChart({ data }) {
    if (!data || data.length === 0) {
        return html`<div class="flex items-center justify-center h-64 text-gray-500">No hay datos para mostrar.</div>`;
    }

    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero
    const yAxisLabels = [...Array(5)].map((_, i) => {
        const value = (maxValue / 4) * i;
        return value.toLocaleString('es-BO', { maximumFractionDigits: 0 });
    }).reverse();


    return html`
        <div class="flex h-72 p-4">
            <div class="flex flex-col justify-between text-xs text-gray-500 pr-2">
                ${yAxisLabels.map(label => html`<span class="relative -top-2">${label}</span>`)}
            </div>
            <div class="flex-grow grid grid-cols-7 gap-2 border-l border-gray-200 pl-2">
                ${data.map(item => {
                    const barHeight = (item.value / maxValue) * 100;
                    const formattedValue = `Bs ${item.value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    
                    return html`
                        <div class="flex flex-col items-center justify-end group">
                            <div 
                                class="w-full bg-primary-light rounded-t-md hover:bg-primary transition-colors" 
                                style=${{ height: `${barHeight}%` }}
                                title=${`${item.label}: ${formattedValue}`}
                            >
                            </div>
                            <div class="text-xs text-gray-600 mt-2 whitespace-nowrap">${item.label}</div>
                        </div>
                    `;
                })}
            </div>
        </div>
    `;
}
