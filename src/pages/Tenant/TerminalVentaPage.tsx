/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { useLoading } from '../../hooks/useLoading.js';

// --- MOCK DATA ---
const mockClients = [
    { id: '1', name: 'Consumidor Final' },
    { id: '2', name: 'Juan Perez' },
    { id: '3', name: 'Empresa XYZ S.R.L.' }
];
// --- END MOCK DATA ---

const StockCheckModal = ({ isOpen, onClose, product, currentUserSucursal }) => {
    if (!product) return null;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${onClose}
            title="Consulta de Stock"
            confirmText="Cerrar"
            icon=${ICONS.inventory}
            maxWidthClass="max-w-md"
        >
            <div class="space-y-4 text-sm text-gray-600">
                <p>Mostrando stock para: <span class="font-bold text-gray-800">${product.nombre}</span></p>
                <ul class="max-h-64 overflow-y-auto divide-y divide-gray-200 border-t border-b -mx-6 px-6">
                    ${product.all_branch_stock.map(stockInfo => {
                        const isCurrentUserSucursal = stockInfo.sucursal_nombre === currentUserSucursal;
                        return html`
                            <li class="flex justify-between items-center py-3 ${isCurrentUserSucursal ? 'bg-blue-50 -mx-6 px-6' : ''}">
                                <span class="font-medium text-gray-800">${stockInfo.sucursal_nombre} ${isCurrentUserSucursal ? html`<span class="ml-2 text-xs font-bold text-primary">(Tu Sucursal)</span>` : ''}</span>
                                <span class="text-lg font-bold ${stockInfo.cantidad > 0 ? 'text-green-600' : 'text-red-600'}">${stockInfo.cantidad}</span>
                            </li>
                        `;
                    })}
                </ul>
            </div>
        <//>
    `;
};

const StockPill = ({ stock }) => {
    let pillClass, text;
    if (stock > 10) {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    } else if (stock > 0) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Bajo Stock';
    } else {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">${text} (${stock})</span>`;
};


