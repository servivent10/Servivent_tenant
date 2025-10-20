/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { forwardRef } from 'preact/compat';

// FIX: Correctly access props in a forwardRef component by taking `props` as the first argument and then destructuring.
// FIX: Added 'any' type to props to resolve TypeScript inference error.
export const TicketTemplate = forwardRef((props: any, ref) => {
    const { saleDetails, companyInfo } = props;
    if (!saleDetails || !companyInfo) return null;
    
    const formatCurrency = (value) => {
        const number = Number(value || 0);
        return `${companyInfo.monedaSimbolo} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return html`
        <div ref=${ref} class="ticket-container bg-white text-black p-2 font-mono mx-auto">
            <header class="text-center text-black">
                ${companyInfo.logo && html`<img src=${companyInfo.logo} alt="Logo" class="h-16 w-16 object-contain mx-auto mb-2"/>`}
                <h1 class="font-bold text-lg">${companyInfo.name}</h1>
                <p class="text-xs">NIT: ${companyInfo.nit}</p>
                <p class="text-xs">Fecha: ${new Date(saleDetails.fecha).toLocaleString()}</p>
                <p class="text-xs">Folio: ${saleDetails.folio}</p>
            </header>

            <section class="mt-4 border-t border-dashed border-black pt-2 text-black">
                <h2 class="text-sm font-semibold uppercase">CLIENTE</h2>
                <p class="text-xs"><b>Nombre:</b> ${saleDetails.cliente_nombre || 'Consumidor Final'}</p>
                <p class="text-xs"><b>NIT/CI:</b> ${saleDetails.cliente_nit_ci || 'N/A'}</p>
                <p class="text-xs"><b>Teléfono:</b> ${saleDetails.cliente_telefono || 'N/A'}</p>
            </section>
            
            <section class="mt-4 border-t border-dashed border-black pt-2 text-black">
                <table class="w-full text-xs text-black">
                    <thead>
                        <tr class="border-b border-dashed border-black">
                            <th class="py-1 text-left">CANT</th>
                            <th class="py-1 text-left">DESCRIPCIÓN</th>
                            <th class="py-1 text-right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${saleDetails.items.map(item => html`
                            <tr>
                                <td class="py-1 align-top">${item.cantidad}</td>
                                <td class="py-1">${item.producto_nombre}</td>
                                <td class="py-1 text-right align-top">${(item.cantidad * item.precio_unitario_aplicado).toFixed(2)}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </section>
            
             <section class="mt-4 border-t border-dashed border-black pt-2 text-xs">
                <div class="flex justify-between text-black"><span>Subtotal:</span><span>${formatCurrency(saleDetails.subtotal)}</span></div>
                <div class="flex justify-between text-black"><span>Descuento:</span><span>- ${formatCurrency(saleDetails.descuento)}</span></div>
                <div class="flex justify-between text-black"><span>Impuesto:</span><span>${formatCurrency(saleDetails.impuestos)}</span></div>
                <div class="flex justify-between mt-2 pt-2 border-t border-dashed border-black font-bold text-sm text-black">
                    <span>TOTAL A PAGAR:</span>
                    <span>${formatCurrency(saleDetails.total)}</span>
                </div>
            </section>
            
            <footer class="mt-6 text-center text-xs border-t border-dashed border-black pt-2">
                <p class="text-black">¡Gracias por su compra!</p>
                <p class="text-black">Este documento no es una factura.</p>
            </footer>
        </div>
    `;
});