/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useEffect, useContext, useCallback, useRef } from 'preact/hooks';
import { html } from 'htm/preact';
import { supabase } from '../lib/supabaseClient.js';
import { useToast } from './useToast.js';

const RealtimeContext = createContext({ status: 'CONNECTING', changeCounter: 0 });

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
    const [status, setStatus] = useState('CONNECTING');
    const [changeCounter, setChangeCounter] = useState(0);

    const incrementChangeCounter = useCallback(() => {
        setChangeCounter(c => c + 1);
    }, []);

    const debouncedIncrement = useCallback(debounce(incrementChangeCounter, 150), [incrementChangeCounter]);

    useEffect(() => {
        const channel = supabase.channel('db-changes');

        channel.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            // =================================================================
            // INICIO DE LA MODIFICACIÓN PARA DEPURACIÓN
            // =================================================================
            // Este console.log es CRUCIAL. Imprimirá CUALQUIER evento que llegue
            // al navegador a través de este canal, antes de cualquier filtro.
            console.log(
                '%c[REALTIME EVENT RECEIVED]',
                'color: lime; font-weight: bold; background-color: black; padding: 2px 5px; border-radius: 3px;',
                payload
            );
            // =================================================================
            // FIN DE LA MODIFICACIÓN PARA DEPURACIÓN
            // =================================================================

            const tablesToWatch = {
                productos: 'El catálogo de productos se ha actualizado.',
                inventarios: 'El inventario se ha actualizado.',
                precios_productos: 'Los precios se han actualizado.',
                ventas: 'Se ha registrado una nueva venta.',
                compras: 'Se ha registrado una nueva compra.',
                clientes: 'La lista de clientes se ha actualizado.',
                proveedores: 'La lista de proveedores se ha actualizado.',
            };

            if (tablesToWatch[payload.table]) {
                addToast({ message: tablesToWatch[payload.table], type: 'info', duration: 3000 });
                debouncedIncrement();
            }
        });

        channel.subscribe((status, err) => {
            console.log(`Realtime channel status: ${status}`);
            setStatus(status);
            if (err) {
                console.error('Realtime channel subscription error:', err);
                addToast({ message: `Error en tiempo real: ${err.message}`, type: 'error' });
            }
        });

        return () => {
            console.log('Removing realtime channel.');
            supabase.removeChannel(channel);
        };
    }, [addToast, debouncedIncrement]);

    const value = { status, changeCounter };

    return html`
        <${RealtimeContext.Provider} value=${value}>
            ${children}
        <//>
    `;
}

export const useRealtimeStatus = () => {
    const { status } = useContext(RealtimeContext);
    return status;
};

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