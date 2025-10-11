/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { ICONS } from '../Icons.js';

export function HistorialCajaDetailModal({ isOpen, onClose, session, companyInfo }) {
    if (!isOpen || !session) return null;

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        return number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const diferenciaColor = session.diferencia_efectivo > 0.005 ? 'text-green-600' : (session.diferencia_efectivo < -0.005 ? 'text-red-600' : 'text-gray-800');
    const diferenciaLabel = session.diferencia_efectivo > 0.005 ? 'Sobrante' : (session.diferencia_efectivo < -0.005 ? 'Faltante' : 'Cuadrado');
    const totalVentasDigitales = (session.total_ventas_tarjeta || 0) + (session.total_ventas_qr || 0) + (session.total_ventas_transferencia || 0);

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
            onConfirm=${onClose}
            title="Detalle de Arqueo de Caja"
            confirmText="Cerrar"
            icon=${ICONS.history_edu}
            maxWidthClass="max-w-xl"
        >
            <div class="space-y-6">
                 <div class="p-3 bg-slate-50 rounded-lg border grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt class="text-gray-500">Sucursal</dt><dd class="font-medium text-gray-800">${session.sucursal_nombre}</dd></div>
                    <div><dt class="text-gray-500">Usuario de Cierre</dt><dd class="font-medium text-gray-800">${session.usuario_cierre_nombre}</dd></div>
                    <div><dt class="text-gray-500">Fecha de Apertura</dt><dd class="font-medium text-gray-800">${new Date(session.fecha_apertura).toLocaleString()}</dd></div>
                    <div><dt class="text-gray-500">Fecha de Cierre</dt><dd class="font-medium text-gray-800">${new Date(session.fecha_cierre).toLocaleString()}</dd></div>
                 </div>

                <section>
                    <h3 class="text-base font-semibold text-gray-900 border-b pb-2 mb-2">Arqueo de Efectivo</h3>
                    <dl>
                        <${DetailRow} label="Saldo Inicial" value=${session.saldo_inicial} />
                        <${DetailRow} label="(+) Ventas en Efectivo" value=${session.total_ventas_efectivo} colorClass="text-green-600" />
                        <${DetailRow} label="(-) Gastos Pagados en Efectivo" value=${session.total_gastos_efectivo} colorClass="text-red-600" />
                        <${DetailRow} label="(=) Saldo Teórico en Caja" value=${session.saldo_final_teorico_efectivo} isBold=${true} />
                        <${DetailRow} label="Saldo Real Contado (Físico)" value=${session.saldo_final_real_efectivo} isBold=${true} colorClass="text-blue-600" />
                    </dl>
                    <div class="flex justify-between py-2 mt-2 bg-slate-100 px-3 rounded-md">
                        <dt class="text-sm font-bold text-gray-700">Diferencia (${diferenciaLabel})</dt>
                        <dd class="text-sm font-bold ${diferenciaColor}">${companyInfo.monedaSimbolo} ${formatCurrency(session.diferencia_efectivo)}</dd>
                    </div>
                </section>

                <section>
                    <h3 class="text-base font-semibold text-gray-900 border-b pb-2 mb-2">Resumen de Pagos Digitales</h3>
                    <dl>
                        <${DetailRow} label="(+) Ventas con Tarjeta" value=${session.total_ventas_tarjeta} colorClass="text-blue-600" />
                        <${DetailRow} label="(+) Ventas con QR" value=${session.total_ventas_qr} colorClass="text-blue-600" />
                        <${DetailRow} label="(+) Ventas con Transferencia" value=${session.total_ventas_transferencia} colorClass="text-blue-600" />
                        <${DetailRow} label="(=) Total Registrado (Digital)" value=${totalVentasDigitales} isBold=${true} />
                    </dl>
                </section>
                
                <section>
                     <div class="flex justify-between py-2 mt-2 bg-primary-light px-3 rounded-md">
                        <dt class="text-base font-bold text-primary-dark">TOTAL VENTAS DE LA SESIÓN</dt>
                        <dd class="text-base font-bold text-primary-dark">${companyInfo.monedaSimbolo} ${formatCurrency(session.total_ventas)}</dd>
                    </div>
                </section>
            </div>
        <//>
    `;
}