/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { forwardRef } from 'preact/compat';

// FIX: Correctly access props in a forwardRef component by taking `props` as the first argument and then destructuring.
// FIX: Added 'any' type to props to resolve TypeScript inference error.
export const NotaVentaTemplate = forwardRef((props: any, ref) => {
    const { saleDetails, companyInfo } = props;
    if (!saleDetails || !companyInfo) return null;

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        return `${companyInfo.monedaSimbolo} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'Pagada': return `${baseClasses} bg-green-100 text-green-800`;
            case 'Pendiente': return `${baseClasses} bg-red-100 text-red-800`;
            case 'Abono Parcial': return `${baseClasses} bg-amber-100 text-amber-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
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
                    <h2 class="text-xl font-semibold text-gray-700">NOTA DE VENTA</h2>
                    <p class="font-mono text-lg text-red-600">${saleDetails.folio}</p>
                    <p class="text-sm text-gray-600">Fecha: <span class="font-medium">${new Date(saleDetails.fecha).toLocaleDateString()}</span></p>
                </div>
            </header>

            <section class="mt-6 grid grid-cols-2 gap-8">
                <div>
                    <h3 class="text-sm font-semibold uppercase text-gray-500">Datos del Cliente</h3>
                    <div class="mt-2 text-sm text-gray-800">
                        <p><b>Nombre:</b> ${saleDetails.cliente_nombre || 'Consumidor Final'}</p>
                        <p><b>NIT/CI:</b> ${saleDetails.cliente_nit_ci || 'N/A'}</p>
                        <p><b>Teléfono:</b> ${saleDetails.cliente_telefono || 'N/A'}</p>
                    </div>
                </div>
                <div class="text-right">
                     <h3 class="text-sm font-semibold uppercase text-gray-500">Atendido por</h3>
                     <div class="mt-2 text-sm text-gray-800">
                        <p>${saleDetails.usuario_nombre || 'N/A'}</p>
                        <p class="font-semibold">${saleDetails.sucursal_nombre || 'N/A'}</p>
                        <p>${saleDetails.sucursal_direccion || ''}</p>
                        <p>${saleDetails.sucursal_telefono || ''}</p>
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
                        ${saleDetails.items.map(item => html`
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
                 <div>
                    <h3 class="text-sm font-semibold uppercase text-gray-500">Historial de Pagos</h3>
                    <table class="w-full text-left text-sm mt-2">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="p-2 font-semibold text-gray-600">Fecha</th>
                                <th class="p-2 font-semibold text-gray-600">Método</th>
                                <th class="p-2 font-semibold text-gray-600 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y text-gray-800">
                            ${saleDetails.pagos.map(pago => html`
                                <tr>
                                    <td class="p-2">${new Date(pago.fecha_pago).toLocaleDateString()}</td>
                                    <td class="p-2">${pago.metodo_pago}</td>
                                    <td class="p-2 text-right">${formatCurrency(pago.monto)}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-600">Subtotal:</span><span class="font-medium text-gray-800">${formatCurrency(saleDetails.subtotal)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Descuento:</span><span class="font-medium text-red-600">- ${formatCurrency(saleDetails.descuento)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Impuestos:</span><span class="font-medium text-gray-800">${formatCurrency(saleDetails.impuestos)}</span></div>
                    <div class="flex justify-between text-lg font-bold text-gray-900 border-t pt-2 mt-2"><span>TOTAL:</span><span>${formatCurrency(saleDetails.total)}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-gray-600">Estado:</span><span class=${getStatusPill(saleDetails.estado_pago)}>${saleDetails.estado_pago}</span></div>
                    ${saleDetails.saldo_pendiente > 0 && html`
                        <div class="flex justify-between text-base font-bold text-red-600 border-t pt-2"><span>SALDO PENDIENTE:</span><span>${formatCurrency(saleDetails.saldo_pendiente)}</span></div>
                    `}
                </div>
            </section>

            <footer class="mt-24 text-center text-xs text-gray-500 border-t pt-4">
                <p>Gracias por su compra. Este documento no es una factura y no tiene validez fiscal.</p>
                <div class="mt-12 flex justify-around">
                    <div class="w-1/3 border-t pt-2">
                        <p>Entregue Conforme</p>
                    </div>
                     <div class="w-1/3 border-t pt-2">
                        <p>Recibí Conforme</p>
                    </div>
                </div>
            </footer>
        </div>
    `;
});