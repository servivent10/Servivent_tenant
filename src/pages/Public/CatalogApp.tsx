/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../../components/Icons.js';
import { Spinner } from '../../components/Spinner.js';
import { ServiVentLogo } from '../../components/Logo.js';
import { useToast } from '../../hooks/useToast.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { IdentificacionModal } from './IdentificacionModal.js';
import { CuentaClientePage } from './CuentaClientePage.js';
import { Avatar } from '../../components/Avatar.js';

// --- Helper Functions & Constants ---
const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStockStatus = (stock) => {
    if (stock <= 0) return { text: 'Agotado', color: 'text-red-600' };
    if (stock <= 5) return { text: 'Pocas Unidades', color: 'text-amber-600' };
    return { text: 'Disponible', color: 'text-green-600' };
};

const INPUT_FOCUS_CLASSES = 'focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25';

// --- Sub-Components ---

const QuantityControl = ({ quantity, onUpdate }) => {
    const handleInput = (e) => {
        const value = parseInt(e.target.value, 10);
        onUpdate(isNaN(value) || value < 1 ? 1 : value);
    };

    return html`
        <div class="flex items-center rounded-md border border-gray-300 bg-white shadow-sm overflow-hidden focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 w-28 transition-all">
            <button onClick=${() => onUpdate(Math.max(1, quantity - 1))} class="px-2 py-1 text-gray-500 hover:bg-gray-100 h-full">${ICONS.remove_circle}</button>
            <input 
                type="number"
                value=${quantity}
                onInput=${handleInput}
                onFocus=${e => e.target.select()}
                class="w-full text-center border-0 bg-white text-gray-900 font-semibold p-1 focus:ring-0"
                min="1"
            />
            <button onClick=${() => onUpdate(quantity + 1)} class="px-2 py-1 text-gray-500 hover:bg-gray-100 h-full">${ICONS.add_circle}</button>
        </div>
    `;
};


