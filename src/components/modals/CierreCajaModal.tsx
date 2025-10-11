/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ICONS } from '../Icons.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { ConfirmationModal } from '../ConfirmationModal.js';

export function CierreCajaModal({ isOpen, onClose, onConfirm, sessionSummary, companyInfo, user, modoCaja }) {
    const [saldoReal, setSaldoReal] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen && sessionSummary) {
            // Suggest the theoretical amount as the default for the real amount
            setSaldoReal(sessionSummary.saldo_final_teorico_efectivo.toFixed(2));
        }
    }, [isOpen, sessionSummary]);

    if (!isOpen) return null;

    const isEmployeeForbidden = modoCaja === 'por_sucursal' && user.role === 'Empleado';

    if (isEmployeeForbidden) {
        return html`
            <${ConfirmationModal}
                isOpen=${isOpen}
                onClose=${onClose}
                onConfirm=${onClose}
                title="Permiso Requerido"
                confirmText="Entendido"
                icon=${ICONS.warning_amber}
            >
                <div class="text-center">
                    <p class="text-sm text-gray-600">
                        Solo un <strong>Propietario</strong> o <strong>Administrador</strong> puede realizar el cierre de la caja de esta sucursal.
                    </p>
                    <p class="mt-2 text-sm text-gray-500">
                        Por favor, solicita a un supervisor que realice esta acción.
                    </p>
                </div>
            <//>
        `;
    }
    
    if (!sessionSummary) return null;

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        return number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const saldoTeorico = sessionSummary.saldo_final_teorico_efectivo;
    const diferencia = Number(saldoReal) - saldoTeorico;
    
    const diferenciaColor = diferencia > 0.005 ? 'text-green-600' : (diferencia < -0.005 ? 'text-red-600' : 'text-gray-800');
    const diferenciaLabel = diferencia > 0.005 ? 'Sobrante' : (diferencia < -0.005 ? 'Faltante' : 'Cuadrado');

    const totalVentasDigitales = sessionSummary.total_ventas_tarjeta + sessionSummary.total_ventas_qr + sessionSummary.total_ventas_transferencia;
    const totalVentasSesion = sessionSummary.total_ventas_efectivo + totalVentasDigitales;

    const handleConfirm = async () => {
        setIsProcessing(true);
        const totalsToSave = {
            total_ventas_efectivo: sessionSummary.total_ventas_efectivo,
            total_gastos_efectivo: sessionSummary.total_gastos_efectivo,
            total_ventas_tarjeta: sessionSummary.total_ventas_tarjeta,
            total_ventas_qr: sessionSummary.total_ventas_qr,
            total_ventas_transferencia: sessionSummary.total_ventas_transferencia
        };
        await onConfirm(Number(saldoReal), totalsToSave);
        setIsProcessing(false);
    };

    const DetailRow = ({ label, value, isBold = false, colorClass = 'text-gray-800' }) => html`
        <div class="flex justify-between py-2 border-b">
            <dt class="text-sm text-gray-600">${label}</dt>
            <dd class="text-sm font-semibold ${colorClass} ${isBold ? 'font-bold' : ''}">${companyInfo.monedaSimbolo} ${formatCurrency(value)}</dd>
        </div>
    `;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title="Cierre y Arqueo de Terminal"
            confirmText=${isProcessing ? html`<${Spinner}/>` : 'Confirmar y Cerrar Caja'}
            icon=${ICONS.savings}
            maxWidthClass="max-w-xl"
        >
            <div class="space-y-6">
                <!-- Sección 1: Arqueo de Efectivo -->
                <section>
                    <h3 class="text-base font-semibold text-gray-900 border-b pb-2 mb-2">1. Arqueo de Efectivo</h3>
                    <dl>
                        <${DetailRow} label="Saldo Inicial" value=${sessionSummary.saldo_inicial} />
                        <${DetailRow} label="(+) Ventas en Efectivo" value=${sessionSummary.total_ventas_efectivo} colorClass="text-green-600" />
                        <${DetailRow} label="(-) Gastos Pagados en Efectivo" value=${sessionSummary.total_gastos_efectivo} colorClass="text-red-600" />
                        <${DetailRow} label="(=) Saldo Teórico en Caja" value=${saldoTeorico} isBold=${true} />
                    </dl>
                    <div class="mt-4">
                        <${FormInput} label="Saldo Real Contado (Físico)" name="saldo_real" type="number" value=${saldoReal} onInput=${(e) => setSaldoReal(e.target.value)} />
                    </div>
                    <div class="flex justify-between py-2 mt-2 bg-slate-100 px-3 rounded-md">
                        <dt class="text-sm font-bold text-gray-700">Diferencia (${diferenciaLabel})</dt>
                        <dd class="text-sm font-bold ${diferenciaColor}">${companyInfo.monedaSimbolo} ${formatCurrency(diferencia)}</dd>
                    </div>
                </section>

                <!-- Sección 2: Pagos Digitales -->
                <section>
                    <h3 class="text-base font-semibold text-gray-900 border-b pb-2 mb-2">2. Resumen de Pagos Digitales</h3>
                    <dl>
                        <${DetailRow} label="(+) Ventas con Tarjeta" value=${sessionSummary.total_ventas_tarjeta} colorClass="text-blue-600" />
                        <${DetailRow} label="(+) Ventas con QR" value=${sessionSummary.total_ventas_qr} colorClass="text-blue-600" />
                        <${DetailRow} label="(+) Ventas con Transferencia" value=${sessionSummary.total_ventas_transferencia} colorClass="text-blue-600" />
                        <${DetailRow} label="(=) Total Registrado (Digital)" value=${totalVentasDigitales} isBold=${true} />
                    </dl>
                </section>
                
                <!-- Sección 3: Gran Total -->
                <section>
                     <h3 class="text-base font-semibold text-gray-900 border-b pb-2 mb-2">3. Gran Total de la Sesión</h3>
                     <dl>
                        <${DetailRow} label="Total Ventas en Efectivo" value=${sessionSummary.total_ventas_efectivo} />
                        <${DetailRow} label="Total Ventas Digitales" value=${totalVentasDigitales} />
                        <div class="flex justify-between py-2 mt-2 bg-primary-light px-3 rounded-md">
                            <dt class="text-base font-bold text-primary-dark">TOTAL VENTAS DE LA SESIÓN</dt>
                            <dd class="text-base font-bold text-primary-dark">${companyInfo.monedaSimbolo} ${formatCurrency(totalVentasSesion)}</dd>
                        </div>
                     </dl>
                </section>
            </div>
        <//>
    `;
}