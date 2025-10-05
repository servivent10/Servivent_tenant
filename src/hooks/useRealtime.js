/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useEffect, useContext, useCallback, useRef } from 'preact/hooks';
import { html } from 'htm/preact';
import { supabase } from '../lib/supabaseClient.js';
import { useToast } from './useToast.js';

const RealtimeContext = createContext(null);

// Debounce function to prevent excessive re-renders from rapid-fire events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function RealtimeProvider({ children }) {
    const { addToast } = useToast();
    const [supabaseStatus, setSupabaseStatus] = useState('CONNECTING');
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    const [log, setLog] = useState([]);
    const [changeCounter, setChangeCounter] = useState(0);
    const channelRef = useRef(null);
    const disconnectTimeRef = useRef(null);
    
    const addLogEntry = useCallback((type, message) => {
        const newEntry = { type, message, time: new Date() };
        setLog(prev => [newEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
    }, []);

    const forceReconnect = useCallback(() => {
        if (channelRef.current) {
            addLogEntry('info', 'Intentando reconectar...');
            channelRef.current.subscribe();
        }
    }, []);

    useEffect(() => {
        const handleOffline = () => {
            disconnectTimeRef.current = new Date();
            setIsOnline(false);
            addLogEntry('error', 'Sin conexión a internet.');
            addToast({ message: 'Se perdió la conexión a internet. Algunas funciones están desactivadas.', type: 'warning', duration: 10000 });
        };
        const handleOnline = () => {
            setIsOnline(true);
            const duration = disconnectTimeRef.current ? Math.round((new Date() - disconnectTimeRef.current.getTime()) / 1000) : 0;
            const message = `Conexión a internet restaurada (desconectado ${duration}s).`;
            addLogEntry('success', message);
            addToast({ message: 'Conexión a internet restaurada.', type: 'success' });
            forceReconnect();
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [addToast, addLogEntry, forceReconnect]);

    const incrementChangeCounter = useCallback(() => {
        setChangeCounter(c => c + 1);
    }, []);

    const debouncedIncrement = useCallback(debounce(incrementChangeCounter, 150), [incrementChangeCounter]);

    useEffect(() => {
        addLogEntry('info', 'Inicializando conexión en tiempo real...');
        const channel = supabase.channel('db-changes');

        channel.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            console.log(
                '%c[REALTIME EVENT RECEIVED]',
                'color: lime; font-weight: bold; background-color: black; padding: 2px 5px; border-radius: 3px;',
                payload
            );
            
            const tablesToWatch = {
                productos: 'El catálogo de productos se ha actualizado.',
                inventarios: 'El inventario se ha actualizado.',
                precios_productos: 'Los precios se han actualizado.',
                ventas: 'Se ha registrado una nueva venta.',
                compras: 'Se ha registrado una nueva compra.',
                clientes: 'La lista de clientes se ha actualizado.',
                proveedores: 'La lista de proveedores se ha actualizado.',
                gastos: 'Se ha registrado un nuevo gasto.',
            };

            if (tablesToWatch[payload.table]) {
                addToast({ message: tablesToWatch[payload.table], type: 'info', duration: 3000 });
                debouncedIncrement();
            }
        });

        channel.subscribe((status, err) => {
            setSupabaseStatus(status);
            if (err) {
                addLogEntry('error', `Error de canal: ${err.message}`);
            } else if (status === 'SUBSCRIBED') {
                addLogEntry('success', 'Conectado al servidor en tiempo real.');
            } else if (status === 'TIMED_OUT') {
                addLogEntry('error', 'Tiempo de conexión con el servidor agotado.');
            } else if (status === 'CHANNEL_ERROR') {
                addLogEntry('error', 'Error en el canal del servidor.');
            }
        });
        
        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [addToast, addLogEntry, debouncedIncrement]);
    
    const value = { supabaseStatus, isOnline, log, forceReconnect, changeCounter };

    return html`
        <${RealtimeContext.Provider} value=${value}>
            ${children}
        <//>
    `;
}

export const useConnectivity = () => useContext(RealtimeContext);

export const useRealtimeListener = (callback) => {
    const { changeCounter } = useContext(RealtimeContext);
    
    const savedCallback = useRef(callback);
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (changeCounter > 0) {
            console.log('Realtime change counter triggered callback.');
            savedCallback.current();
        }
    }, [changeCounter]);
};