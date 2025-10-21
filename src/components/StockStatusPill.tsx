/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export const StockStatusPill = ({ stock, minStock = 0 }) => {
    let pillClass, text;
    const stockNum = Number(stock || 0);
    const minStockNum = Number(minStock || 0);

    if (stockNum <= 0) {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    } else if (stockNum <= minStockNum) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Bajo Stock';
    } else {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">${text} (${stockNum})</span>`;
};