const PublicHeader = ({ company, cartItemCount, onCartClick, onSearch, searchTerm, customerProfile, onLoginClick, onAccountClick, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return html`
        <header class="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-20">
            <nav class="mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex h-16 items-center justify-between">
                    <div class="flex items-center gap-4">
                        <a href="#" class="flex-shrink-0">
                            ${company.logo ? html`<img class="h-10 w-auto" src=${company.logo} alt=${company.nombre} />` : html`<${ServiVentLogo} />`}
                        </a>
                        <h1 class="text-lg font-bold text-slate-800 hidden sm:block">${company.nombre}</h1>
                    </div>
                    <div class="flex-1 max-w-lg lg:mx-8">
                        <div class="relative">
                            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span class="text-gray-400">${ICONS.search}</span>
                            </div>
                            <input 
                                type="search" 
                                placeholder="Buscar productos por nombre, SKU o modelo..." 
                                value=${searchTerm}
                                onInput=${onSearch}
                                onFocus=${(e) => e.target.select()}
                                class="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none ${INPUT_FOCUS_CLASSES} sm:text-sm"
                            />
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        ${customerProfile ? html`
                            <div class="relative">
                                <button onClick=${() => setIsMenuOpen(p => !p)} class="flex items-center gap-2 rounded-full p-1 pr-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                                    <${Avatar} name=${customerProfile.nombre} avatarUrl=${customerProfile.avatar_url} size="h-8 w-8" />
                                    <span class="hidden md:inline text-gray-700 font-medium truncate max-w-[100px]">${customerProfile.nombre.split(' ')[0]}</span>
                                    <div class="text-gray-400">${ICONS.chevron_down}</div>
                                </button>
                                ${isMenuOpen && html`
                                    <div class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-30 animate-fade-in-down">
                                        <div class="py-1">
                                            <a href="#" onClick=${(e) => { e.preventDefault(); onAccountClick(); setIsMenuOpen(false); }} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Mi Cuenta</a>
                                            <button onClick=${onLogout} class="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cerrar Sesión</button>
                                        </div>
                                    </div>
                                `}
                            </div>
                        ` : html`
                            <button onClick=${onLoginClick} class="text-sm font-semibold text-primary hover:text-primary-dark">Identifícate</button>
                        `}

                        <button onClick=${onCartClick} class="relative rounded-full bg-white p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                            <span class="sr-only">Ver Carrito</span>
                            <span class="material-symbols-outlined text-3xl">shopping_cart</span>
                            ${cartItemCount > 0 && html`
                                <span class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white border-2 border-white">${cartItemCount}</span>
                            `}
                        </button>
                    </div>
                </div>
            </nav>
        </header>
    `;
};

const FilterSidebar = ({ categories = [], brands = [], activeFilters, onFilterChange, onClearFilters, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('categories');
    const [categorySearch, setCategorySearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');

    const filteredCategories = useMemo(() => {
        if (!categorySearch) return categories;
        return categories.filter(cat => cat.nombre.toLowerCase().includes(categorySearch.toLowerCase()));
    }, [categories, categorySearch]);

    const filteredBrands = useMemo(() => {
        if (!brandSearch) return brands;
        return brands.filter(brand => brand.nombre.toLowerCase().includes(brandSearch.toLowerCase()));
    }, [brands, brandSearch]);

    const handlePillClick = (filterType, value) => {
        const currentSelection = activeFilters[filterType];
        const newSelection = currentSelection === value ? null : value;
        onFilterChange(filterType, newSelection);
    };

    const tabButtonClasses = (tabName) => `whitespace-nowrap border-b-2 py-3 px-2 text-sm font-medium ${activeTab === tabName ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

    const renderFilterList = (items, filterType, search, setSearch, onPillClick, activePill) => html`
        <div class="space-y-4">
            <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span class="text-gray-400">${ICONS.search}</span>
                </div>
                <input 
                    type="search" 
                    placeholder="Buscar..." 
                    value=${search} 
                    onInput=${e => setSearch(e.target.value)}
                    onFocus=${(e) => e.target.select()}
                    class="w-full text-sm rounded-md border border-gray-300 py-2 pl-10 bg-white text-gray-900 shadow-sm focus:outline-none ${INPUT_FOCUS_CLASSES}"
                />
            </div>
            <div class="flex flex-wrap gap-2">
                ${items.map(item => {
                    const value = filterType === 'categories' ? item.id : item.nombre;
                    const isSelected = activePill === value;
                    return html`
                        <button 
                            key=${value}
                            onClick=${() => onPillClick(filterType, value)}
                            class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${isSelected ? 'bg-primary text-white ring-2 ring-primary-dark' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
                        >
                            <span>${item.nombre}</span>
                            <span class="text-xs font-semibold">${item.product_count}</span>
                        </button>
                    `;
                })}
            </div>
        </div>
    `;

    const content = html`
        <div class="flex flex-col sticky top-16">
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <h3 class="text-lg font-semibold">Filtros</h3>
                ${(activeFilters.categories || activeFilters.brands) && html`
                    <button onClick=${onClearFilters} class="text-sm font-medium text-primary hover:underline">Limpiar</button>
                `}
            </div>
             <div class="border-b border-gray-200 px-4">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick=${() => setActiveTab('categories')} class=${tabButtonClasses('categories')}>Categorías</button>
                    <button onClick=${() => setActiveTab('brands')} class=${tabButtonClasses('brands')}>Marcas</button>
                </nav>
            </div>
            <div class="p-4">
                ${activeTab === 'categories' && renderFilterList(filteredCategories, 'categories', categorySearch, setCategorySearch, handlePillClick, activeFilters.categories)}
                ${activeTab === 'brands' && renderFilterList(filteredBrands, 'brands', brandSearch, setBrandSearch, handlePillClick, activeFilters.brands)}
            </div>
        </div>
    `;

    return html`
        <!-- Mobile Sidebar -->
        <div class="relative z-40 lg:hidden" role="dialog" aria-modal="true" hidden=${!isOpen}>
            <div class="fixed inset-0 bg-black bg-opacity-25" onClick=${onClose}></div>
            <div class="fixed inset-0 z-40 flex">
                <div class="relative flex w-full max-w-xs flex-col overflow-y-auto bg-white pb-12 shadow-xl">
                    <div class="flex px-4 pt-5 pb-2">
                        <button type="button" class="-m-2 inline-flex items-center justify-center rounded-md p-2 text-gray-400" onClick=${onClose}>
                            <span class="sr-only">Close menu</span>
                            ${ICONS.close}
                        </button>
                    </div>
                    ${content}
                </div>
            </div>
        </div>
        <!-- Desktop Sidebar -->
        <aside class="hidden lg:block lg:flex-shrink-0 lg:w-72">
           ${content}
        </aside>
    `;
};


const PublicProductCard = ({ product, onAddToCart, currencySymbol, navigate, slug }) => {
    const isAvailable = product.stock_consolidado > 0;
    const hasOffer = product.precio_oferta > 0 && product.precio_oferta < product.precio_base;
    const displayPrice = hasOffer ? product.precio_oferta : product.precio_base;
    const stockStatus = getStockStatus(product.stock_consolidado);

    return html`
        <div class="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
            <a href=${`/#/catalogo/${slug}/producto/${product.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/producto/${product.id}`); }} class="flex flex-col h-full">
                <div class="aspect-w-1 aspect-h-1 bg-gray-100">
                    <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div class="flex flex-1 flex-col space-y-2 p-4">
                    <h3 class="text-sm font-medium text-gray-900 h-10">
                        <span aria-hidden="true" class="absolute inset-0"></span>
                        ${product.nombre}
                    </h3>
                    <p class="text-sm text-gray-500 flex-grow">${product.modelo || product.marca || ''}</p>
                    <div class="flex flex-col justify-end">
                        <div class="flex items-baseline gap-2">
                            <p class="text-lg font-semibold text-gray-900">${formatCurrency(displayPrice, currencySymbol)}</p>
                            ${hasOffer && html`<p class="text-sm text-gray-500 line-through">${formatCurrency(product.precio_base, currencySymbol)}</p>`}
                        </div>
                        <p class="text-xs font-medium ${stockStatus.color}">${stockStatus.text}</p>
                    </div>
                </div>
            </a>
            <div class="p-4 pt-0 z-10">
                <button 
                    onClick=${(e) => { e.stopPropagation(); onAddToCart(product); }}
                    disabled=${!isAvailable}
                    class="w-full rounded-md px-3.5 py-2 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isAvailable ? 'bg-primary hover:bg-primary-hover focus-visible:outline-primary' : 'bg-gray-400 cursor-not-allowed'}"
                >
                    ${isAvailable ? 'Añadir al Carrito' : 'Agotado'}
                </button>
            </div>
        </div>
    `;
};

const ProductDetailView = ({ product, company, onAddToCart, navigate, slug }) => {
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const isAvailable = product.stock_consolidado > 0;
    const hasOffer = product.precio_oferta > 0 && product.precio_oferta < product.precio_base;
    const displayPrice = hasOffer ? product.precio_oferta : product.precio_base;
    const stockStatus = getStockStatus(product.stock_consolidado);
    const images = product.imagenes && product.imagenes.length > 0 ? product.imagenes : [{ url: NO_IMAGE_ICON_URL }];

    const DetailItem = ({ label, value, isMono = false }) => {
        if (!value) return null;
        return html`
            <div class="sm:col-span-1">
                <dt class="text-sm font-medium text-gray-500">${label}</dt>
                <dd class="mt-1 text-sm text-gray-900 ${isMono ? 'font-mono' : ''}">${value}</dd>
            </div>
        `;
    };

    return html`
        <div>
            <div class="mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
                <button onClick=${() => navigate(`/catalogo/${slug}`)} class="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover mb-6">
                    ${ICONS.arrow_back} Volver al catálogo
                </button>
                <div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
                    <!-- Image gallery -->
                    <div class="flex flex-col-reverse">
                        <div class="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
                            <div class="grid grid-cols-4 gap-6" aria-orientation="horizontal" role="tablist">
                                ${images.map((image, idx) => html`
                                    <button onClick=${() => setActiveImageIndex(idx)} type="button" class="relative flex h-24 cursor-pointer items-center justify-center rounded-md bg-white text-sm font-medium uppercase text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring focus:ring-opacity-50 focus:ring-offset-4">
                                        <span class="sr-only">${idx + 1}</span>
                                        <span class="absolute inset-0 overflow-hidden rounded-md">
                                            <img src=${image.url} alt="" class="h-full w-full object-cover object-center" />
                                        </span>
                                        ${activeImageIndex === idx && html`<span class="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary ring-offset-2" aria-hidden="true"></span>`}
                                    </button>
                                `)}
                            </div>
                        </div>
                        <div class="aspect-w-1 aspect-h-1 w-full">
                            <img src=${images[activeImageIndex].url} alt=${product.nombre} class="h-full w-full object-cover object-center sm:rounded-lg" />
                        </div>
                    </div>

                    <!-- Product info -->
                    <div class="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
                        <h1 class="text-3xl font-bold tracking-tight text-gray-900">${product.nombre}</h1>
                        <div class="mt-3">
                            <h2 class="sr-only">Información del producto</h2>
                             <div class="flex items-baseline gap-2">
                                <p class="text-3xl tracking-tight text-gray-900">${formatCurrency(displayPrice, company.moneda_simbolo)}</p>
                                ${hasOffer && html`<p class="text-xl text-gray-500 line-through">${formatCurrency(product.precio_base, company.moneda_simbolo)}</p>`}
                            </div>
                        </div>
                        <div class="mt-6">
                            <p class="font-medium ${stockStatus.color}">${stockStatus.text}</p>
                            <div class="mt-4 flex gap-4">
                                <${QuantityControl} quantity=${quantity} onUpdate=${setQuantity} />
                                <button 
                                    onClick=${() => onAddToCart(product, quantity)}
                                    disabled=${!isAvailable}
                                    class="flex-1 rounded-md px-8 py-3 text-base font-medium text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isAvailable ? 'bg-primary hover:bg-primary-hover focus-visible:outline-primary' : 'bg-gray-400 cursor-not-allowed'}"
                                >
                                    Añadir al Carrito
                                </button>
                            </div>
                        </div>
                        
                        <div class="mt-8 border-t border-gray-200 pt-8">
                            <h3 class="text-base font-medium text-gray-900">Detalles Adicionales</h3>
                             <dl class="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <${DetailItem} label="Marca" value=${product.marca} />
                                <${DetailItem} label="Modelo" value=${product.modelo} />
                                <${DetailItem} label="Categoría" value=${product.categoria_nombre} />
                                <${DetailItem} label="SKU" value=${product.sku} isMono=${true} />
                            </dl>
                        </div>

                         <div class="mt-8 border-t border-gray-200 pt-8">
                            <h3 class="text-base font-medium text-gray-900">Descripción</h3>
                            <div class="mt-4 space-y-6 text-base text-gray-700">
                                <p>${product.descripcion || 'Sin descripción detallada.'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};


// --- Main App Component ---
export function CatalogApp({ path, navigate, session, customerProfile }) {
    const slug = path.split('/')[2];
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [catalogData, setCatalogData] = useState(null);
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLoginIdentificacionOpen, setIsLoginIdentificacionOpen] = useState(false);
    const [productToAddAfterLogin, setProductToAddAfterLogin] = useState(null);
    const [isOrderSuccess, setIsOrderSuccess] = useState(false);

    const [filters, setFilters] = useState({ searchTerm: '', categories: null, brands: null });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const subPath = path.substring(`/catalogo/${slug}`.length);
    const productIdMatch = subPath.match(/^\/producto\/([a-fA-F0-9-]+)/);
    const activeProductId = productIdMatch ? productIdMatch[1] : null;
    const isAccountPage = subPath.startsWith('/cuenta');

    useEffect(() => {
        if (!slug) {
            setError('No se ha especificado un catálogo.');
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { data, error: rpcError } = await supabase.rpc('get_public_catalog_data', { p_slug: slug });
                if (rpcError) throw rpcError;
                if (!data) throw new Error('Catálogo no encontrado o no disponible.');
                setCatalogData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [slug]);
    
    useEffect(() => {
        if (customerProfile && productToAddAfterLogin) {
            handleAddToCart(productToAddAfterLogin.product, productToAddAfterLogin.quantity, true);
            setProductToAddAfterLogin(null);
        }
    }, [customerProfile, productToAddAfterLogin]);

    const handleAddToCart = useCallback((product, quantity = 1, isAfterLogin = false) => {
        if (!customerProfile && !isAfterLogin) {
            setProductToAddAfterLogin({ product, quantity });
            setIsLoginIdentificacionOpen(true);
            return;
        }
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
            }
            return [...prevCart, { ...product, quantity }];
        });
        addToast({ message: `${product.nombre} añadido al carrito.`, type: 'success' });
    }, [addToast, customerProfile]);

    const handleUpdateQuantity = (productId, quantity) => {
        setCart(prevCart => {
            if (quantity <= 0) {
                return prevCart.filter(item => item.id !== productId);
            }
            return prevCart.map(item => item.id === productId ? { ...item, quantity } : item);
        });
    };
    
    const handleAuthenticationRequest = async (customerData) => {
        try {
            if (customerData.isNew) {
                const { error: upsertError } = await supabase.rpc('upsert_web_client', {
                    p_slug: slug,
                    p_nombre: customerData.nombre,
                    p_telefono: customerData.telefono,
                    p_email: customerData.email,
                });
                if (upsertError) throw upsertError;
            }

            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: customerData.email,
                options: {
                    emailRedirectTo: window.location.origin + window.location.pathname + `#/catalogo/${slug}`
                }
            });
            if (otpError) throw otpError;
            
            setIsLoginIdentificacionOpen(false);
            addToast({ message: '¡Listo! Revisa tu correo para encontrar el enlace de acceso.', type: 'success', duration: 10000 });

        } catch (err) {
            addToast({ message: `Error: ${err.message}`, type: 'error' });
        }
    };
    
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            addToast({ message: `Error al cerrar sesión: ${error.message}`, type: 'error'});
        }
    };

    const handlePlaceOrder = async () => {
        try {
            const orderItems = cart.map(item => ({
                producto_id: item.id,
                cantidad: item.quantity,
                precio_unitario: item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base
            }));
            
            const { error: rpcError } = await supabase.rpc('registrar_pedido_web', {
                p_slug: slug,
                p_items: orderItems,
                p_cliente_email: customerProfile.correo,
                p_cliente_nombre: customerProfile.nombre,
                p_cliente_telefono: customerProfile.telefono
            });

            if (rpcError) throw rpcError;

            setIsCartOpen(false);
            setIsOrderSuccess(true);
            setCart([]);
        } catch (err) {
            addToast({ message: `Error al crear el pedido: ${err.message}`, type: 'error' });
        }
    };


    const handleFilterChange = (filterType, value) => setFilters(prev => ({ ...prev, [filterType]: value }));
    const handleClearFilters = () => setFilters({ searchTerm: filters.searchTerm, categories: null, brands: null });
    
    const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    
    const filteredProducts = useMemo(() => {
        if (!catalogData) return [];
        return catalogData.products.filter(p => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const matchesSearch = filters.searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower) ||
                p.marca?.toLowerCase().includes(searchTermLower);
            
            const matchesCategory = !filters.categories || filters.categories === p.categoria_id;
            const matchesBrand = !filters.brands || filters.brands === p.marca;

            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [catalogData, filters]);


    if (isLoading) {
        return html`<div class="flex items-center justify-center h-screen"><${Spinner} color="text-primary" size="h-10 w-10" /></div>`;
    }
    if (error) {
        return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-red-600">Error</h2><p>${error}</p></div>`;
    }

    if (isOrderSuccess) {
        return html`
            <div class="bg-white h-full">
                <div class="max-w-3xl mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8 text-center">
                    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><div class="text-green-600 text-4xl">${ICONS.success}</div></div>
                    <h1 class="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">¡Gracias por tu pedido!</h1>
                    <p class="mt-4 text-base text-gray-500">Hemos guardado tu orden y te hemos enviado un enlace a tu correo electrónico para que puedas ver el historial y estado de tus compras.</p>
                    <div class="mt-10"><a href=${`/#/catalogo/${slug}`} onClick=${(e) => { e.preventDefault(); setIsOrderSuccess(false); }} class="text-sm font-semibold leading-6 text-primary hover:text-primary-hover"><span aria-hidden="true"> &larr; </span> Volver al catálogo</a></div>
                </div>
            </div>
        `;
    }
    
    const activeProduct = activeProductId ? catalogData.products.find(p => p.id === activeProductId) : null;
    const subtotal = cart.reduce((sum, item) => sum + (item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base) * item.quantity, 0);

    return html`
        <div class="bg-white">
            <${PublicHeader} 
                company=${catalogData.company} 
                cartItemCount=${cartItemCount} 
                onCartClick=${() => setIsCartOpen(true)}
                onSearch=${(e) => handleFilterChange('searchTerm', e.target.value)}
                searchTerm=${filters.searchTerm}
                customerProfile=${customerProfile}
                onLoginClick=${() => setIsLoginIdentificacionOpen(true)}
                onAccountClick=${() => navigate(`/catalogo/${slug}/cuenta`)}
                onLogout=${handleLogout}
            />
             <div class="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
                <div class="lg:grid lg:grid-cols-[288px_1fr] lg:gap-x-8 lg:items-start">
                    <${FilterSidebar} 
                        categories=${catalogData.categories} 
                        brands=${catalogData.brands}
                        activeFilters=${filters}
                        onFilterChange=${handleFilterChange}
                        onClearFilters=${handleClearFilters}
                        isOpen=${isFilterOpen}
                        onClose=${() => setIsFilterOpen(false)}
                    />

                    <main class="flex-grow py-6">
                        ${isAccountPage ? html`
                            <${CuentaClientePage} customerProfile=${customerProfile} slug=${slug} navigate=${navigate} company=${catalogData.company} />
                        ` : activeProduct ? html`
                            <${ProductDetailView} 
                                product=${activeProduct} 
                                company=${catalogData.company} 
                                onAddToCart=${handleAddToCart} 
                                navigate=${navigate}
                                slug=${slug}
                            />
                        ` : html`
                            <div>
                                <div class="flex items-baseline justify-between border-b border-gray-200 pb-6">
                                    <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900">Todos los Productos</h1>
                                    <button type="button" class="p-2 text-gray-400 hover:text-gray-500 lg:hidden" onClick=${() => setIsFilterOpen(true)}>
                                        <span class="sr-only">Filters</span>
                                        ${ICONS.settings}
                                    </button>
                                </div>
                                <div class="pt-6 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    ${filteredProducts.map(product => html`
                                        <${PublicProductCard} 
                                            product=${product} 
                                            onAddToCart=${handleAddToCart} 
                                            currencySymbol=${catalogData.company.moneda_simbolo}
                                            navigate=${navigate}
                                            slug=${slug}
                                        />
                                    `)}
                                </div>
                            </div>
                        `}
                    </main>
                </div>
            </div>
            <div class="relative z-30" hidden=${!isCartOpen}>
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick=${() => setIsCartOpen(false)}></div>
                <div class="fixed inset-0 overflow-hidden"><div class="absolute inset-0 overflow-hidden"><div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                    <div class="pointer-events-auto w-screen max-w-md">
                        <div class="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                            <div class="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                                <div class="flex items-start justify-between">
                                    <h2 class="text-lg font-medium text-gray-900">Carrito</h2>
                                    <div class="ml-3 flex h-7 items-center"><button type="button" class="relative -m-2 p-2 text-gray-400 hover:text-gray-500" onClick=${() => setIsCartOpen(false)}>${ICONS.close}</button></div>
                                </div>
                                <div class="mt-8"><div class="flow-root"><ul role="list" class="-my-6 divide-y divide-gray-200">
                                    ${cart.map(item => html`
                                        <li class="flex py-6">
                                            <div class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200"><img src=${item.imagen_principal || NO_IMAGE_ICON_URL} class="h-full w-full object-cover object-center" /></div>
                                            <div class="ml-4 flex flex-1 flex-col">
                                                <div><div class="flex justify-between text-base font-medium text-gray-900"><h3>${item.nombre}</h3><p class="ml-4">${formatCurrency((item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base) * item.quantity, catalogData.company.moneda_simbolo)}</p></div></div>
                                                <div class="flex flex-1 items-end justify-between text-sm">
                                                    <${QuantityControl} quantity=${item.quantity} onUpdate=${(newQty) => handleUpdateQuantity(item.id, newQty)} />
                                                    <div class="flex"><button onClick=${() => handleUpdateQuantity(item.id, 0)} type="button" class="font-medium text-primary hover:text-primary-hover">Eliminar</button></div>
                                                </div>
                                            </div>
                                        </li>
                                    `)}
                                </ul></div></div>
                            </div>
                            <div class="border-t border-gray-200 px-4 py-6 sm:px-6">
                                <div class="flex justify-between text-base font-medium text-gray-900"><p>Subtotal</p><p>${formatCurrency(subtotal, catalogData.company.moneda_simbolo)}</p></div>
                                <div class="mt-6"><button onClick=${handlePlaceOrder} disabled=${cart.length === 0} class="flex w-full items-center justify-center rounded-md border border-transparent bg-primary px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-hover disabled:bg-gray-400">Finalizar Pedido</button></div>
                            </div>
                        </div>
                    </div>
                </div></div></div>
            </div>
            <${IdentificacionModal} isOpen=${isLoginIdentificacionOpen} onClose=${() => setIsLoginIdentificacionOpen(false)} onConfirm=${handleAuthenticationRequest} slug=${slug} />
        </div>
    `;
}