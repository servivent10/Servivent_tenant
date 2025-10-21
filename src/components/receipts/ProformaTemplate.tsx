/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { forwardRef } from 'preact/compat';

export const ProformaTemplate = forwardRef((props: any, ref) => {
    const { proformaDetails, companyInfo } = props;
    if (!proformaDetails || !companyInfo) return null;

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        return `${companyInfo.monedaSimbolo} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return html`
        <div ref=${ref} class="nota-venta-container bg-white p-8 font-sans mx-auto">
            <header class="flex justify-between items-start border-b pb-4">
                <div class="flex items-center gap-4">
                    ${companyInfo.logo && html`<img src=${companyInfo.logo} alt="Logo" class="h-20 w-20 object-contain"/>`}
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">${companyInfo.name}</h1>
                        <p class="text-sm text-gray-600">NIT: ${companyInfo.nit}</p>
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-semibold text-gray-700">PROFORMA / COTIZACIÓN</h2>
                    <p class="font-mono text-lg text-red-600">${proformaDetails.folio}</p>
                    <p class="text-sm text-gray-600">Emitida: <span class="font-medium">${new Date(proformaDetails.fecha_emision).toLocaleDateString()}</span></p>
                    <p class="text-sm text-gray-600">Válida hasta: <span class="font-medium">${new Date(proformaDetails.fecha_vencimiento).toLocaleDateString()}</span></p>
                </div>
            </header>

            <section class="mt-6 grid grid-cols-2 gap-8">
                <div>
                    <h3 class="text-sm font-semibold uppercase text-gray-500">Datos del Cliente</h3>
                    <div class="mt-2 text-sm text-gray-800">
                        <p><b>Nombre:</b> ${proformaDetails.cliente_nombre || 'N/A'}</p>
                        <p><b>NIT/CI:</b> ${proformaDetails.cliente_nit_ci || 'N/A'}</p>
                        <p><b>Teléfono:</b> ${proformaDetails.cliente_telefono || 'N/A'}</p>
                    </div>
                </div>
                <div class="text-right">
                     <h3 class="text-sm font-semibold uppercase text-gray-500">Generado por</h3>
                     <div class="mt-2 text-sm text-gray-800">
                        <p>${proformaDetails.usuario_nombre || 'N/A'}</p>
                        <p class="font-semibold">${proformaDetails.sucursal_nombre || 'N/A'}</p>
                        <p>${proformaDetails.sucursal_direccion || ''}</p>
                    </div>
                </div>
            </section>

            <section class="mt-8">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-2 font-semibold text-gray-600">Cant.</th>
                            <th class="p-2 font-semibold text-gray-600">Descripción</th>
                            <th class="p-2 font-semibold text-gray-600 text-right">P. Unitario</th>
                            <th class="p-2 font-semibold text-gray-600 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y text-gray-800">
                        ${proformaDetails.items.map(item => html`
                            <tr>
                                <td class="p-2">${item.cantidad}</td>
                                <td class="p-2">${item.producto_nombre}</td>
                                <td class="p-2 text-right">${formatCurrency(item.precio_unitario_aplicado)}</td>
                                <td class="p-2 text-right">${formatCurrency(item.cantidad * item.precio_unitario_aplicado)}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </section>
            
            <section class="mt-8 grid grid-cols-2 gap-8">
                 <div class="text-sm text-gray-600">
                    ${proformaDetails.notas && html`
                        <h3 class="font-semibold uppercase text-gray-500">Términos y Condiciones</h3>
                        <p class="mt-2 whitespace-pre-wrap">${proformaDetails.notas}</p>
                    `}
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-600">Subtotal:</span><span class="font-medium text-gray-800">${formatCurrency(proformaDetails.subtotal)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Descuento:</span><span class="font-medium text-red-600">- ${formatCurrency(proformaDetails.descuento)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Impuestos:</span><span class="font-medium text-gray-800">${formatCurrency(proformaDetails.impuestos)}</span></div>
                    <div class="flex justify-between text-lg font-bold text-gray-900 border-t pt-2 mt-2"><span>TOTAL:</span><span>${formatCurrency(proformaDetails.total)}</span></div>
                </div>
            </section>

            <footer class="mt-16 text-center text-xs text-gray-500 border-t pt-4">
                <p>Esta es una cotización y no representa un compromiso de venta. Los precios y la disponibilidad de stock están sujetos a cambios.</p>
            </footer>
        </div>
    `;
});