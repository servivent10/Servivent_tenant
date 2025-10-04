/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { useConnectivity } from '../hooks/useRealtime.js';
import { ICONS } from './Icons.js';

const ConnectivityPanel = ({ log, onReconnect }) => {
    const formatTime = (date) => date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const getIconForType = (type) => {
        switch (type) {
            case 'success': return html`<div class="text-emerald-500">${ICONS.success}</div>`;
            case 'error': return html`<div class="text-red-500">${ICONS.error}</div>`;
            case 'info': return html`<div class="text-blue-500">${ICONS.info}</div>`;
            default: return html`<div class="text-gray-400">${ICONS.info}</div>`;
        }
    };
    
    return html`
        <div class="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-fade-in-down" role="dialog">
            <div class="p-4 border-b">
                <h3 class="text-base font-semibold text-gray-900">Centro de Conectividad</h3>
            </div>
            <div class="max-h-60 overflow-y-auto p-2">
                ${log.length > 0 ? log.map(entry => html`
                    <div key=${entry.time.toISOString()} class="flex items-start gap-2 p-2 text-sm text-gray-700">
                        <div class="flex-shrink-0 mt-0.5">${getIconForType(entry.type)}</div>
                        <div class="flex-1">
                            <p>${entry.message}</p>
                            <p class="text-xs text-gray-400">${formatTime(entry.time)}</p>
                        </div>
                    </div>
                `) : html`
                    <p class="p-4 text-sm text-center text-gray-500">No hay eventos de conexión recientes.</p>
                `}
            </div>
            <div class="p-4 border-t bg-gray-50">
                <button onClick=${onReconnect} class="w-full flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                    ${ICONS.refresh} Intentar Reconectar
                </button>
            </div>
        </div>
    `;
};


export function ConnectivityCenter() {
    const { supabaseStatus, isOnline, log, forceReconnect } = useConnectivity();
    const [isPanelOpen, setPanelOpen] = useState(false);
    const wrapperRef = useRef(null);

    const combinedStatus = useMemo(() => {
        if (!isOnline) return 'OFFLINE';
        if (supabaseStatus === 'SUBSCRIBED') return 'CONNECTED';
        if (supabaseStatus === 'TIMED_OUT' || supabaseStatus === 'CHANNEL_ERROR') return 'ERROR';
        return 'CONNECTING'; // CONNECTING or CLOSED
    }, [supabaseStatus, isOnline]);

    const statusInfo = {
        OFFLINE: {
            icon: ICONS.wifi_off,
            color: 'text-red-500',
            text: 'Sin conexión a internet.',
            animation: '',
        },
        ERROR: {
            icon: ICONS.wifi_off,
            color: 'text-red-500',
            text: 'Error de conexión con el servidor.',
            animation: 'animate-icon-pulse',
        },
        CONNECTING: {
            icon: ICONS.wifi,
            color: 'text-yellow-500',
            text: 'Conectando en tiempo real...',
            animation: 'animate-icon-pulse',
        },
        CONNECTED: {
            icon: ICONS.success,
            color: 'text-green-500',
            text: 'Conectado en tiempo real.',
            animation: '',
        },
    };

    const currentStatus = statusInfo[combinedStatus];
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return html`
        <div ref=${wrapperRef} class="relative">
            <button
                onClick=${() => setPanelOpen(prev => !prev)}
                type="button"
                class="flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
                title=${currentStatus.text}
                aria-label="Estado de la conexión"
            >
                <div class="text-2xl ${currentStatus.color} ${currentStatus.animation}">
                    ${currentStatus.icon}
                </div>
            </button>
            ${isPanelOpen && html`<${ConnectivityPanel} log=${log} onReconnect=${forceReconnect} />`}
        </div>
    `;
}