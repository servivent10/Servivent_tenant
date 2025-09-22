/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useContext, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';
import { ToastContainer } from '../components/ToastContainer.js';

export const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

let toastIdCounter = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        const id = toastIdCounter++;
        setToasts(currentToasts => [...currentToasts, { id, ...toast }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
    }, []);

    const contextValue = { toasts, addToast, removeToast };

    return html`
        <${ToastContext.Provider} value=${contextValue}>
            ${children}
            <${ToastContainer} />
        <//>
    `;
};
