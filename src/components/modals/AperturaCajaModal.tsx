/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ICONS } from '../Icons.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

export function AperturaCajaModal({ onSessionOpen, companyInfo, navigate, user, modoCaja }) {
    const [saldoInicial, setSaldoInicial] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const handleOpenSession = async () => {
        const monto = Number(saldoInicial);
        if (isNaN(monto) || monto < 0) {
            addToast({ message: 'Por favor, ingresa un monto inicial válido.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('abrir_caja', { p_saldo_inicial: monto });
            if (error) throw error;
            addToast({ message: 'Caja abierta. ¡Listo para vender!', type: 'success' });
            onSessionOpen();
        } catch (err) {
            addToast({ message: `Error al abrir la caja: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const isEmployeeWaiting = modoCaja === 'por_sucursal' && user.role === 'Empleado';
    const targetName = modoCaja === 'por_usuario' ? user.name : user.sucursal;
    const targetType = modoCaja === 'por_usuario' ? 'el usuario' : 'la sucursal';

    return html`
        <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
            <div class="relative w-full max-w-md rounded-xl bg-white text-gray-900 shadow-2xl p-6 space-y-4">
                ${isEmployeeWaiting ? html`
                    <div class="text-center">
                        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            ${ICONS.warning}
                        </div>
                        <h2 class="mt-4 text-xl font-bold">Caja de Sucursal Cerrada</h2>
                        <p class="mt-2 text-sm text-gray-600">
                            Para poder registrar ventas, un <strong>Propietario</strong> o <strong>Administrador</strong> debe primero realizar la apertura de caja para la sucursal <strong>${user.sucursal}</strong>.
                        </p>
                        <p class="mt-2 text-sm text-gray-500">
                           Por favor, espera a que se abra la caja para continuar.
                        </p>
                    </div>
                     <button 
                        onClick=${() => navigate('/dashboard')}
                        class="w-full text-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Volver al Dashboard
                    </button>
                ` : html`
                    <div class="text-center">
                        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
                            ${ICONS.savings}
                        </div>
                        <h2 class="mt-4 text-xl font-bold">Apertura de Caja</h2>
                        <p class="mt-1 text-sm text-gray-600">
                            Estás abriendo la caja para <span class="font-semibold text-gray-800">${targetType} "${targetName}"</span>.
                        </p>
                        <p class="mt-2 text-sm text-gray-600">Ingresa el monto inicial de efectivo en tu gaveta para poder registrar ventas.</p>
                    </div>
                    <div class="relative">
                         <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pt-8 text-gray-500">${companyInfo.monedaSimbolo}</span>
                         <${FormInput}
                            label="Saldo Inicial en Efectivo"
                            name="saldo_inicial"
                            type="number"
                            value=${saldoInicial}
                            onInput=${(e) => setSaldoInicial(e.target.value)}
                            placeholder="0.00"
                            className="pl-9 pr-2 text-right"
                            theme="light"
                        />
                    </div>
                     <button 
                        onClick=${handleOpenSession}
                        disabled=${isLoading}
                        class="w-full flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400"
                    >
                        ${isLoading ? html`<${Spinner}/>` : 'Abrir Caja e Iniciar Sesión'}
                    </button>
                    <button 
                        onClick=${() => navigate('/dashboard')}
                        class="w-full text-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                `}
            </div>
        </div>
    `;
}