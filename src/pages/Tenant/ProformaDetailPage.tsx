/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Spinner } from '../../components/Spinner.js';
import { useTerminalVenta } from '../../contexts/StatePersistence.js';
import { PrintModal } from '../../components/modals/PrintModal.tsx';
import { generatePdfFromComponent } from '../../lib/pdfGenerator.js';
import { ProformaTemplate } from '../../components/receipts/ProformaTemplate.js';
import { WhatsAppIcon } from '../../components/WhatsAppIcon.js';

// FIX: Defined an interface for stock issue items to provide strong typing.
interface StockIssue {
    producto_id: string;
    producto_nombre: string;
    cantidad_requerida: number;
    cantidad_disponible: number;
    other_branches_stock: { id: string; nombre: string; cantidad: number }[];
}

export function ProformaDetailPage({ proformaId, user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const [proforma, setProforma] = useState(null);
    const { startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();
    const { loadCartFromProforma, setCart, setCustomPrices, setSelectedClientId, setActivePriceListId, setTaxRate, setDiscountValue } = useTerminalVenta();

    const [isAnularModalOpen, setIsAnularModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    // FIX: Applied the StockIssue type to the useState hook for type safety.
    const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
    
    const [popoverState, setPopoverState] = useState({ openFor: null, target: null });
    const popoverRef = useRef(null);
    
    const [printModalState, setPrintModalState] = useState({ isOpen: false });
    const [isDownloading, setIsDownloading] = useState(false);
    const receiptRef = useRef(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const actionsMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
                setIsActionsMenuOpen(false);
            }
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
        return `${companyInfo.monedaSimbolo} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_proforma_details', { p_proforma_id: proformaId });
            if (error) throw error;
            setProforma(data);
        } catch (err) {
            addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
            navigate('/proformas');
        } finally {
            stopLoading();
        }
    }, [proformaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConvertToVenta = async () => {
        startLoading();
        try {
            const { data: posData, error: productsError } = await supabase.rpc('get_pos_data');
            if (productsError) throw productsError;
            const allProducts = posData.products;

            const { data, error } = await supabase.rpc('verificar_stock_proforma', { p_proforma_id: proformaId });
            if (error) throw error;

            if (data.status === 'ok') {
                loadCartFromProforma(proforma, allProducts);
                addToast({ message: 'Proforma cargada en el Punto de Venta.', type: 'success' });
                navigate('/terminal-venta');
            } else {
                setStockIssues(data.items);
                setIsStockModalOpen(true);
            }
        } catch (err) {
            addToast({ message: `Error al verificar stock: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const handleDownloadPdf = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
    };

    useEffect(() => {
        if (isDownloading && receiptRef.current) {
            generatePdfFromComponent(receiptRef.current, `Proforma-${proforma.folio}.pdf`, 'a4')
                .then(() => addToast({ message: 'Descarga iniciada.', type: 'success' }))
                .catch(err => addToast({ message: `Error al generar PDF: ${err.message}`, type: 'error' }))
                .finally(() => setIsDownloading(false));
        }
    }, [isDownloading, proforma]);

    const handleSendWhatsApp = () => {
        if (!proforma?.cliente_telefono) {
            addToast({ message: 'Este cliente no tiene un número de teléfono registrado.', type: 'error' });
            return;
        }

        const phoneNumber = proforma.cliente_telefono.replace(/\D/g, '');
        const fullPhoneNumber = phoneNumber.length > 8 ? phoneNumber : `591${phoneNumber}`;

        const itemsText = (proforma.items || [])
            .map(item => `• ${item.cantidad} x ${item.producto_nombre}`)
            .join('\n');

        let message = `¡Hola ${proforma.cliente_nombre || 'Cliente'}! 👋\n\nTe compartimos los detalles de tu Proforma de *${companyInfo.name}*:\n\n`;
        message += `📄 *Folio:* ${proforma.folio}\n`;
        message += `🗓️ *Fecha:* ${new Date(proforma.fecha_emision).toLocaleDateString()}\n`;
        message += `💰 *Total:* ${formatCurrency(proforma.total)}\n`;
        if (proforma.fecha_vencimiento) {
            message += `*Válida hasta:* ${new Date(proforma.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString()}\n`;
        }
        message += `\n🛒 *Productos:*\n${itemsText}\n\n`;
        message += `Quedamos atentos a tu confirmación.\n\nAtentamente,\n*${companyInfo.name}*`;

        if (companyInfo?.planDetails?.features?.catalogo_web && companyInfo.slug) {
            const catalogUrl = `https://servivent-tenant-627784733720.us-west1.run.app/#/catalogo/${companyInfo.slug}`;
            message += `\n\n---\nVisita nuestro catálogo y haz tu próximo pedido en línea:\n${catalogUrl}`;
        }

        const whatsappUrl = `https://wa.me/${fullPhoneNumber}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };

    const handleContinueAnyway = async () => {
        setIsStockModalOpen(false);
        startLoading();
        try {
            const { data: posData, error: productsError } = await supabase.rpc('get_pos_data');
            if (productsError) throw productsError;
            const allProducts = posData.products;
    
            setSelectedClientId(proforma.cliente_id);
    
            const stockIssuesMap = new Map(stockIssues.map(item => [item.producto_id, item]));
            const newCart = [];
            const newCustomPrices = {};
    
            for (const item of proforma.items) {
                const fullProduct = allProducts.find(p => p.id === item.producto_id);
                if (!fullProduct) continue;
    
                const issue = stockIssuesMap.get(item.producto_id);
                if (issue) {
                    if (issue.cantidad_disponible > 0) {
                        newCart.push({
                            product: fullProduct,
                            quantity: issue.cantidad_disponible
                        });
                        newCustomPrices[item.producto_id] = { newPrice: item.precio_unitario_aplicado };
                        addToast({
                            message: `La cantidad de '${item.producto_nombre}' se ajustó al stock disponible (${issue.cantidad_disponible}).`,
                            type: 'warning',
                            duration: 6000
                        });
                    } else {
                        addToast({
                            message: `'${item.producto_nombre}' no se añadió por falta de stock.`,
                            type: 'error',
                            duration: 6000
                        });
                    }
                } else {
                    newCart.push({
                        product: fullProduct,
                        quantity: item.cantidad
                    });
                    newCustomPrices[item.producto_id] = { newPrice: item.precio_unitario_aplicado };
                }
            }
    
            setCart(newCart);
            setCustomPrices(newCustomPrices);
            
            const taxPercentage = (proforma.impuestos / (proforma.subtotal - proforma.descuento)) * 100;
            setDiscountValue(String(proforma.descuento || ''));
            setTaxRate(isNaN(taxPercentage) ? '' : taxPercentage.toFixed(2));
            setActivePriceListId(null);
    
            addToast({ message: 'Proforma cargada en el Punto de Venta con ajustes de stock.', type: 'info' });
            navigate('/terminal-venta');
    
        } catch (err) {
            addToast({ message: `Error al procesar la proforma: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const handleAnular = async () => {
        startLoading();
        try {
            const { error } = await supabase.rpc('anular_proforma', { p_proforma_id: proformaId });
            if (error) throw error;
            addToast({ message: 'Proforma anulada.', type: 'success' });
            fetchData();
        } catch (err) {
            addToast({ message: `Error al anular: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setIsAnularModalOpen(false);
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
            const { error } = await supabase.rpc('solicitar_traspaso_desde_proforma', {
                p_proforma_id: proformaId,
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

    const handleRequestBulkItems = async (branchId, itemsToRequest, branchName) => {
        startLoading();
        try {
            const itemsPayload = itemsToRequest.map(item => {
                const cantidadASolicitar = item.cantidad_requerida - item.cantidad_disponible;
                return {
                    producto_id: item.producto_id,
                    cantidad: cantidadASolicitar
                };
            }).filter(item => item.cantidad > 0);
            
            if (itemsPayload.length === 0) {
                addToast({ message: 'No hay items faltantes para solicitar desde esta sucursal.', type: 'info' });
                return;
            }
            
            const { error } = await supabase.rpc('solicitar_traspaso_desde_proforma', {
                p_proforma_id: proformaId,
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

        return Array.from(branchSupplyMap.values())
            .sort((a, b) => b.items.length - a.items.length);

    }, [stockIssues]);

    const breadcrumbs = [
        { name: 'Proformas', href: '#/proformas' },
        { name: proforma ? `Detalle ${proforma.folio}` : 'Cargando...', href: `#/proformas/${proformaId}` }
    ];

    if (!proforma) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Proformas" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} />`;
    }

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Proformas"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div class="flex items-center gap-4">
                    <button onClick=${() => navigate('/proformas')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver">
                        ${ICONS.arrow_back}
                    </button>
                    <div>
                        <h1 class="text-2xl font-semibold text-gray-900">Detalle de Proforma: ${proforma.folio}</h1>
                        <p class="text-sm text-gray-500">Fecha de Emisión: ${new Date(proforma.fecha_emision).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="w-full sm:w-auto flex items-center justify-end gap-2">
                    <button onClick=${handleSendWhatsApp} title="Enviar por WhatsApp" class="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                        <${WhatsAppIcon} />
                    </button>
                    <div class="relative" ref=${actionsMenuRef}>
                         <button onClick=${() => setIsActionsMenuOpen(p => !p)} class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600">
                             ${ICONS.settings} Acciones ${ICONS.chevron_down}
                         </button>
                         ${isActionsMenuOpen && html`
                             <div class="absolute right-0 top-full mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10 animate-fade-in-down">
                                 <div class="py-1">
                                     <button onClick=${() => { setPrintModalState({ isOpen: true }); setIsActionsMenuOpen(false); }} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">${ICONS.print} Imprimir Proforma</button>
                                     <button onClick=${() => { handleDownloadPdf(); setIsActionsMenuOpen(false); }} disabled=${isDownloading} class="w-full text-left text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                                         ${isDownloading ? html`<${Spinner} size="h-4 w-4" color="text-gray-500"/>` : ICONS.download} ${isDownloading ? 'Generando...' : 'Descargar PDF'}
                                     </button>
                                     ${proforma.estado === 'Vigente' && html`
                                        <div class="border-t my-1"></div>
                                        <button onClick=${() => { setIsAnularModalOpen(true); setIsActionsMenuOpen(false); }} class="w-full text-left text-red-600 block px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2">
                                            ${ICONS.close} Anular Proforma
                                        </button>
                                     `}
                                 </div>
                             </div>
                         `}
                    </div>
                    ${proforma.estado === 'Vigente' && html`
                        <button onClick=${handleConvertToVenta} class="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                            ${ICONS.shopping_cart} Convertir a Venta
                        </button>
                    `}
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-2 space-y-6">
                        <div class="border-b pb-4">
                            <h3 class="text-base font-semibold text-gray-800">Detalles Generales</h3>
                            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="text-gray-500">Cliente:</dt><dd class="font-medium text-gray-800">${proforma.cliente_nombre}</dd></div>
                                <div><dt class="text-gray-500">Válida hasta:</dt><dd class="font-medium text-gray-800">${new Date(proforma.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString()}</dd></div>
                                <div><dt class="text-gray-500">Generado por:</dt><dd class="font-medium text-gray-800">${proforma.usuario_nombre}</dd></div>
                                <div><dt class="text-gray-500">Sucursal:</dt><dd class="font-medium text-gray-800">${proforma.sucursal_nombre}</dd></div>
                            </dl>
                        </div>
                        <div>
                            <h3 class="text-base font-semibold text-gray-800 mb-2">Productos Cotizados</h3>
                             <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">P. Unitario</th>
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${proforma.items.map(item => html`
                                        <tr>
                                            <td class="px-4 py-3 text-sm font-medium text-gray-900">${item.producto_nombre}</td>
                                            <td class="px-4 py-3 text-sm text-right text-gray-500">${item.cantidad}</td>
                                            <td class="px-4 py-3 text-sm text-right text-gray-500">${formatCurrency(item.precio_unitario_aplicado)}</td>
                                            <td class="px-4 py-3 text-sm text-right font-semibold text-gray-800">${formatCurrency(item.cantidad * item.precio_unitario_aplicado)}</td>
                                        </tr>
                                    `)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="lg:col-span-1 space-y-4">
                        <div class="p-4 bg-slate-50 rounded-lg border">
                            <h3 class="text-base font-semibold text-gray-800 mb-2">Resumen Financiero</h3>
                            <dl class="space-y-2 text-sm">
                                <div class="flex justify-between"><dt class="text-gray-600">Subtotal:</dt><dd class="font-medium text-gray-800">${formatCurrency(proforma.subtotal)}</dd></div>
                                <div class="flex justify-between"><dt class="text-gray-600">Descuento:</dt><dd class="font-medium text-red-600">- ${formatCurrency(proforma.descuento)}</dd></div>
                                <div class="flex justify-between"><dt class="text-gray-600">Impuestos:</dt><dd class="font-medium text-gray-800">+ ${formatCurrency(proforma.impuestos)}</dd></div>
                                <div class="flex justify-between text-lg font-bold text-gray-900 border-t pt-2 mt-2"><span>TOTAL:</span><span>${formatCurrency(proforma.total)}</span></div>
                            </dl>
                        </div>
                        ${proforma.notas && html`
                            <div class="p-4 bg-slate-50 rounded-lg border">
                                <h3 class="text-base font-semibold text-gray-800 mb-2">Términos y Condiciones</h3>
                                <p class="text-sm text-gray-600 whitespace-pre-wrap">${proforma.notas}</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <${ConfirmationModal}
                isOpen=${isAnularModalOpen}
                onClose=${() => setIsAnularModalOpen(false)}
                onConfirm=${handleAnular}
                title="Anular Proforma"
                confirmText="Sí, anular"
                confirmVariant="danger"
            >
                <p>¿Estás seguro de que quieres anular esta proforma? Esta acción no se puede deshacer.</p>
            <//>

            <${ConfirmationModal}
                isOpen=${isStockModalOpen}
                onClose=${() => setIsStockModalOpen(false)}
                title="Stock Insuficiente"
                icon=${ICONS.warning}
                maxWidthClass="max-w-4xl"
                customFooter=${html`
                    <div class="flex-shrink-0 flex justify-between items-center p-4 bg-gray-50 rounded-b-xl border-t">
                        <button onClick=${() => setIsStockModalOpen(false)} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancelar</button>
                        <button onClick=${handleContinueAnyway} class="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500">Continuar de Todos Modos</button>
                    </div>
                `}
            >
                <p class="text-sm text-gray-600 mb-4">Algunos productos no tienen suficiente stock en tu sucursal. Puedes solicitar un traspaso a otra sucursal o continuar para ajustar las cantidades en el Punto de Venta.</p>
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
            
            <${PrintModal}
                isOpen=${printModalState.isOpen}
                onClose=${() => setPrintModalState({ isOpen: false })}
                title="Previsualizar Proforma"
            >
                <${ProformaTemplate} proformaDetails=${proforma} companyInfo=${companyInfo} />
            <//>
            
            ${isDownloading && html`
                <div style="position: fixed; left: -9999px; top: 0;">
                    <${ProformaTemplate} ref=${receiptRef} proformaDetails=${proforma} companyInfo=${companyInfo} />
                </div>
            `}
        <//>
    `;
}