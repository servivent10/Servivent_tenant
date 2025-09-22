/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useContext, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';

export const LoadingContext = createContext(null);

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    const startLoading = useCallback(() => setIsLoading(true), []);
    const stopLoading = useCallback(() => setIsLoading(false), []);

    const contextValue = { isLoading, startLoading, stopLoading };

    return html`
        <${LoadingContext.Provider} value=${contextValue}>
            ${children}
        <//>
    `;
};