const ProductCard = ({ product, onAddToCart, defaultPrice, quantityInCart, onCheckStock }) => {
    const hasStock = product.stock_sucursal > 0;
    return html`
        <div class="group relative flex flex-col rounded-lg bg-white shadow-md border overflow-hidden">
            <button 
                onClick=${() => hasStock ? onAddToCart(product) : onCheckStock(product)}
                class="flex flex-col flex-grow focus:outline-none cursor-pointer ${!hasStock ? 'opacity-75' : ''}"
            >
                <div class="relative aspect-square w-full bg-gray-100 overflow-hidden">
                    <img src=${product.imagen_principal || 'https://picsum.photos/300/300'} alt=${product.nombre} class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                     ${quantityInCart > 0 && html`
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <span class="material-symbols-outlined text-green-400 text-8xl" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">check_circle</span>
                        </div>
                    `}
                </div>
                <div class="flex flex-1 flex-col p-3 text-left">
                    <h3 class="text-sm font-semibold text-gray-800 flex-grow">${product.nombre}</h3>
                    <div class="mt-2">
                        <p class="text-base font-bold text-gray-900">Bs ${defaultPrice.toFixed(2)}</p>
                    </div>
                </div>
            </button>
            <div class="flex items-center justify-between px-3 pb-2 text-xs text-gray-500">
                <${StockPill} stock=${product.stock_sucursal} />
                <button onClick=${(e) => { e.stopPropagation(); onCheckStock(product); }} title="Ver stock en otras sucursales" class="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                    ${ICONS.inventory}
                </button>
            </div>
            ${!hasStock && html`<div class="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none"><span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">AGOTADO</span></div>`}
        </div>
    `;
};

const CartItem = ({ item, onUpdateQuantity, onRemove, price }) => {
    return html`
        <div class="flex items-center gap-3 py-3">
            <img src=${item.product.imagen_principal || 'https://picsum.photos/100/100'} alt=${item.product.nombre} class="h-14 w-14 rounded-md object-cover border" />
            <div class="flex-grow">
                <p class="text-sm font-semibold text-gray-800">${item.product.nombre}</p>
                <p class="text-xs text-gray-500">Bs ${price.toFixed(2)}</p>
                <div class="flex items-center gap-2 mt-1">
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity - 1)} class="text-gray-500 hover:text-red-600 transition-colors">${ICONS.remove_circle}</button>
                    <input 
                        type="number"
                        value=${item.quantity}
                        onInput=${e => onUpdateQuantity(item.product.id, parseInt(e.target.value, 10))}
                        class="w-14 text-center rounded-md border-gray-300 shadow-sm p-1 text-sm font-semibold focus:ring-primary focus:border-primary bg-white text-gray-900"
                        min="1"
                        aria-label="Cantidad"
                    />
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity + 1)} class="text-gray-500 hover:text-green-600 transition-colors">${ICONS.add_circle}</button>
                </div>
            </div>
            <div class="text-right flex flex-col items-end">
                <p class="text-base font-bold text-gray-900">Bs ${(price * item.quantity).toFixed(2)}</p>
                <button onClick=${() => onRemove(item.product.id)} title="Eliminar del carrito" class="mt-1 p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600">
                    ${ICONS.delete}
                </button>
            </div>
        </div>
    `;
};

export function TerminalVentaPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [ { name: 'Punto de Venta', href: '#/terminal-venta' } ];
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [posData, setPosData] = useState({ products: [], price_lists: [] });
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todas');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Efectivo');
    
    const [defaultPriceListId, setDefaultPriceListId] = useState(null);
    const [activePriceListId, setActivePriceListId] = useState(null);
    
    const [isStockModalOpen, setStockModalOpen] = useState(false);
    const [productForStockCheck, setProductForStockCheck] = useState(null);

    const [isCartSidebarOpen, setCartSidebarOpen] = useState(false);

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_pos_data');
            if (error) throw error;
            console.log('POS Data:', data);
            setPosData(data);
            const defaultList = data.price_lists.find(pl => pl.es_predeterminada);
            if (defaultList) {
                setDefaultPriceListId(defaultList.id);
                setActivePriceListId(defaultList.id);
            } else if (data.price_lists.length > 0) {
                // Fallback if no default is set
                setDefaultPriceListId(data.price_lists[0].id);
                setActivePriceListId(data.price_lists[0].id);
            }
        } catch (err) {
            console.error("Error fetching POS data:", err);
            addToast({ message: `Error crítico al cargar datos: ${err.message}`, type: 'error', duration: 10000 });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isCartSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isCartSidebarOpen]);


    const cartMap = useMemo(() => {
        return new Map(cart.map(item => [item.product.id, item]));
    }, [cart]);

    const totalItemsInCart = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

    const categories = useMemo(() => {
        const cats = new Set(posData.products.map(p => p.categoria_nombre).filter(Boolean));
        return ['Todas', ...Array.from(cats).sort()];
    }, [posData.products]);

    const filteredProducts = useMemo(() => {
        return posData.products.filter(p => {
            const matchesCategory = activeCategory === 'Todas' || p.categoria_nombre === activeCategory;
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower);
            return matchesCategory && matchesSearch;
        });
    }, [posData.products, activeCategory, searchTerm]);

    const getPriceForProduct = (product, listId) => {
        return product.prices?.[listId] ?? product.prices?.[defaultPriceListId] ?? 0;
    };
    
    const handleCheckStock = (product) => {
        setProductForStockCheck(product);
        setStockModalOpen(true);
    };

    const handleAddToCart = (product) => {
        setCart(currentCart => {
            const existingItem = currentCart.find(item => item.product.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock_sucursal) {
                    return currentCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                } else {
                    addToast({ message: `Stock máximo alcanzado para ${product.nombre}`, type: 'warning' });
                    return currentCart;
                }
            }
            return [...currentCart, { product, quantity: 1 }];
        });
    };

    const handleUpdateQuantity = (productId, newQuantity) => {
        if (isNaN(newQuantity)) {
            return;
        }

        if (newQuantity <= 0) {
            handleRemoveFromCart(productId);
            return;
        }
        setCart(currentCart => {
            const itemToUpdate = currentCart.find(item => item.product.id === productId);
            if (!itemToUpdate) { return currentCart; }

            let finalQuantity = newQuantity;
            if (newQuantity > itemToUpdate.product.stock_sucursal) {
                addToast({ message: `Stock máximo (${itemToUpdate.product.stock_sucursal}) alcanzado.`, type: 'warning' });
                finalQuantity = itemToUpdate.product.stock_sucursal;
            }
            
            return currentCart.map(item => 
                item.product.id === productId ? { ...item, quantity: finalQuantity } : item
            );
        });
    };

    const handleRemoveFromCart = (productId) => {
        setCart(currentCart => currentCart.filter(item => item.product.id !== productId));
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => {
            const price = getPriceForProduct(item.product, activePriceListId);
            return total + (price * item.quantity);
        }, 0);
    }, [cart, activePriceListId, defaultPriceListId]);

    const CartColumnContent = () => html`
        <div class="p-4 space-y-4 flex-shrink-0 border-b">
            <div>
                <label for="price-list" class="block text-sm font-medium text-gray-700">Lista de Precios</label>
                <select id="price-list" value=${activePriceListId} onChange=${e => setActivePriceListId(e.target.value)} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                    ${posData.price_lists.map(pl => html`<option value=${pl.id}>${pl.nombre}</option>`)}
                </select>
            </div>
             <div>
                <label for="client" class="block text-sm font-medium text-gray-700">Cliente</label>
                <select id="client" class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                    ${mockClients.map(c => html`<option value=${c.id}>${c.name}</option>`)}
                </select>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto p-4 divide-y divide-gray-200">
            ${cart.length === 0 ? html`
                <div class="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <div class="text-5xl">${ICONS.pos}</div>
                    <p class="mt-2 font-semibold">Carrito Vacío</p>
                    <p class="text-sm">Añade productos desde el catálogo.</p>
                </div>
            ` : cart.map(item => html`
                <${CartItem} item=${item} price=${getPriceForProduct(item.product, activePriceListId)} onUpdateQuantity=${handleUpdateQuantity} onRemove=${handleRemoveFromCart} />
            `)}
        </div>

        <div class="p-4 bg-gray-50 border-t flex-shrink-0 space-y-4">
            <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-600">Subtotal</span>
                    <span class="font-medium text-gray-800">Bs ${cartTotal.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-baseline text-2xl font-bold">
                    <span class="text-gray-900">Total</span>
                    <span class="text-primary">Bs ${cartTotal.toFixed(2)}</span>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
                 <button 
                    onClick=${() => setSelectedPaymentMethod('Efectivo')}
                    class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${selectedPaymentMethod === 'Efectivo' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
                >${ICONS.payments} Efectivo</button>
                 <button 
                    onClick=${() => setSelectedPaymentMethod('Tarjeta')}
                    class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${selectedPaymentMethod === 'Tarjeta' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
                >${ICONS.credit_card} Tarjeta</button>
                 <button 
                    onClick=${() => setSelectedPaymentMethod('QR')}
                    class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${selectedPaymentMethod === 'QR' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
                >${ICONS.qr_code_2} QR</button>
            </div>
            <button disabled=${cart.length === 0} class="w-full flex items-center justify-center gap-2 text-center rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${ICONS.pos}
                Finalizar Venta
            </button>
        </div>
    `;


    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Punto de Venta"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="relative lg:grid lg:grid-cols-5 lg:gap-6 lg:h-[calc(100vh-9rem)]">
                
                <div class="lg:col-span-3 flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden h-full">
                    <div class="flex-shrink-0 p-4 border-b">
                        <div class="relative">
                            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">${ICONS.search}</div>
                            <input type="text" placeholder="Buscar por nombre o SKU..." value=${searchTerm} onInput=${e => setSearchTerm(e.target.value)} class="block w-full rounded-md border-0 pl-10 p-2 bg-white text-gray-900 placeholder-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm transition-colors duration-200" />
                        </div>
                        <div class="mt-3 flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                            ${categories.map(cat => html`
                                <button 
                                    key=${cat} 
                                    onClick=${() => setActiveCategory(cat)}
                                    class="px-4 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-primary text-white shadow' : 'bg-white hover:bg-gray-200 text-gray-700 border'}"
                                >
                                    ${cat}
                                </button>
                            `)}
                        </div>
                    </div>

                    <div class="flex-grow overflow-y-auto p-4">
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            ${filteredProducts.map(p => html`
                                <${ProductCard} 
                                    product=${p} 
                                    onAddToCart=${handleAddToCart} 
                                    onCheckStock=${handleCheckStock}
                                    defaultPrice=${getPriceForProduct(p, defaultPriceListId)}
                                    quantityInCart=${cartMap.get(p.id)?.quantity || 0}
                                />
                            `)}
                        </div>
                    </div>
                </div>
                
                <div class="hidden lg:flex lg:col-span-2 flex-col bg-white rounded-lg border shadow-sm overflow-hidden">
                    <${CartColumnContent} />
                </div>

                {/* --- MOBILE/TABLET UI --- */}
                <div class="lg:hidden fixed top-20 right-4 z-30">
                    <button 
                        onClick=${() => setCartSidebarOpen(true)}
                        class="relative flex items-center justify-center bg-primary text-white rounded-full w-14 h-14 shadow-lg hover:bg-primary-hover transition-colors"
                        aria-label="Ver carrito"
                    >
                        <span class="text-3xl">${ICONS.shopping_cart}</span>
                        ${totalItemsInCart > 0 && html`
                            <span class="absolute -top-1 -right-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 border-2 border-primary">${totalItemsInCart}</span>
                        `}
                    </button>
                </div>
                
                <div class=${`fixed inset-0 z-40 flex justify-end lg:hidden transition-opacity duration-300 ease-linear ${isCartSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                    <div class="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true" onClick=${() => setCartSidebarOpen(false)}></div>
                    <div class=${`relative flex w-full max-w-md flex-1 flex-col bg-white transform transition duration-300 ease-in-out ${isCartSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                       <div class="absolute top-0 left-0 -ml-12 pt-2">
                            <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setCartSidebarOpen(false)}>
                                <span class="sr-only">Cerrar carrito</span>
                                ${ICONS.close}
                            </button>
                        </div>
                        <div class="flex flex-col h-full overflow-hidden">
                            <${CartColumnContent} />
                        </div>
                    </div>
                </div>

            </div>
            
            <${StockCheckModal} 
                isOpen=${isStockModalOpen}
                onClose=${() => setStockModalOpen(false)}
                product=${productForStockCheck}
                currentUserSucursal=${user.sucursal}
            />
        <//>
    `;
}