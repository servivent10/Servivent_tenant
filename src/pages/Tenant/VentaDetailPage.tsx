/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
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
import { WhatsAppIcon } from '../../components/WhatsAppIcon.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { useTerminalVenta } from '../../contexts/StatePersistence.js';

interface StockIssue {
    producto_id: string;
    producto_nombre: string;
    cantidad_requerida: number;
    cantidad_disponible: number;
    other_branches_stock: { id: string; nombre: string; cantidad: number }[];
}


export function VentaDetailPage({ ventaId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [venta, setVenta] = useState(null);
    const { startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();
    const { loadCartFromProforma } = useTerminalVenta();

    const [printModalState, setPrintModalState] = useState({ isOpen: false, title: '', content: null });
    const [receiptForPdf, setReceiptForPdf] = useState(null);
    const receiptRef = useRef(null);

    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
    const [popoverState, setPopoverState] = useState({ openFor: null, target: null });
    const popoverRef = useRef(null);
    
    // Nuevo estado para el panel de gestión de pedidos web
    const [stockCheckStatus, setStockCheckStatus] = useState('idle'); // idle, checking, ok, insufficient
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target) && (!popoverState.target || !popoverState.target.contains(event.target))) {
                setPopoverState({ openFor: null, target: null });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [popoverState.target]);

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

    const fetchData = useCallback(async () => {
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
    }, [ventaId, startLoading, stopLoading, addToast, navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        const checkStock = async () => {
            if (venta && venta.metodo_pago === 'Pedido Web' && !venta.stock_deducido) {
                setStockCheckStatus('checking');
                try {
                    const { data: stockData, error: stockError } = await supabase.rpc('verificar_stock_para_venta', { p_venta_id: ventaId });
                    if (stockError) throw stockError;

                    if (stockData.status === 'ok') {
                        setStockCheckStatus('ok');
                    } else {
                        setStockCheckStatus('insufficient');
                        setStockIssues(stockData.items);
                    }
                } catch (err) {
                    setStockCheckStatus('error');
                    addToast({ message: `Error al verificar stock: ${err.message}`, type: 'error' });
                }
            } else if (venta && (venta.metodo_pago !== 'Pedido Web' || venta.stock_deducido)) {
                setStockCheckStatus('idle'); // Reset if not a pending web order
            }
        };

        checkStock();
    }, [venta, ventaId, addToast]);


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

    const handleSendWhatsApp = () => {
        if (!venta?.cliente_telefono) {
            addToast({ message: 'Este cliente no tiene un número de teléfono registrado.', type: 'error' });
            return;
        }

        const phoneNumber = venta.cliente_telefono.replace(/\D/g, '');
        const fullPhoneNumber = phoneNumber.length > 8 ? phoneNumber : `591${phoneNumber}`;
        
        const itemsText = (venta.items || [])
            .map(item => `• ${item.cantidad} x ${item.producto_nombre}`)
            .join('\n');

        let message = `¡Hola ${venta.cliente_nombre || 'Cliente'}! 👋\n\nTe compartimos los detalles de tu Venta de *${companyInfo.name}*:\n\n`;
        message += `📄 *Folio:* ${venta.folio}\n`;
        message += `🗓️ *Fecha:* ${new Date(venta.fecha).toLocaleDateString()}\n`;
        message += `💰 *Total:* ${formatCurrency(venta.total)}\n`;
        message += `*Estado:* ${venta.estado_pago}\n\n`;
        message += `🛒 *Productos:*\n${itemsText}\n\n`;
        message += `Cualquier consulta, estamos a tu disposición.\n¡Gracias por tu preferencia!`;

        if (companyInfo?.planDetails?.features?.catalogo_web && companyInfo.slug) {
            const catalogUrl = `https://servivent-tenant-627784733720.us-west1.run.app/#/catalogo/${companyInfo.slug}`;
            message += `\n\n---\nVisita nuestro catálogo y haz tu próximo pedido en línea:\n${catalogUrl}`;
        }
        
        const whatsappUrl = `https://wa.me/${fullPhoneNumber}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };
    
    const handleConfirmPedidoWeb = async () => {
        startLoading();
        try {
            // Re-verify stock just in case it changed.
            const { data: stockData, error: stockError } = await supabase.rpc('verificar_stock_para_venta', { p_venta_id: ventaId });
            if (stockError) throw stockError;

            if (stockData.status === 'ok') {
                const { error } = await supabase.rpc('confirmar_pedido_web', { p_venta_id: ventaId });
                if (error) throw error;
                addToast({ message: 'Pedido confirmado y procesado con éxito. El inventario ha sido actualizado.', type: 'success' });
                fetchData();
            } else {
                setStockIssues(stockData.items);
                setIsStockModalOpen(true);
            }
        } catch (err) {
             addToast({ message: `Error al confirmar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const handleRequestSingleItem = async (item, originBranchId) => {
        const cantidadASolicitar = item.cantidad_requerida - item.cantidad_disponible;
        if (cantidadASolicitar <= 0) {
            addToast({ message: 'No hay cantidad faltante para solicitar.', type: 'info' });
            return;
        }

        startLoading();
        setPopoverState({ openFor: null, target: null });
        try {
            const { error } = await supabase.rpc('solicitar_traspaso_desde_venta', {
                p_venta_id: ventaId,
                p_sucursal_origen_id: originBranchId,
                p_items: [{ producto_id: item.producto_id, cantidad: cantidadASolicitar }]
            });
            if (error) throw error;
            const originBranchName = item.other_branches_stock.find(b => b.id === originBranchId)?.nombre || 'la sucursal seleccionada';
            addToast({ message: `Solicitud de traspaso enviada a ${originBranchName}.`, type: 'success' });
            setIsStockModalOpen(false);
        } catch (err) {
            addToast({ message: `Error al solicitar traspaso: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const transferSuggestions = useMemo(() => {
        if (!stockIssues || stockIssues.length === 0) return [];
        const branchSupplyMap = new Map();
        stockIssues.forEach(item => {
            if (item.other_branches_stock && item.other_branches_stock.length > 0) {
                item.other_branches_stock.forEach(branch => {
                    if (!branchSupplyMap.has(branch.id)) {
                        branchSupplyMap.set(branch.id, { branchId: branch.id, branchName: branch.nombre, items: [] });
                    }
                    branchSupplyMap.get(branch.id).items.push(item);
                });
            }
        });
        return Array.from(branchSupplyMap.values()).sort((a, b) => b.items.length - a.items.length);
    }, [stockIssues]);

    const handleRequestBulkItems = async (branchId, itemsToRequest, branchName) => {
        startLoading();
        try {
            const itemsPayload = itemsToRequest.map(item => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad_requerida - item.cantidad_disponible
            })).filter(item => item.cantidad > 0);
            
            if (itemsPayload.length === 0) return;
            
            const { error } = await supabase.rpc('solicitar_traspaso_desde_venta', {
                p_venta_id: ventaId,
                p_sucursal_origen_id: branchId,
                p_items: itemsPayload
            });
            
            if (error) throw error;
            addToast({ message: `Solicitud de traspaso enviada a ${branchName}.`, type: 'success' });
            setIsStockModalOpen(false);
        } catch (err) {
            addToast({ message: `Error al solicitar traspaso: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const handleContinueAnyway = async () => {
        setIsStockModalOpen(false);
        startLoading();
        try {
            const { data: posData, error: productsError } = await supabase.rpc('get_pos_data');
            if (productsError) throw productsError;
            
            const saleAsProforma = { ...venta, id: ventaId }; // Create a proforma-like object
            loadCartFromProforma(saleAsProforma, posData.products);
            
            addToast({ message: 'Pedido cargado en el Punto de Venta. Las cantidades se han ajustado al stock disponible.', type: 'info', duration: 8000 });
            navigate('/terminal-venta');
        } catch (err) {
            addToast({ message: `Error al procesar el pedido: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };


    const breadcrumbs = [
        { name: 'Ventas', href: '#/ventas' },
        { name: venta ? `Detalle Venta ${venta.folio}` : 'Cargando...', href: `#/ventas/${ventaId}` }
    ];

    const PaymentManager = ({ ventaData }) => {
        const [montoAbono, setMontoAbono] = useState('');
        const [metodoAbono, setMetodoAbono] = useState('Efectivo');
        const [isSaving, setIsSaving] = useState(false);
        
        useEffect(() => {
            if (ventaData && ventaData.saldo_pendiente > 0) {
                setMontoAbono(Number(ventaData.saldo_pendiente).toFixed(2));
            }
        }, [ventaData.saldo_pendiente]);

        const handleMethodSelect = (metodo) => {
            setMetodoAbono(metodo);
            if (ventaData && ventaData.saldo_pendiente > 0) {
                setMontoAbono(Number(ventaData.saldo_pendiente).toFixed(2));
            }
        };

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
                    ${ventaData.saldo_pendiente > 0.005 && html`
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
                
                ${ventaData.saldo_pendiente > 0.005 && html`
                    <div class="mt-6">
                        <h4 class="font-semibold text-gray-700">Registrar Nuevo Abono</h4>
                         <div class="mt-2 grid grid-cols-3 gap-2">
                            <button onClick=${() => handleMethodSelect('Efectivo')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'Efectivo' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.payments} Efectivo</button>
                            <button onClick=${() => handleMethodSelect('QR')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'QR' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.qr_code_2} QR</button>
                            <button onClick=${() => handleMethodSelect('Transferencia Bancaria')} class="flex items-center justify-center gap-1 p-2 rounded-md text-xs font-semibold transition-colors ${metodoAbono === 'Transferencia Bancaria' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.currency_exchange} Transf.</button>
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
    
    const GestionPedidoWebPanel = ({ ventaData, onConfirm, onShowStockIssues, stockCheckStatus }) => {
        const isDelivery = !!ventaData.direccion_entrega_id;
        const isFullyPaid = ventaData.saldo_pendiente <= 0.005;
    
        let content;
        switch (stockCheckStatus) {
            case 'checking':
                content = html`
                    <div class="flex items-center justify-center gap-2 p-4">
                        <${Spinner} color="text-primary"/>
                        <span class="text-sm font-medium text-gray-600">Verificando stock...</span>
                    </div>
                `;
                break;
            case 'ok':
                content = html`
                    <div class="p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                        <p class="font-bold text-green-900 flex items-center gap-2">${ICONS.success} Stock disponible. El pedido está listo para ser procesado.</p>
                    </div>
                    <div class="mt-6">
                        <button onClick=${onConfirm} disabled=${!isFullyPaid} class="w-full flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
                            ${ICONS.inventory} Confirmar y Procesar Pedido
                        </button>
                        ${!isFullyPaid && html`<p class="text-xs text-center mt-2 text-amber-600">El pedido debe estar completamente pagado para poder ser procesado.</p>`}
                    </div>
                `;
                break;
            case 'insufficient':
                content = html`
                    <div class="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                        <p class="font-bold text-amber-900 flex items-center gap-2">${ICONS.warning} Stock insuficiente en esta sucursal.</p>
                    </div>
                    <div class="mt-6">
                        <button onClick=${onShowStockIssues} class="w-full flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-500">
                            ${ICONS.transfers} Ver Faltantes y Solicitar Traspaso
                        </button>
                    </div>
                `;
                break;
            default: // 'idle' or 'error'
                content = html`
                    <div class="p-3 bg-gray-100 border border-gray-200 rounded-md text-sm text-center">
                        <p class="text-gray-500">Esperando datos...</p>
                    </div>
                `;
        }
    
        return html`
            <div class="bg-white p-6 rounded-lg shadow-md border">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">${ICONS.bolt} Gestión de Pedido Web</h3>
                <div class="mt-4 p-3 bg-cyan-50 border border-cyan-200 rounded-md text-sm">
                    <p class="font-bold text-cyan-900">
                        ${isDelivery ? `Pedido para Envío a Domicilio desde: ${ventaData.sucursal_nombre}` : `Pedido para Retiro en: ${ventaData.sucursal_nombre}`}
                    </p>
                </div>
                <div class="mt-6">
                    ${content}
                </div>
            </div>
        `;
    };
    
    const renderContent = () => {
        if (!venta) {
            return html`<div class="py-20 flex justify-center"><${Spinner}/></div>`;
        }
        
        const isWebOrder = venta.metodo_pago === 'Pedido Web';
        const isProcessed = venta.stock_deducido === true;
        const showWebOrderPanel = isWebOrder && !isProcessed;
        
        const isDelivery = isWebOrder && venta.direccion_entrega;

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
                <div class="flex items-center gap-2">
                    <button onClick=${handleSendWhatsApp} title="Enviar por WhatsApp" class="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                        <${WhatsAppIcon} />
                    </button>
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
                    
                    <div class="bg-white rounded-lg shadow-md border">
                        <h3 class="text-lg font-semibold text-gray-800 p-6 pb-2">Productos Vendidos</h3>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P. Unitario</th>
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
                                    <tr><td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Subtotal</td><td class="px-6 py-2 text-right text-sm font-semibold text-gray-800">${formatCurrency(venta.subtotal)}</td></tr>
                                     <tr><td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Descuento</td><td class="px-6 py-2 text-right text-sm font-semibold text-red-600">- ${formatCurrency(venta.descuento)}</td></tr>
                                     <tr><td colspan="3" class="px-6 py-2 text-right text-sm font-medium text-gray-600">Impuestos</td><td class="px-6 py-2 text-right text-sm font-semibold text-gray-800">+ ${formatCurrency(venta.impuestos)}</td></tr>
                                     <tr><td colspan="3" class="px-6 py-3 text-right text-base font-bold text-gray-900 border-t-2">TOTAL</td><td class="px-6 py-3 text-right text-base font-bold text-primary border-t-2">${formatCurrency(venta.total)}</td></tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-1 space-y-6">
                    ${showWebOrderPanel && html`
                        <${GestionPedidoWebPanel} 
                            ventaData=${venta} 
                            onConfirm=${handleConfirmPedidoWeb} 
                            onShowStockIssues=${() => setIsStockModalOpen(true)}
                            stockCheckStatus=${stockCheckStatus}
                        />
                    `}
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
            
            <${ConfirmationModal}
                isOpen=${isStockModalOpen}
                onClose=${() => setIsStockModalOpen(false)}
                title="Stock Insuficiente"
                icon=${ICONS.warning}
                maxWidthClass="max-w-4xl"
                customFooter=${html`
                    <div class="flex-shrink-0 flex justify-between items-center p-4 bg-gray-50 rounded-b-xl border-t">
                        <button onClick=${() => setIsStockModalOpen(false)} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancelar</button>
                        <button onClick=${handleContinueAnyway} class="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500">Vender Stock Disponible</button>
                    </div>
                `}
            >
                <p class="text-sm text-gray-600 mb-4">Algunos productos no tienen suficiente stock en tu sucursal. Puedes solicitar un traspaso a otra sucursal o continuar para vender solo las unidades disponibles.</p>
                <div class="max-h-60 overflow-y-auto border rounded-md">
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 sticky top-0 z-10"><tr>
                            <th class="p-2 text-left font-semibold text-gray-600">Producto</th>
                            <th class="p-2 text-center font-semibold text-gray-600">Requerido</th>
                            <th class="p-2 text-center font-semibold text-gray-600">Disponible</th>
                            <th class="p-2 text-center font-semibold text-gray-600">Acción</th>
                        </tr></thead>
                        <tbody class="divide-y">
                            ${stockIssues.map(item => {
                                const availableBranches = item.other_branches_stock || [];
                                return html`
                                <tr key=${item.producto_id}>
                                    <td class="p-2 text-gray-900">${item.producto_nombre}</td>
                                    <td class="p-2 text-center font-bold text-gray-900">${item.cantidad_requerida}</td>
                                    <td class="p-2 text-center font-bold text-red-600">${item.cantidad_disponible}</td>
                                    <td class="p-2 text-center">
                                        ${availableBranches.length > 0 && html`
                                            <div class="relative inline-block text-left">
                                                <button onClick=${(e) => setPopoverState({ openFor: item.producto_id, target: e.currentTarget })} class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200">
                                                    Otras Suc. ${ICONS.chevron_down}
                                                </button>
                                                ${popoverState.openFor === item.producto_id && html`
                                                    <div ref=${popoverRef} style=${{ position: 'absolute', right: 0, marginTop: '0.5rem', zIndex: 20 }} class="w-56 origin-top-right rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                                                        <div class="py-1">
                                                            <div class="px-3 py-2 text-xs font-bold text-gray-700 border-b">Solicitar desde:</div>
                                                            <div class="max-h-32 overflow-y-auto">
                                                                ${availableBranches.map(branch => html`
                                                                    <div class="px-3 py-2 flex justify-between items-center hover:bg-slate-50">
                                                                        <div>
                                                                            <p class="text-sm font-medium text-gray-900">${branch.nombre}</p>
                                                                            <p class="text-xs text-gray-500">Stock: ${branch.cantidad}</p>
                                                                        </div>
                                                                        <button onClick=${() => handleRequestSingleItem(item, branch.id)} class="text-xs font-semibold text-primary hover:underline">Solicitar</button>
                                                                    </div>
                                                                `)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                `}
                                            </div>
                                        `}
                                    </td>
                                </tr>`;
                            })}
                        </tbody>
                    </table>
                </div>
                ${transferSuggestions.length > 0 && html`
                    <div class="mt-6 pt-4 border-t">
                        <h4 class="text-base font-semibold text-gray-800">Sugerencias de Traspaso</h4>
                        <div class="mt-2 space-y-2">
                            ${transferSuggestions.map(suggestion => html`
                                <button
                                    onClick=${() => handleRequestBulkItems(suggestion.branchId, suggestion.items, suggestion.branchName)}
                                    class="w-full text-left p-3 rounded-md bg-green-50 border border-green-200 hover:bg-green-100 flex justify-between items-center"
                                >
                                    <span class="font-medium text-green-800">
                                        Solicitar ${suggestion.items.length} productos desde <b>${suggestion.branchName}</b>
                                    </span>
                                    <span class="text-green-700">${ICONS.chevron_right}</span>
                                </button>
                            `)}
                        </div>
                    </div>
                `}
            <//>
            
        <//>
    `;
}
