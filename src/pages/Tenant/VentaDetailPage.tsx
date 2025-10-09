/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';


export function VentaDetailPage({ ventaId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [venta, setVenta] = useState(null);
    const { isLoading, startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_sale_details', { p_venta_id: ventaId });
            if (error) throw error;
            setVenta(data);
        } catch(err) {
            addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
            navigate('/ventas');
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, [ventaId]);

    const breadcrumbs = [
        { name: 'Ventas', href: '#/ventas' },
        { name: venta ? `Detalle Venta ${venta.folio}` : 'Cargando...', href: `#/ventas/${ventaId}` }
    ];

    const PaymentManager = ({ ventaData }) => {
        const [montoAbono, setMontoAbono] = useState('');
        const [metodoAbono, setMetodoAbono] = useState('Efectivo');
        const [isSaving, setIsSaving] = useState(false);
        
        const handleAddPayment = async () => {
            const monto = Number(montoAbono);
            if (!monto || monto <= 0) {
                addToast({ message: 'Por favor, introduce un monto válido.', type: 'error' });
                return;
            }
            if (monto > Number(ventaData.saldo_pendiente)) {
                addToast({ message: 'El abono no puede ser mayor que el saldo pendiente.', type: 'error' });
                return;
            }

            setIsSaving(true);
            try {
                const { error } = await supabase.rpc('registrar_pago_venta', {
                    p_venta_id: ventaData.id,
                    p_monto: monto,
                    p_metodo_pago: metodoAbono
                });
                if (error) throw error;
                addToast({ message: 'Abono registrado con éxito.', type: 'success' });
                setMontoAbono('');
                fetchData(); // Recargar los datos de la venta
            } catch(err) {
                addToast({ message: `Error al registrar el abono: ${err.message}`, type: 'error' });
            } finally {
                setIsSaving(false);
            }
        };

        return html`
            <div class="bg-white p-6 rounded-lg shadow-md border">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">${ICONS.payments} Gestión de Pagos</h3>
                <dl class="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div class="bg-slate-50 p-3 rounded-md"><dt class="text-gray-500">Monto Total</dt><dd class="font-bold text-lg text-gray-900">${formatCurrency(ventaData.total)}</dd></div>
                    <div class="bg-slate-50 p-3 rounded-md"><dt class="text-gray-500">Monto Pagado</dt><dd class="font-bold text-lg text-green-600">${formatCurrency(Number(ventaData.total) - Number(ventaData.saldo_pendiente))}</dd></div>
                    ${ventaData.estado_pago !== 'Pagada' && html`
                        <div class="bg-red-50 p-3 rounded-md col-span-2"><dt class="text-red-800 font-semibold">Saldo Pendiente</dt><dd class="font-bold text-2xl text-red-600">${formatCurrency(ventaData.saldo_pendiente)}</dd></div>
                    `}
                </dl>

                <div class="mt-6">
                    <h4 class="font-semibold text-gray-700">Historial de Pagos</h4>
                    <ul class="mt-2 divide-y divide-gray-200 border-t border-b max-h-48 overflow-y-auto">
                        ${ventaData.pagos.map(p => html`
                            <li class="flex justify-between items-center py-2 text-sm">
                                <div>
                                    <p class="font-medium text-gray-800">${p.metodo_pago}</p>
                                    <p class="text-xs text-gray-500">${new Date(p.fecha_pago).toLocaleString()}</p>
                                </div>
                                <p class="font-semibold text-green-700">${formatCurrency(p.monto)}</p>
                            </li>
                        `)}
                        ${ventaData.pagos.length === 0 && html`<li class="py-3 text-sm text-center text-gray-500">No se han registrado pagos.</li>`}
                    </ul>
                </div>
                
                ${ventaData.estado_pago !== 'Pagada' && html`
                    <div class="mt-6">
                        <h4 class="font-semibold text-gray-700">Registrar Nuevo Abono</h4>
                         <div class="mt-2 grid grid-cols-3 gap-2">
                            <button onClick=${() => setMetodoAbono('Efectivo')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'Efectivo' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.payments} Efectivo</button>
                            <button onClick=${() => setMetodoAbono('QR')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'QR' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.qr_code_2} QR</button>
                            <button onClick=${() => setMetodoAbono('Transferencia Bancaria')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'Transferencia Bancaria' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.currency_exchange} Transf.</button>
                        </div>
                        <div class="mt-2 flex items-center gap-2">
                            <div class="flex-grow"><${FormInput} label="" name="abono" type="number" value=${montoAbono} onInput=${(e) => setMontoAbono(e.target.value)} placeholder="Monto a abonar" required=${false} /></div>
                            <button onClick=${handleAddPayment} disabled=${isSaving} class="flex-shrink-0 mt-2 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                                ${isSaving ? html`<${Spinner}/>` : 'Abonar'}
                            </button>
                        </div>
                    </div>
                `}
            </div>
        `;
    };
    
    const renderContent = () => {
        if (isLoading && !venta) {
            return html`<div class="py-20"></div>`; // Placeholder to prevent layout jump
        }

        if (!venta) {
            return html`
                <div class="text-center py-10">
                    <h2 class="text-xl font-semibold text-red-600">Venta no encontrada</h2>
                    <p class="text-gray-600 mt-2">No se pudo encontrar la venta solicitada o no tienes permiso para verla.</p>
                    <button onClick=${() => navigate('/ventas')} class="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Volver a Ventas</button>
                </div>
            `;
        }

        return html`
            <div class="flex items-center gap-4 mb-4">
                <button onClick=${() => navigate('/ventas')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver a Ventas">
                    ${ICONS.arrow_back}
                </button>
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">Detalle de Venta: ${venta.folio}</h1>
                    <p class="text-sm text-gray-500">Cliente: ${venta.cliente_nombre || 'Consumidor Final'}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-white p-6 rounded-lg shadow-md border">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Detalles Generales</h3>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt class="text-gray-500">Fecha de Venta</dt><dd class="font-medium text-gray-800">${new Date(venta.fecha).toLocaleString()}</dd></div>
                            <div><dt class="text-gray-500">Vendedor</dt><dd class="font-medium text-gray-800">${venta.usuario_nombre || 'N/A'}</dd></div>
                            <div><dt class="text-gray-500">Tipo de Venta</dt><dd class="font-medium text-gray-800">${venta.tipo_venta}</dd></div>
                            <div><dt class="text-gray-500">Método de Pago</dt><dd class="font-medium text-gray-800">${venta.metodo_pago}</dd></div>
                            ${venta.fecha_vencimiento && html`<div><dt class="text-gray-500">Vencimiento</dt><dd class="font-medium text-red-600">${new Date(venta.fecha_vencimiento).toLocaleDateString()}</dd></div>`}
                        </dl>
                    </div>
                    <div class="bg-white rounded-lg shadow-md border">
                        <h3 class="text-lg font-semibold text-gray-800 p-6 pb-2">Productos Vendidos</h3>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${venta.items.map(item => html`
                                        <tr>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.producto_nombre}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${item.cantidad}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatCurrency(item.precio_unitario_aplicado)}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800">${formatCurrency(Number(item.cantidad) * Number(item.precio_unitario_aplicado))}</td>
                                        </tr>
                                    `)}
                                </tbody>
                                <tfoot class="bg-gray-50">
                                    <tr>
                                        <td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Subtotal</td>
                                        <td class="px-6 py-2 text-right text-sm font-semibold text-gray-800">${formatCurrency(venta.subtotal)}</td>
                                    </tr>
                                     <tr>
                                        <td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Descuento</td>
                                        <td class="px-6 py-2 text-right text-sm font-semibold text-red-600">- ${formatCurrency(venta.descuento)}</td>
                                    </tr>
                                     <tr>
                                        <td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Impuestos</td>
                                        <td class="px-6 py-2 text-right text-sm font-semibold text-gray-800">+ ${formatCurrency(venta.impuestos)}</td>
                                    </tr>
                                     <tr>
                                        <td colspan="3" class="px-6 py-3 text-right text-base font-bold text-gray-900 border-t-2">TOTAL</td>
                                        <td class="px-6 py-3 text-right text-base font-bold text-primary border-t-2">${formatCurrency(venta.total)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-1">
                    <${PaymentManager} ventaData=${venta} />
                </div>
            </div>
        `;
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Ventas"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            ${renderContent()}
        <//>
    `;
}