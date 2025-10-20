/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';
import { PrintModal } from '../../components/modals/PrintModal.tsx';
import { NotaVentaTemplate } from '../../components/receipts/NotaVentaTemplate.js';
import { TicketTemplate } from '../../components/receipts/TicketTemplate.js';
import { generatePdfFromComponent } from '../../lib/pdfGenerator.js';


export function VentaDetailPage({ ventaId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [venta, setVenta] = useState(null);
    const { isLoading, startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();

    const [printModalState, setPrintModalState] = useState({ isOpen: false, title: '', content: null });
    const [receiptForPdf, setReceiptForPdf] = useState(null);
    const receiptRef = useRef(null);

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

    useEffect(() => {
        if (receiptForPdf && receiptRef.current) {
            const { format } = receiptForPdf;
            const fileName = `${format === 'nota' ? 'NotaVenta' : 'Ticket'}-${venta.folio}.pdf`;
            generatePdfFromComponent(receiptRef.current, fileName, format === 'nota' ? 'a4' : 'ticket')
                .then(() => addToast({ message: 'Descarga iniciada.', type: 'success' }))
                .catch(err => addToast({ message: `Error al generar PDF: ${err.message}`, type: 'error' }))
                .finally(() => setReceiptForPdf(null));
        }
    }, [receiptForPdf, venta]);


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
                
                ${ventaData.estado_pago !== 'Pagada' && ventaData.estado_pago !== 'Pedido Web Pendiente' && html`
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
            return html`<div class="py-20"></div>`; // Placeholder to prevent layout jump while loading
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
        
        const isWebOrder = venta.metodo_pago === 'Pedido Web' || venta.estado_pago === 'Pedido Web Pendiente';
        const isDelivery = isWebOrder && venta.direccion_entrega_id;
        const isPickup = isWebOrder && !venta.sucursal_id;

        const diasVencidos = Math.abs(venta.dias_diferencia);
        const mensajeVencimiento = diasVencidos === 1 ? '1 día' : `${diasVencidos} días`;

        return html`
            <div class="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                <div class="flex items-center gap-4">
                    <button onClick=${() => navigate('/ventas')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver a Ventas">
                        ${ICONS.arrow_back}
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Detalle de Venta: ${venta.folio}</h1>
                        <p class="text-sm text-gray-500">Cliente: ${venta.cliente_nombre || 'Consumidor Final'}</p>
                    </div>
                </div>
                <div class="relative group flex-shrink-0">
                    <button class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600">
                        ${ICONS.print} Recibo / Comprobante ${ICONS.chevron_down}
                    </button>
                    <div class="absolute right-0 top-full w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10 hidden group-hover:block group-focus-within:block">
                        <div class="py-1">
                            <button onClick=${() => setPrintModalState({ isOpen: true, title: 'Previsualizar Nota de Venta', content: 'nota'})} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100">Imprimir Nota de Venta</button>
                            <button onClick=${() => setPrintModalState({ isOpen: true, title: 'Previsualizar Ticket', content: 'ticket'})} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100">Imprimir Ticket</button>
                            <div class="border-t my-1"></div>
                            <button onClick=${() => setReceiptForPdf({ format: 'nota' })} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100">Descargar Nota (PDF)</button>
                            <button onClick=${() => setReceiptForPdf({ format: 'ticket' })} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100">Descargar Ticket (PDF)</button>
                        </div>
                    </div>
                </div>
            </div>

            ${venta.estado_vencimiento === 'Vencida' && html`
                <div class="mb-6 p-4 rounded-md bg-red-50 text-red-800 border border-red-200 flex items-start gap-3" role="alert">
                    <div class="text-2xl flex-shrink-0 mt-0.5">${ICONS.warning}</div>
                    <div>
                        <h3 class="font-bold">Venta Vencida</h3>
                        <p class="text-sm">Esta venta tiene un retraso de ${mensajeVencimiento}.</p>
                    </div>
                </div>
            `}

            ${venta.estado_pago === 'Pedido Web Pendiente' && html`
                <div class="mb-6 p-4 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" role="alert">
                    <div class="flex items-start gap-3">
                        <div class="text-2xl flex-shrink-0 mt-0.5">${ICONS.bolt}</div>
                        <div>
                            <h3 class="font-bold">Este es un Pedido Web Pendiente</h3>
                            <p class="text-sm">Verifica el stock y los detalles, luego procede a finalizar la venta en el Terminal o registrar el pago.</p>
                        </div>
                    </div>
                    <button onClick=${() => addToast({ message: 'Funcionalidad no implementada.'})} class="mt-2 sm:mt-0 flex-shrink-0 w-full sm:w-auto rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600">
                        Finalizar Venta
                    </button>
                </div>
            `}

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-white p-6 rounded-lg shadow-md border">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Detalles Generales</h3>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt class="text-gray-500">Fecha de Venta</dt><dd class="font-medium text-gray-800">${new Date(venta.fecha).toLocaleString()}</dd></div>
                             <div><dt class="text-gray-500">Vendedor</dt><dd class="font-medium text-gray-800">${venta.usuario_nombre || 'N/A'}</dd></div>
                            <div><dt class="text-gray-500">Tipo de Venta</dt><dd class="font-medium text-gray-800">${venta.tipo_venta}</dd></div>
                            <div><dt class="text-gray-500">Método de Pago</dt><dd class="font-medium text-gray-800">${venta.metodo_pago}</dd></div>
                            ${venta.fecha_vencimiento && html`<div><dt class="text-gray-500">Vencimiento</dt><dd class="font-medium text-red-600">${new Date(venta.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })}</dd></div>`}
                        </dl>
                    </div>

                    ${isDelivery && venta.direccion_entrega && html`
                        <div class="bg-white p-6 rounded-lg shadow-md border animate-fade-in-down">
                            <h3 class="text-lg font-semibold text-gray-800 mb-2">Dirección de Envío</h3>
                            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="text-gray-500">Lugar</dt><dd class="font-medium text-gray-800">${venta.direccion_entrega.nombre}</dd></div>
                                <div><dt class="text-gray-500">Detalles</dt><dd class="font-medium text-gray-800">${venta.direccion_entrega.direccion_texto}</dd></div>
                            </dl>
                             <div class="mt-4 pt-4 border-t">
                                <a href=${`https://maps.google.com/?q=${venta.direccion_entrega.latitud},${venta.direccion_entrega.longitud}`} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-200">
                                    ${ICONS.suppliers} Ver en Google Maps
                                </a>
                            </div>
                        </div>
                    `}
                    
                    ${isPickup && html`
                        <div class="bg-white p-6 rounded-lg shadow-md border animate-fade-in-down">
                            <h3 class="text-lg font-semibold text-gray-800 mb-2">Método de Entrega</h3>
                            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="text-gray-500">Tipo</dt><dd class="font-medium text-gray-800">Retiro en Sucursal</dd></div>
                                <div><dt class="text-gray-500">Sucursal de Retiro</dt><dd class="font-medium text-gray-800">${venta.sucursal_nombre}</dd></div>
                            </dl>
                        </div>
                    `}
                    
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

                <div class="lg:col-span-1 space-y-6">
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
            
            <${PrintModal}
                isOpen=${printModalState.isOpen}
                onClose=${() => setPrintModalState({ isOpen: false, title: '', content: null })}
                title=${printModalState.title}
            >
                ${printModalState.content === 'nota' && html`<${NotaVentaTemplate} saleDetails=${venta} companyInfo=${companyInfo} />`}
                ${printModalState.content === 'ticket' && html`<${TicketTemplate} saleDetails=${venta} companyInfo=${companyInfo} />`}
            <//>

            ${receiptForPdf && html`
                <div style="position: fixed; left: -9999px; top: 0; font-family: 'Inter', sans-serif;">
                    ${receiptForPdf.format === 'nota' ? html`
                        <${NotaVentaTemplate} ref=${receiptRef} saleDetails=${venta} companyInfo=${companyInfo} />
                    ` : html`
                        <${TicketTemplate} ref=${receiptRef} saleDetails=${venta} companyInfo=${companyInfo} />
                    `}
                </div>
            `}
        <//>
    `;
}