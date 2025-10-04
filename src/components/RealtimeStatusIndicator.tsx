/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useRealtimeStatus } from '../hooks/useRealtime.js';

export function RealtimeStatusIndicator() {
    const status = useRealtimeStatus();

    const statusInfo = {
        CONNECTING: { color: 'bg-yellow-400', text: 'Conectando a tiempo real...' },
        SUBSCRIBED: { color: 'bg-green-500', text: 'Conectado en tiempo real' },
        TIMED_OUT: { color: 'bg-red-500', text: 'Error de conexión (Timeout)' },
        CLOSED: { color: 'bg-gray-400', text: 'Desconectado de tiempo real' },
        CHANNEL_ERROR: { color: 'bg-red-500', text: 'Error en el canal de tiempo real' },
    };

    const currentStatus = statusInfo[status] || statusInfo.CLOSED;
    const isConnecting = status === 'CONNECTING';
    const isSubscribed = status === 'SUBSCRIBED';

    return html`
        <div class="group relative flex items-center" title=${currentStatus.text}>
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
                <span class="relative flex h-2.5 w-2.5">
                    ${(isConnecting || isSubscribed) && html`<span class="animate-ping absolute inline-flex h-full w-full rounded-full ${currentStatus.color} opacity-75"></span>`}
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${currentStatus.color}"></span>
                </span>
            </div>
        </div>
    `;
}