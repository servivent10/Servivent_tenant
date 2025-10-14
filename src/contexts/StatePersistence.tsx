/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useContext, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';

interface CartItem {
    product: any;
    quantity: number;
}

interface CatalogCartItem {
    quantity: number;
    [key: string]: any;
}


// --- TerminalVenta Context ---
const TerminalVentaContext = createContext(null);
export const useTerminalVenta = () => useContext(TerminalVentaContext);

export function TerminalVentaProvider({ children }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customPrices, setCustomPrices] = useState({});
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [activePriceListId, setActivePriceListId] = useState(null);
    const [taxRate, setTaxRate] = useState('');
    const [discountValue, setDiscountValue] = useState('');

    const value = {
        cart, setCart,
        customPrices, setCustomPrices,
        selectedClientId, setSelectedClientId,
        activePriceListId, setActivePriceListId,
        taxRate, setTaxRate,
        discountValue, setDiscountValue
    };

    return html`<${TerminalVentaContext.Provider} value=${value}>${children}<//>`;
}

// --- NuevaCompra Context ---
const NuevaCompraContext = createContext(null);
export const useNuevaCompra = () => useContext(NuevaCompraContext);

export function NuevaCompraProvider({ children }) {
    const [formData, setFormData] = useState({
        proveedor_id: '',
        proveedor_nombre: '',
        sucursal_id: null, // Initialized as null, will be set by the page component
        fecha: new Date().toISOString(),
        n_factura: '',
        moneda: 'BOB',
        tasa_cambio: '6.96',
        items: [],
        tipo_pago: 'Contado',
        fecha_vencimiento: '',
        abono_inicial: '0',
        metodo_abono_inicial: 'Efectivo',
    });

    return html`<${NuevaCompraContext.Provider} value=${{ formData, setFormData }}>${children}<//>`;
}

// --- ProductForm Context ---
const ProductFormContext = createContext(null);
export const useProductForm = () => useContext(ProductFormContext);

export function ProductFormProvider({ children }) {
    const getInitialDraft = () => ({
        formData: {
            nombre: '', sku: '', marca: '', modelo: '',
            descripcion: '', categoria_id: '', unidad_medida: 'Unidad'
        },
        imageFiles: [],
        imagePreviews: [],
    });

    const [draft, setDraft] = useState(getInitialDraft());
    const clearDraft = () => setDraft(getInitialDraft());

    const value = { draft, setDraft, clearDraft };

    return html`<${ProductFormContext.Provider} value=${value}>${children}<//>`;
}


// --- CatalogCart Context ---
const CatalogCartContext = createContext(null);
export const useCatalogCart = () => useContext(CatalogCartContext);

export function CatalogCartProvider({ children }) {
    const [cart, setCart] = useState<CatalogCartItem[]>([]);
    return html`<${CatalogCartContext.Provider} value=${{ cart, setCart }}>${children}<//>`;
}