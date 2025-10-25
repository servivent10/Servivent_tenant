/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../../components/Icons.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { CuentaClientePage } from './CuentaClientePage.js';
import { Avatar } from '../../components/Avatar.js';
import { CatalogHomePage } from './CatalogHomePage.js';
import { CatalogProductsPage } from './CatalogProductsPage.js';
import { CatalogCartPage } from './CatalogCartPage.js';
import { ProductDetailView } from './ProductDetailView.js';
import { FormInput } from '../../components/FormComponents.js';
import { ClienteIdentificacionPage } from './ClienteIdentificacionPage.js';
import { ClienteRecuperarClavePage } from './ClienteRecuperarClavePage.js';
import { ClientePedidoDetailPage } from './ClientePedidoDetailPage.js';
import { useCatalogCart } from '../../contexts/StatePersistence.js';

// --- Mobile Menu Component ---
function MobileMenu({ isOpen, onClose, company, customerProfile, onLoginClick, onAccountClick, onLogout, navigate, slug }) {
    return html`
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

                    <div class="space-y-6 border-t border-gray-200 px-4 py-6">
                        <div class="flow-root"><a href=${`/#/catalogo/${slug}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}`); onClose(); }} class="-m-2 block p-2 font-medium text-gray-900">Inicio</a></div>
                        <div class="flow-root"><a href=${`/#/catalogo/${slug}/productos`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/productos`); onClose(); }} class="-m-2 block p-2 font-medium text-gray-900">Catálogo</a></div>
                    </div>

                    <div class="space-y-6 border-t border-gray-200 px-4 py-6">
                        ${customerProfile ? html`
                            <div class="flow-root"><a href="#" onClick=${(e) => { e.preventDefault(); onAccountClick(); }} class="-m-2 block p-2 font-medium text-gray-900">Mi Cuenta</a></div>
                            <div class="flow-root"><a href="#" onClick=${(e) => { e.preventDefault(); onLogout(); }} class="-m-2 block p-2 font-medium text-red-600">Cerrar Sesión</a></div>
                        ` : html`
                            <div class="flow-root"><a href="#" onClick=${(e) => { e.preventDefault(); onLoginClick(); }} class="-m-2 block p-2 font-medium text-gray-900">Identifícate</a></div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}


// --- Header Component for Public Catalog ---
function PublicHeader({ company, cartItemCount, onCartClick, onSearch, searchTerm, onClearSearch, customerProfile, onLoginClick, onAccountClick, onLogout, navigate, slug, onMobileMenuOpen }) {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const clearButton = html`
        <button 
            type="button"
            onClick=${onClearSearch}
            class="text-gray-400 hover:text-gray-600"
            aria-label="Limpiar búsqueda"
        >
            ${ICONS.close}
        </button>
    `;

    return html`
        <header class="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-30">
            <nav class="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
                <div class="flex h-16 items-center justify-between">
                    <div class="flex items-center lg:hidden">
                        <button type="button" class="-m-2 rounded-md bg-white p-2 text-gray-400" onClick=${onMobileMenuOpen}>
                            <span class="sr-only">Open menu</span>
                            ${ICONS.menu}
                        </button>
                    </div>

                    <a href=${`/#/catalogo/${slug}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}`); }} class="flex items-center">
                        <span class="text-2xl font-bold text-gray-800">${company.nombre}</span>
                    </a>

                    <div class="hidden lg:flex lg:gap-x-12">
                        <a href=${`/#/catalogo/${slug}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}`); }} class="text-sm font-semibold leading-6 text-gray-900 hover:text-primary">Inicio</a>
                        <a href=${`/#/catalogo/${slug}/productos`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/productos`); }} class="text-sm font-semibold leading-6 text-gray-900 hover:text-primary">Catálogo</a>
                        ${customerProfile && html`
                            <a href=${`/#/catalogo/${slug}/cuenta`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/cuenta`); }} class="text-sm font-semibold leading-6 text-gray-900 hover:text-primary">Mi Perfil</a>
                        `}
                    </div>

                    <div class="flex items-center justify-end gap-x-4">
                        <div class="hidden lg:block w-72">
                            <${FormInput}
                                name="search"
                                type="text"
                                placeholder="Buscar..."
                                value=${searchTerm}
                                onInput=${onSearch}
                                icon=${ICONS.search}
                                required=${false}
                                label=""
                                rightElement=${searchTerm ? clearButton : null}
                            />
                        </div>
                        
                        <div class="relative hidden lg:block" ref=${profileMenuRef}>
                            ${customerProfile ? html`
                                <button onClick=${() => setIsProfileMenuOpen(p => !p)} class="flex items-center gap-2">
                                    <${Avatar} name=${customerProfile.nombre} avatarUrl=${customerProfile.avatar_url} size="h-8 w-8" />
                                    <span class="hidden md:inline text-sm font-medium text-gray-700">${customerProfile.nombre.split(' ')[0]}</span>
                                </button>
                                ${isProfileMenuOpen && html`
                                    <div class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                                        <div class="px-4 py-3 border-b">
                                            <p class="text-sm font-medium text-gray-900 truncate">${customerProfile.nombre}</p>
                                        </div>
                                        <a href="#" onClick=${(e) => { e.preventDefault(); onAccountClick(); setIsProfileMenuOpen(false); }} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Mi Cuenta</a>
                                        <a href="#" onClick=${(e) => { e.preventDefault(); onLogout(); setIsProfileMenuOpen(false); }} class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cerrar Sesión</a>
                                    </div>
                                `}
                            ` : html`
                                <button onClick=${onLoginClick} class="text-sm font-medium text-gray-700 hover:text-gray-800 flex items-center gap-1">
                                    ${ICONS.account_circle}
                                    Identifícate
                                </button>
                            `}
                        </div>

                        <div class="flow-root">
                            <a href="#" onClick=${(e) => { e.preventDefault(); onCartClick(); }} class="group -m-2 flex items-center p-2 relative">
                                <span class="text-gray-400 group-hover:text-gray-500 text-3xl">${ICONS.shopping_cart}</span>
                                ${cartItemCount > 0 && html`
                                    <span class="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold">${cartItemCount > 9 ? '9+' : cartItemCount}</span>
                                `}
                            </a>
                        </div>
                    </div>
                </div>
            </nav>
             <div class="lg:hidden border-t border-gray-200 px-4 py-3">
                <${FormInput}
                    name="search-mobile"
                    type="text"
                    placeholder="Buscar productos..."
                    value=${searchTerm}
                    onInput=${onSearch}
                    icon=${ICONS.search}
                    required=${false}
                    label=""
                    rightElement=${searchTerm ? clearButton : null}
                />
            </div>
        </header>
    `;
}


// --- Main App Component ---
export function CatalogApp({ path, navigate, customerProfile }) {
    const slug = path.split('/')[2];
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [catalogData, setCatalogData] = useState(null);
    const { cart, setCart } = useCatalogCart(); // Use context for cart state
    const [isOrderSuccess, setIsOrderSuccess] = useState(false);
    const [filters, setFilters] = useState({ searchTerm: '', categories: null, brands: null });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const subPath = path.substring(`/catalogo/${slug}`.length);
    const productIdMatch = subPath.match(/^\/producto\/([a-fA-F0-9-]+)/);
    const pedidoIdMatch = subPath.match(/^\/cuenta\/pedido\/([a-fA-F0-9-]+)/);
    const activeProductId = productIdMatch ? productIdMatch[1] : null;
    const activePedidoId = pedidoIdMatch ? pedidoIdMatch[1] : null;
    const isAccountPage = subPath.startsWith('/cuenta') && !activePedidoId;
    const isCartPage = subPath.startsWith('/carrito');
    const isProductsPage = subPath.startsWith('/productos');
    const isIdentificacionPage = subPath.startsWith('/login') || subPath.startsWith('/registro');
    const isRecuperarPage = subPath.startsWith('/recuperar-clave');

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

    const handleAddToCart = useCallback((product, quantity = 1) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
            }
            return [...prevCart, { ...product, quantity }];
        });
        addToast({ message: `${product.nombre} añadido al carrito.`, type: 'success' });
    }, [addToast, setCart]);

    const handleUpdateQuantity = (productId, quantity) => {
        setCart(prevCart => {
            if (quantity <= 0) {
                return prevCart.filter(item => item.id !== productId);
            }
            return prevCart.map(item => item.id === productId ? { ...item, quantity } : item);
        });
    };
    
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            addToast({ message: `Error al cerrar sesión: ${error.message}`, type: 'error'});
        } else {
            addToast({ message: 'Has cerrado sesión.', type: 'success' });
        }
        navigate(`/catalogo/${slug}`);
    };

    const handlePlaceOrder = async (deliveryDetails) => {
        if (!customerProfile) {
            addToast({ message: 'Debes iniciar sesión para finalizar tu pedido.', type: 'info' });
            navigate(`/catalogo/${slug}/login`);
            return;
        }
        try {
            const orderItems = cart.map(item => ({
                producto_id: item.id,
                cantidad: item.quantity,
                precio_unitario: item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base
            }));
            
            const { error: rpcError } = await supabase.rpc('registrar_pedido_web', {
                p_slug: slug,
                p_items: orderItems,
                p_direccion_id: deliveryDetails.addressId || null,
                p_sucursal_id: deliveryDetails.sucursalId || null
            });

            if (rpcError) throw rpcError;

            setIsOrderSuccess(true);
            setCart([]);
        } catch (err) {
            addToast({ message: `Error al crear el pedido: ${err.message}`, type: 'error' });
        }
    };

    const handleFilterChange = (filterType, value) => setFilters(prev => ({ ...prev, [filterType]: value }));
    const handleClearFilters = () => setFilters({ searchTerm: filters.searchTerm, categories: null, brands: null });
    
    const handleSearch = (e) => {
        handleFilterChange('searchTerm', e.target.value);
        if (!isProductsPage && !activeProductId) {
            navigate(`/catalogo/${slug}/productos`);
        }
    };
    
    const handleClearSearch = () => {
        handleFilterChange('searchTerm', '');
    };

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
                    <p class="mt-4 text-base text-gray-500">Hemos guardado tu orden. Puedes ver el historial y estado de tus compras en tu perfil.</p>
                    <div class="mt-10"><a href=${`/#/catalogo/${slug}`} onClick=${(e) => { e.preventDefault(); setIsOrderSuccess(false); navigate(`/catalogo/${slug}`); }} class="text-sm font-semibold leading-6 text-primary hover:text-primary-hover"><span aria-hidden="true"> &larr; </span> Volver a la tienda</a></div>
                </div>
            </div>
        `;
    }
    
    const activeProduct = activeProductId ? catalogData.products.find(p => p.id === activeProductId) : null;
    
    let pageContent;
    if (isCartPage) {
        pageContent = html`<${CatalogCartPage} cart=${cart} onUpdateQuantity=${handleUpdateQuantity} onPlaceOrder=${handlePlaceOrder} company=${catalogData.company} navigate=${navigate} slug=${slug} customerProfile=${customerProfile} sucursales=${catalogData.sucursales} />`;
    } else if (activePedidoId) {
        pageContent = html`<${ClientePedidoDetailPage} pedidoId=${activePedidoId} slug=${slug} navigate=${navigate} company=${catalogData.company} />`;
    } else if (isAccountPage) {
        pageContent = html`<${CuentaClientePage} customerProfile=${customerProfile} slug=${slug} navigate=${navigate} company=${catalogData.company} />`;
    } else if (isIdentificacionPage) {
        pageContent = html`<${ClienteIdentificacionPage} navigate=${navigate} slug=${slug} />`;
    } else if (isRecuperarPage) {
        pageContent = html`<${ClienteRecuperarClavePage} navigate=${navigate} slug=${slug} />`;
    } else if (activeProduct) {
        pageContent = html`<${ProductDetailView} product=${activeProduct} company=${catalogData.company} onAddToCart=${handleAddToCart} navigate=${navigate} slug=${slug} />`;
    } else if (isProductsPage) {
        pageContent = html`<${CatalogProductsPage} products=${filteredProducts} categories=${catalogData.categories} brands=${catalogData.brands} onFilterChange=${handleFilterChange} onClearFilters=${handleClearFilters} onAddToCart=${handleAddToCart} company=${catalogData.company} navigate=${navigate} slug=${slug} filters=${filters} />`;
    } else {
        pageContent = html`<${CatalogHomePage} products=${catalogData.products} categories=${catalogData.categories} brands=${catalogData.brands} company=${catalogData.company} navigate=${navigate} slug=${slug} onFilterChange=${handleFilterChange} sucursales=${catalogData.sucursales} />`;
    }

    return html`
        <div class="bg-slate-50 min-h-full">
            <${MobileMenu} 
                isOpen=${isMobileMenuOpen} 
                onClose=${() => setIsMobileMenuOpen(false)}
                company=${catalogData.company}
                customerProfile=${customerProfile}
                onLoginClick=${() => { navigate(`/catalogo/${slug}/login`); setIsMobileMenuOpen(false); }}
                onAccountClick=${() => { navigate(`/catalogo/${slug}/cuenta`); setIsMobileMenuOpen(false); }}
                onLogout=${() => { handleLogout(); setIsMobileMenuOpen(false); }}
                navigate=${navigate}
                slug=${slug}
            />
            <${PublicHeader} 
                company=${catalogData.company} 
                cartItemCount=${cartItemCount} 
                onCartClick=${() => navigate(`/catalogo/${slug}/carrito`)}
                onSearch=${handleSearch}
                searchTerm=${filters.searchTerm}
                onClearSearch=${handleClearSearch}
                customerProfile=${customerProfile}
                onLoginClick=${() => navigate(`/catalogo/${slug}/login`)}
                onAccountClick=${() => navigate(`/catalogo/${slug}/cuenta`)}
                onLogout=${handleLogout}
                navigate=${navigate}
                slug=${slug}
                onMobileMenuOpen=${() => setIsMobileMenuOpen(true)}
            />
            ${pageContent}
        </div>
    `;
}