/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';
import { Tabs } from '../../components/Tabs.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';


export function CompraDetailPage({ compraId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [compra, setCompra] = useState(null);
    const [activeTab, setActiveTab] = useState('productos');
    const { isLoading, startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();
    
    // State for Landed Cost
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
    const [prorrateoMethod, setProrrateoMethod] = useState('VALOR');
    const [isApplyCostModalOpen, setIsApplyCostModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    useEffect(() => {
        if (user.role === 'Empleado') {
            addToast({ message: 'No tienes permiso para acceder a este módulo.', type: 'error' });
            navigate('/compras');
        }
    }, [user.role, navigate, addToast]);

    const formatCurrency = (value, currencyCode) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${currencyCode || companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

    const fetchData = async () => {
        if (user.role === 'Empleado') return;
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_purchase_details', { p_compra_id: compraId });
            if (error) throw error;
            setCompra(data);
        } catch(err) {
            addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
            navigate('/compras');
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, [compraId]);

    const breadcrumbs = [
        { name: 'Compras', href: '#/compras' },
        { name: compra ? `Detalle Compra ${compra.folio}` : 'Cargando...', href: `#/compras/${compraId}` }
    ];

    const PaymentManager = ({ compraData }) => {
        const [montoAbono, setMontoAbono] = useState('');
        const [metodoAbono, setMetodoAbono] = useState('Efectivo');
        const [isSaving, setIsSaving] = useState(false);
        
        const handleAddPayment = async () => {
            const monto = Number(montoAbono);
            if (!monto || monto <= 0) {
                addToast({ message: 'Por favor, introduce un monto válido.', type: 'error' });
                return;
            }
            if (monto > Number(compraData.saldo_pendiente)) {
                addToast({ message: 'El abono no puede ser mayor que el saldo pendiente.', type: 'error' });
                return;
            }

            setIsSaving(true);
            try {
                const { error } = await supabase.rpc('registrar_pago_compra', {
                    p_compra_id: compraData.id,
                    p_monto: monto,
                    p_metodo_pago: metodoAbono
                });
                if (error) throw error;
                addToast({ message: 'Abono registrado con éxito.', type: 'success' });
                setMontoAbono('');
                fetchData();
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
                    <div class="bg-slate-50 p-3 rounded-md"><dt class="text-gray-500">Monto Total</dt><dd class="font-bold text-lg text-gray-900">${formatCurrency(compraData.total, compraData.moneda)}</dd></div>
                    <div class="bg-slate-50 p-3 rounded-md"><dt class="text-gray-500">Monto Pagado</dt><dd class="font-bold text-lg text-green-600">${formatCurrency(Number(compraData.total) - Number(compraData.saldo_pendiente), compraData.moneda)}</dd></div>
                    ${compraData.estado_pago !== 'Pagada' && html`
                        <div class="bg-red-50 p-3 rounded-md col-span-2"><dt class="text-red-800 font-semibold">Saldo Pendiente</dt><dd class="font-bold text-2xl text-red-600">${formatCurrency(compraData.saldo_pendiente, compraData.moneda)}</dd></div>
                    `}
                </dl>

                <div class="mt-6">
                    <h4 class="font-semibold text-gray-700">Historial de Pagos</h4>
                    <ul class="mt-2 divide-y divide-gray-200 border-t border-b max-h-48 overflow-y-auto">
                        ${compraData.pagos.map(p => html`
                            <li class="flex justify-between items-center py-2 text-sm">
                                <div>
                                    <p class="font-medium text-gray-800">${p.metodo_pago}</p>
                                    <p class="text-xs text-gray-500">${new Date(p.fecha_pago).toLocaleString()}</p>
                                </div>
                                <p class="font-semibold text-green-700">${formatCurrency(p.monto, compraData.moneda)}</p>
                            </li>
                        `)}
                        ${compraData.pagos.length === 0 && html`<li class="py-3 text-sm text-center text-gray-500">No se han registrado pagos.</li>`}
                    </ul>
                </div>
                
                ${compraData.estado_pago !== 'Pagada' && html`
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
    
    const handleAddGasto = async (e) => {
        e.preventDefault();
        const monto = Number(nuevoGasto.monto);
        if (!nuevoGasto.concepto.trim() || !monto || monto <= 0) {
            addToast({ message: 'El concepto y un monto válido son obligatorios.', type: 'error' });
            return;
        }
        startLoading();
        try {
            const { error } = await supabase.rpc('add_gasto_compra', {
                p_compra_id: compraId,
                p_concepto: nuevoGasto.concepto,
                p_monto: monto
            });
            if (error) throw error;
            addToast({ message: 'Gasto adicional añadido.', type: 'success' });
            setNuevoGasto({ concepto: '', monto: '' });
            fetchData();
        } catch(err) {
            addToast({ message: `Error al añadir gasto: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const handleDeleteGasto = async (gastoId) => {
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_gasto_compra', { p_gasto_id: gastoId });
            if (error) throw error;
            addToast({ message: 'Gasto eliminado.', type: 'success' });
            fetchData();
        } catch(err) {
            addToast({ message: `Error al eliminar gasto: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const handleApplyCosts = async () => {
        setIsApplyCostModalOpen(false);
        startLoading();
        try {
            const { error } = await supabase.rpc('aplicar_costos_adicionales_a_compra', {
                p_compra_id: compraId,
                p_metodo_prorrateo: prorrateoMethod
            });
            if (error) throw error;
            addToast({ message: 'Costos aplicados y CAPP recalculado con éxito.', type: 'success' });
            fetchData();
        } catch (err) {
            addToast({ message: `Error al aplicar costos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    if (user.role === 'Empleado') return null;

    const renderContent = () => {
        if (isLoading && !compra) {
            return html`<div class="py-20 flex justify-center"><${Spinner}/></div>`;
        }

        if (!compra) {
            return html`
                <div class="text-center py-10">
                    <h2 class="text-xl font-semibold text-red-600">Compra no encontrada</h2>
                    <p class="text-gray-600 mt-2">No se pudo encontrar la compra solicitada o no tienes permiso para verla.</p>
                    <button onClick=${() => navigate('/compras')} class="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Volver a Compras</button>
                </div>
            `;
        }
        
        const totalGastosAdicionales = compra.gastos_adicionales.reduce((sum, g) => sum + Number(g.monto), 0);

        return html`
            <div class="flex items-center gap-4 mb-4">
                <button onClick=${() => navigate('/compras')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver a Compras">
                    ${ICONS.arrow_back}
                </button>
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">Detalle de Compra: ${compra.folio}</h1>
                    <p class="text-sm text-gray-500">Proveedor: ${compra.proveedor_nombre}</p>
                </div>
            </div>
            
            <div class="mt-6">
                <${Tabs} tabs=${[{id: 'productos', label:'Detalle de Productos'}, {id: 'costos', label: 'Costos Adicionales'}]} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>

            <div class="mt-6">
                ${activeTab === 'productos' && html`
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-down">
                        <div class="lg:col-span-2 space-y-6">
                            <div class="bg-white p-6 rounded-lg shadow-md border">
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">Detalles Generales</h3>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div><dt class="text-gray-500">Fecha de Compra</dt><dd class="font-medium text-gray-800">${new Date(compra.fecha).toLocaleString()}</dd></div>
                                    <div><dt class="text-gray-500">Registrado por</dt><dd class="font-medium text-gray-800">${compra.usuario_nombre || 'N/A'}</dd></div>
                                    <div><dt class="text-gray-500">N° Factura/Nota</dt><dd class="font-medium text-gray-800">${compra.n_factura || 'N/A'}</dd></div>
                                    <div><dt class="text-gray-500">Tipo de Pago</dt><dd class="font-medium text-gray-800">${compra.tipo_pago}</dd></div>
                                    <div><dt class="text-gray-500">Moneda</dt><dd class="font-medium text-gray-800">${compra.moneda}</dd></div>
                                    ${compra.moneda === 'USD' && html`
                                        <div>
                                            <dt class="text-gray-500">Tasa de Cambio Aplicada</dt>
                                            <dd class="font-medium text-gray-800">1 USD = ${compra.tasa_cambio} BOB</dd>
                                        </div>
                                    `}
                                    ${compra.fecha_vencimiento && html`<div><dt class="text-gray-500">Vencimiento</dt><dd class="font-medium text-red-600">${new Date(compra.fecha_vencimiento).toLocaleDateString()}</dd></div>`}
                                </dl>
                            </div>
                            <div class="bg-white rounded-lg shadow-md border">
                                <h3 class="text-lg font-semibold text-gray-800 p-6 pb-2">Productos Adquiridos</h3>
                                <div class="overflow-x-auto">
                                    <table class="min-w-full divide-y divide-gray-200">
                                        <thead class="bg-gray-50">
                                            <tr>
                                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unitario</th>
                                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-white divide-y divide-gray-200">
                                            ${compra.items.map(item => html`
                                                <tr>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.producto_nombre}</td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${item.cantidad}</td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatCurrency(item.costo_unitario, compra.moneda)}</td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800">${formatCurrency(Number(item.cantidad) * Number(item.costo_unitario), compra.moneda)}</td>
                                                </tr>
                                            `)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="lg:col-span-1">
                            <${PaymentManager} compraData=${compra} />
                        </div>
                    </div>
                `}
                ${activeTab === 'costos' && html`
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-down">
                        <div class="bg-white p-6 rounded-lg shadow-md border">
                             <h3 class="text-lg font-semibold text-gray-800 mb-4">Registrar Gasto Adicional</h3>
                             ${compra.costos_aplicados ? html`
                                <div class="p-4 bg-green-50 text-green-800 border border-green-200 rounded-md text-sm">
                                    Los costos adicionales para esta compra ya han sido aplicados y el valor del inventario ha sido recalculado. No se pueden añadir más gastos.
                                </div>
                             ` : html`
                                <form onSubmit=${handleAddGasto} class="space-y-4">
                                    <${FormInput} label="Concepto del Gasto" name="concepto" value=${nuevoGasto.concepto} onInput=${e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})} />
                                    <${FormInput} label="Monto (${compra.moneda})" name="monto" type="number" value=${nuevoGasto.monto} onInput=${e => setNuevoGasto({...nuevoGasto, monto: e.target.value})} />
                                    <button type="submit" class="w-full flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">${ICONS.add} Añadir Gasto</button>
                                </form>
                             `}
                        </div>
                         <div class="bg-white p-6 rounded-lg shadow-md border">
                             <h3 class="text-lg font-semibold text-gray-800 mb-4">Resumen y Aplicación</h3>
                             <ul class="divide-y max-h-48 overflow-y-auto pr-2">
                                ${compra.gastos_adicionales.map(g => html`
                                    <li class="py-2 flex justify-between items-center">
                                        <span class="text-sm text-gray-700">${g.concepto}</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-semibold text-gray-800">${formatCurrency(g.monto, compra.moneda)}</span>
                                            ${!compra.costos_aplicados && html`<button onClick=${() => handleDeleteGasto(g.id)} class="text-red-500 hover:text-red-700">${ICONS.delete}</button>`}
                                        </div>
                                    </li>
                                `)}
                             </ul>
                             ${compra.moneda === 'USD' && html`
                                <div class="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                                    <span class="text-gray-600">Tasa de Cambio (compra):</span>
                                    <span class="font-semibold text-gray-800">1 USD = ${compra.tasa_cambio} BOB</span>
                                </div>
                            `}
                             <div class="mt-4 pt-4 border-t flex justify-between items-center">
                                 <span class="text-base font-bold text-gray-800">Total Adicional:</span>
                                 <span class="text-xl font-bold text-primary">${formatCurrency(totalGastosAdicionales, compra.moneda)}</span>
                             </div>
                             <div class="mt-4 space-y-2">
                                <div class="flex items-center gap-2">
                                    <${FormSelect} label="Método de Prorrateo" name="prorrateo" value=${prorrateoMethod} onInput=${e => setProrrateoMethod(e.target.value)} disabled=${compra.costos_aplicados} options=${[{value: 'VALOR', label:'Por Valor'}, {value:'CANTIDAD', label:'Por Cantidad'}]} />
                                    <button onClick=${() => setIsInfoModalOpen(true)} class="mt-6 text-gray-400 hover:text-primary">${ICONS.info}</button>
                                </div>
                                <button onClick=${() => setIsApplyCostModalOpen(true)} disabled=${compra.costos_aplicados || totalGastosAdicionales <= 0} class="w-full flex justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-slate-400">
                                    ${ICONS.bolt} Aplicar Costos y Recalcular
                                </button>
                             </div>
                        </div>
                    </div>
                `}
            </div>
        `;
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Compras"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            ${renderContent()}
            <${ConfirmationModal}
                isOpen=${isApplyCostModalOpen}
                onClose=${() => setIsApplyCostModalOpen(false)}
                onConfirm=${handleApplyCosts}
                title="Confirmar Aplicación de Costos"
                confirmText="Sí, aplicar y recalcular"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">Estás a punto de recalcular permanentemente el costo de los productos de esta compra basándote en los gastos adicionales registrados. Esta acción no se puede deshacer.</p>
                <p class="mt-2 text-sm text-gray-600">¿Deseas continuar?</p>
            <//>
            <${ConfirmationModal}
                isOpen=${isInfoModalOpen}
                onClose=${() => setIsInfoModalOpen(false)}
                onConfirm=${() => setIsInfoModalOpen(false)}
                title="¿Qué método de prorrateo usar?"
                confirmText="Entendido"
                icon=${ICONS.info}
                maxWidthClass="max-w-2xl"
            >
                <div class="space-y-4 text-sm text-gray-600">
                    <div>
                        <h4 class="font-bold text-gray-800">1. Por Cantidad</h4>
                        <p class="mt-1">
                            <span class="font-semibold">Cómo funciona:</span> Divide el total de gastos adicionales entre el número total de unidades compradas. Cada unidad, sin importar su costo, absorbe la misma cantidad de gasto.
                        </p>
                        <p class="mt-1">
                            <span class="font-semibold">Ejemplo:</span> Compras 10 TVs y 10 radios (20 unidades en total). Si el gasto de transporte es de 200 Bs, cada producto (sea TV o radio) aumentará su costo en 10 Bs (200 / 20).
                        </p>
                         <p class="mt-2">
                            <span class="font-semibold">Cuándo usarlo:</span> Ideal para compras de productos muy similares en tamaño y peso, donde el costo logístico es casi idéntico para cada uno (ej. tornillos, botellas de agua).
                        </p>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-800">2. Por Valor (Recomendado)</h4>
                        <p class="mt-1">
                            <span class="font-semibold">Cómo funciona:</span> Distribuye los gastos adicionales en proporción al valor que cada producto representa en la compra total. Los productos más caros absorben una mayor porción del gasto.
                        </p>
                        <p class="mt-1">
                             <span class="font-semibold">Ejemplo:</span> Compras 1 TV (1.000 Bs) y 1 radio (200 Bs). El valor total es 1.200 Bs. Si el gasto de transporte es de 120 Bs (10% del total), la TV absorberá 100 Bs de gasto y la radio 20 Bs.
                        </p>
                         <p class="mt-2">
                            <span class="font-semibold">Cuándo usarlo:</span> Es el método más justo y recomendado para la mayoría de los casos, especialmente en compras de productos variados. Contablemente, asume que los artículos más valiosos son más caros de asegurar, manejar y transportar.
                        </p>
                    </div>
                </div>
            <//>
        <//>
    `;
}