/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

// A simple utility to get a color from a predefined list
const COLORS = ['#2563eb', '#10b981', '#f97316', '#ec4899'];
const getColor = (index) => COLORS[index % COLORS.length];

export function ComparativeBarChart({ data, keys }) {
    const [tooltip, setTooltip] = useState(null);

    if (!data || data.length === 0) {
        return html`<div class="flex items-center justify-center h-72 text-gray-500">No hay datos comparativos para mostrar.</div>`;
    }

    const maxValue = Math.max(...data.flatMap(d => keys.map(k => d[k.key])), 1);
    
    const yAxisLabels = [...Array(5)].map((_, i) => {
        const value = (maxValue / 4) * i;
        // Simple formatting for axis labels
        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
        return value.toFixed(0);
    }).reverse();

    const handleMouseOver = (e, datum, keyInfo) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            label: datum.label,
            key: keyInfo.label,
            value: datum[keyInfo.key],
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width
        });
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };
    
    const formatCurrency = (value) => `Bs ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return html`
        <div class="relative">
            <div class="flex h-72 p-4">
                <div class="flex flex-col justify-between text-xs text-gray-500 pr-2">
                    ${yAxisLabels.map(label => html`<span class="relative -top-2">${label}</span>`)}
                </div>
                <div class=${`flex-grow grid grid-cols-${data.length} gap-2 border-l border-gray-200 pl-2`}>
                    ${data.map(item => html`
                        <div class="flex flex-col items-center justify-end">
                            <div class="w-full flex-grow flex items-end justify-center gap-1">
                                ${keys.map((keyInfo, index) => {
                                    const barHeight = (item[keyInfo.key] / maxValue) * 100;
                                    return html`
                                        <div 
                                            class="w-full rounded-t-sm transition-opacity hover:opacity-80" 
                                            style=${{ height: `${barHeight}%`, backgroundColor: getColor(index) }}
                                            onMouseOver=${(e) => handleMouseOver(e, item, keyInfo)}
                                            onMouseOut=${handleMouseOut}
                                        ></div>
                                    `;
                                })}
                            </div>
                            <div class="text-xs text-gray-600 mt-2 whitespace-nowrap truncate" title=${item.label}>${item.label}</div>
                        </div>
                    `)}
                </div>
            </div>
             <div class="flex justify-center items-center gap-4 mt-2 text-xs">
                ${keys.map((keyInfo, index) => html`
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-3 rounded-sm" style=${{ backgroundColor: getColor(index) }}></div>
                        <span class="text-gray-600">${keyInfo.label}</span>
                    </div>
                `)}
            </div>
            ${tooltip && html`
                <div 
                    class="absolute z-10 p-2 text-xs text-white bg-gray-800 rounded-md shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style=${{ left: `${tooltip.x + (tooltip.width / 2)}px`, top: `${tooltip.y - 8}px` }}
                >
                    <div class="font-bold">${tooltip.label}</div>
                    <div>${tooltip.key}: ${formatCurrency(tooltip.value)}</div>
                </div>
            `}
        </div>
    `;
}
