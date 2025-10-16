/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext } from 'preact';
import { useState, useContext, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';

// --- Type Definitions for Contexts ---

type StateUpdater<S> = (value: S | ((prevState: S) => S)) => void;

interface CartItem {
    product: any;
    quantity: number;
}

interface CatalogCartItem {
    id: string; // Assuming product has an id
    quantity: number;
    [key: string]: any;
}

interface TerminalVentaContextValue {
    cart: CartItem[];
    setCart: StateUpdater<CartItem[]>;
    customPrices: { [key: string]: { newPrice: number } };
    setCustomPrices: StateUpdater<{ [key: string]: { newPrice: number } }>;
    selectedClientId: string | null;
    setSelectedClientId: StateUpdater<string | null>;
    activePriceListId: string | null;
    setActivePriceListId: StateUpdater<string | null>;
    taxRate: string;
    setTaxRate: StateUpdater<string>;
    discountValue: string;
    setDiscountValue: StateUpdater<string>;
}

interface NuevaCompraFormData {
    proveedor_id: string;
    proveedor_nombre: string;
    sucursal_id: string | null;
    fecha: string;
    n_factura: string;
    moneda: 'BOB' | 'USD';
    tasa_cambio: string;
    items: any[];
    tipo_pago: 'Contado' | 'Crédito';
    fecha_vencimiento: string;
    abono_inicial: string;
    metodo_abono_inicial: string;
}

interface NuevaCompraContextValue {
    formData: NuevaCompraFormData;
    setFormData: StateUpdater<NuevaCompraFormData>;
}

interface ProductFormDraft {
    formData: {
        nombre: string; sku: string; marca: string; modelo: string;
        descripcion: string; categoria_id: string; unidad_medida: string;
    };
    imageFiles: File[];
    imagePreviews: string[];
}

interface ProductFormContextValue {
    draft: ProductFormDraft;
    setDraft: StateUpdater<ProductFormDraft>;
    clearDraft: () => void;
}

interface CatalogCartContextValue {
    cart: CatalogCartItem[];
    setCart: StateUpdater<CatalogCartItem[]>;
}


// --- TerminalVenta Context ---
const TerminalVentaContext = createContext<TerminalVentaContextValue | null>(null);
export const useTerminalVenta = () => {
    const context = useContext(TerminalVentaContext);
    if (!context) {
        throw new Error('useTerminalVenta must be used within a TerminalVentaProvider');
    }
    return context;
};

export function TerminalVentaProvider({ children }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customPrices, setCustomPrices] = useState<{ [key: string]: { newPrice: number } }>({});
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [activePriceListId, setActivePriceListId] = useState<string | null>(null);
    const [taxRate, setTaxRate] = useState('');
    const [discountValue, setDiscountValue] = useState('');

    const value: TerminalVentaContextValue = {
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
const NuevaCompraContext = createContext<NuevaCompraContextValue | null>(null);
export const useNuevaCompra = () => {
    const context = useContext(NuevaCompraContext);
    if (!context) {
        throw new Error('useNuevaCompra must be used within a NuevaCompraProvider');
    }
    return context;
};

export function NuevaCompraProvider({ children }) {
    const [formData, setFormData] = useState<NuevaCompraFormData>({
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

    const value: NuevaCompraContextValue = { formData, setFormData };

    return html`<${NuevaCompraContext.Provider} value=${value}>${children}<//>`;
}

// --- ProductForm Context ---
const ProductFormContext = createContext<ProductFormContextValue | null>(null);
export const useProductForm = () => {
    const context = useContext(ProductFormContext);
    if (!context) {
        throw new Error('useProductForm must be used within a ProductFormProvider');
    }
    return context;
};

export function ProductFormProvider({ children }) {
    const getInitialDraft = (): ProductFormDraft => ({
        formData: {
            nombre: '', sku: '', marca: '', modelo: '',
            descripcion: '', categoria_id: '', unidad_medida: 'Unidad'
        },
        imageFiles: [],
        imagePreviews: [],
    });

    const [draft, setDraft] = useState<ProductFormDraft>(getInitialDraft());
    const clearDraft = () => setDraft(getInitialDraft());

    const value: ProductFormContextValue = { draft, setDraft, clearDraft };

    return html`<${ProductFormContext.Provider} value=${value}>${children}<//>`;
}


// --- CatalogCart Context ---
const CatalogCartContext = createContext<CatalogCartContextValue | null>(null);
export const useCatalogCart = () => {
    const context = useContext(CatalogCartContext);
    if (!context) {
        throw new Error('useCatalogCart must be used within a CatalogCartProvider');
    }
    return context;
};

export function CatalogCartProvider({ children }) {
    const [cart, setCart] = useState<CatalogCartItem[]>([]);
    const value: CatalogCartContextValue = { cart, setCart };
    return html`<${CatalogCartContext.Provider} value=${value}>${children}<//>`;
}