/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../../lib/supabaseClient.js';
import { Spinner } from '../../components/Spinner.js';
import { ICONS } from '../../components/Icons.js';
import { ServiVentLogo } from '../../components/Logo.js';

export function ReciboLicenciaPage({ pagoId, companyInfo }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { data: result, error: rpcError } = await supabase.rpc('get_my_payment_receipt_details', { p_pago_id: pagoId });
                if (rpcError) throw rpcError;
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (pagoId) {
            fetchData();
        }
    }, [pagoId]);

    const formatCurrency = (value, symbol) => {
        const number = Number(value || 0);
        return `${symbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return html`<div class="flex items-center justify-center h-screen"><${Spinner} color="text-primary" size="h-10 w-10" /></div>`;
    }

    if (error) {
        return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-red-600">Error al Cargar Recibo</h2><p>${error}</p></div>`;
    }

    if (!data) {
        return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-gray-600">Recibo no encontrado.</h2></div>`;
    }

    const { receipt, company } = data;
    const serviventNit = "5196315016"; 
    const serviventAddress = "Equipetrol Norte, Santa Cruz, Bolivia";

    const getCurrencySymbol = (code) => ({'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$', 'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L', 'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/', 'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'}[code] || code);
    const symbol = getCurrencySymbol(company.moneda);
    
    // --- Valores Derivados para Robustez ---
    // Si el concepto está vacío, usa un valor por defecto.
    const concepto = receipt.concepto || 'Suscripción de Licencia';
    // Si el precio del plan no existe o es cero, calcúlalo a partir del monto y el descuento.
    const precioPlan = receipt.precio_plan > 0 
        ? receipt.precio_plan 
        : (Number(receipt.monto || 0) + Number(receipt.descuento || 0));

    return html`
        <div class="bg-slate-100 min-h-screen p-4 sm:p-8">
            <div class="max-w-3xl mx-auto bg-white shadow-lg rounded-lg">
                <header class="p-8 border-b">
                    <div class="flex justify-between items-start">
                        <div>
                            <${ServiVentLogo} />
                            <div class="mt-2 text-xs text-gray-500">
                                <p>NIT: ${serviventNit}</p>
                                <p>${serviventAddress}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h1 class="text-2xl font-bold text-gray-800 uppercase tracking-wide">Recibo de Pago</h1>
                            <p class="text-sm text-gray-500">N°: <span class="font-mono">${receipt.id.substring(0, 8).toUpperCase()}</span></p>
                            <p class="text-sm text-gray-500">Fecha: <span class="font-medium">${new Date(receipt.fecha_pago).toLocaleDateString()}</span></p>
                        </div>
                    </div>
                    <div class="mt-8">
                        <h2 class="text-sm font-semibold text-gray-500">CLIENTE</h2>
                        <div class="mt-1 text-gray-800">
                            <p class="font-bold">${company.nombre}</p>
                            <p>NIT: ${company.nit}</p>
                            <p>${company.propietario_nombre}</p>
                        </div>
                    </div>
                </header>
                <main class="p-8">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b-2 border-gray-300 text-sm text-gray-600">
                                <th class="py-2">Concepto</th>
                                <th class="py-2 text-right">Precio del Plan</th>
                                <th class="py-2 text-right">Descuento</th>
                                <th class="py-2 text-right">Monto Pagado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="border-b">
                                <td class="py-4 font-medium text-gray-800">${concepto}</td>
                                <td class="py-4 text-right text-gray-800">${formatCurrency(precioPlan, symbol)}</td>
                                <td class="py-4 text-right text-red-600">-${formatCurrency(receipt.descuento, symbol)}</td>
                                <td class="py-4 text-right font-bold text-gray-900">${formatCurrency(receipt.monto, symbol)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="mt-6 flex justify-end">
                        <div class="w-full max-w-xs">
                            <div class="flex justify-between text-lg font-bold text-gray-900 border-t-2 border-gray-300 pt-2">
                                <span>TOTAL PAGADO</span>
                                <span>${formatCurrency(receipt.monto, symbol)}</span>
                            </div>
                        </div>
                    </div>
                    ${receipt.notas && html`
                        <div class="mt-8 border-t pt-4">
                            <h3 class="text-sm font-semibold text-gray-600">Notas Adicionales</h3>
                            <p class="text-sm text-gray-500 mt-1">${receipt.notas}</p>
                        </div>
                    `}
                </main>
            </div>
            <div class="text-center mt-6 no-print flex justify-center items-center gap-4">
                <button onClick=${() => window.history.back()} class="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                    ${ICONS.arrow_back} Volver
                </button>
                <button onClick=${handlePrint} class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                    ${ICONS.download} Imprimir / Guardar como PDF
                </button>
            </div>
        </div>
    `;
}
