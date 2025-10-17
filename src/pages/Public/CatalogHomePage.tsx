/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useMemo, useRef, useEffect, useCallback } from 'preact/hooks';
import { ICONS } from '../../components/Icons.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';

const BANNER_IMAGE_URL = "https://raw.githubusercontent.com/servivent10/iconos/refs/heads/main/Lucid_Origin_Empresas_comerciales_de_productos_variables_en_un_0.jpg";

const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function SucursalDetailModal({ isOpen, onClose, sucursal }) {
    if (!sucursal) return null;
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDcOzOJnV2qJWsXeCGqBfWiORfUa4ZIBtw';
    const staticMapUrl = (sucursal.latitud && sucursal.longitud)
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${sucursal.latitud},${sucursal.longitud}&zoom=16&size=600x300&markers=color:red%7C${sucursal.latitud},${sucursal.longitud}&key=${GOOGLE_MAPS_API_KEY}`
        : null;
    const googleMapsUrl = (sucursal.latitud && sucursal.longitud)
        ? `https://maps.google.com/?q=${sucursal.latitud},${sucursal.longitud}`
        : null;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            title=${sucursal.nombre}
            confirmText="Cerrar"
            onConfirm=${onClose}
            maxWidthClass="max-w-lg"
        >
            <div class="space-y-4 text-sm text-gray-600">
                ${sucursal.direccion && html`<p class="flex items-start gap-2">${ICONS.storefront} <span>${sucursal.direccion}</span></p>`}
                ${sucursal.telefono && html`<p class="flex items-center gap-2">${ICONS.phone} <span>${sucursal.telefono}</span></p>`}

                ${staticMapUrl && html`
                    <div class="mt-4 border-t pt-4">
                        <h4 class="text-sm font-medium text-gray-800 mb-2">Ubicación</h4>
                        <a href=${googleMapsUrl} target="_blank" rel="noopener noreferrer" class="block rounded-lg overflow-hidden shadow border transition-shadow hover:shadow-md">
                            <img src=${staticMapUrl} alt="Mapa de ${sucursal.nombre}" class="w-full" />
                        </a>
                        <a href=${googleMapsUrl} target="_blank" rel="noopener noreferrer" class="mt-2 text-sm font-semibold text-primary hover:underline flex items-center gap-1 justify-center">
                            Abrir en Google Maps ${ICONS.chevron_right}
                        </a>
                    </div>
                `}
            </div>
        <//>
    `;
}

// --- UNIFIED PRODUCT CARD (MORE COMPACT) ---
const ProductHighlightCard = ({ product, currencySymbol, navigate, slug }) => {
    const hasOffer = product.precio_oferta > 0 && product.precio_oferta < product.precio_base;
    const displayPrice = hasOffer ? product.precio_oferta : product.precio_base;
    const brandAndModelText = [product.marca, product.modelo].filter(Boolean).join(' / ');

    return html`
        <a href=${`/#/catalogo/${slug}/producto/${product.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/producto/${product.id}`); }} class="group bg-white rounded-lg shadow-md border block flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
            <div class="relative w-full bg-white p-4 aspect-square">
                <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300" />
                <div class="absolute bottom-2 right-2 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm shadow-lg">
                    ${hasOffer && html`<span class="text-xs line-through opacity-75 mr-2">${formatCurrency(product.precio_base, currencySymbol)}</span>`}
                    <span>${formatCurrency(displayPrice, currencySymbol)}</span>
                </div>
            </div>
            <div class="flex flex-col justify-start p-4 border-t">
                <h3 class="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-primary">${product.nombre}</h3>
                <p class="text-xs text-gray-500 leading-tight mt-1 truncate" title=${brandAndModelText}>
                    ${brandAndModelText || html`&nbsp;`}
                </p>
            </div>
        </a>
    `;
};

// --- FEATURED CAROUSEL (SINGLE ITEM) ---
const FeaturedCarousel = ({ title, products, ...props }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef(null);
    const [isHovering, setIsHovering] = useState(false);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    useEffect(() => {
        resetTimeout();
        if (products.length > 1 && !isHovering && !isTouchDevice) {
            timeoutRef.current = setTimeout(() => {
                setCurrentIndex(prev => (prev + 1) % products.length);
            }, 5000);
        }
        return () => resetTimeout();
    }, [currentIndex, products.length, isHovering, isTouchDevice, resetTimeout]);

    if (products.length === 0) return null;

    const goPrev = () => setCurrentIndex(prev => (prev - 1 + products.length) % products.length);
    const goNext = () => setCurrentIndex(prev => (prev + 1) % products.length);

    const product = products[currentIndex];

    return html`
        <div class="h-full flex flex-col">
            <h2 class="text-2xl font-bold tracking-tight text-gray-900">${title}</h2>
            <div 
                class="relative mt-4 group flex-grow"
                onMouseEnter=${() => setIsHovering(true)} 
                onMouseLeave=${() => setIsHovering(false)}
            >
                <div class="overflow-hidden h-full w-80 mx-auto">
                     <${ProductHighlightCard} product=${product} ...${props} />
                </div>
                ${products.length > 1 && html`
                    <button onClick=${goPrev} class="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-4 z-10 bg-white/80 text-gray-900 hover:bg-white rounded-full p-2 shadow-md transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100">${ICONS.chevron_left}</button>
                    <button onClick=${goNext} class="absolute top-1/2 right-0 -translate-y-1/2 translate-x-4 z-10 bg-white/80 text-gray-900 hover:bg-white rounded-full p-2 shadow-md transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100">${ICONS.chevron_right}</button>
                `}
            </div>
        </div>
    `;
};

// --- HYBRID CAROUSEL (INFINITE SCROLL + MANUAL CONTROLS) ---
const HybridCarousel = ({ title, products, ...props }) => {
    if (!products || products.length === 0) return null;

    const scrollerRef = useRef(null);
    const [isHovering, setIsHovering] = useState(false);
    const animationFrameRef = useRef(null);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const duplicatedProducts = useMemo(() => products.length < 8 ? [...products, ...products, ...products, ...products] : [...products, ...products], [products]);

    const scroll = useCallback(() => {
        if (scrollerRef.current) {
            scrollerRef.current.scrollLeft += 0.5; // Adjust scroll speed here
            if (scrollerRef.current.scrollLeft >= scrollerRef.current.scrollWidth / 2) {
                scrollerRef.current.scrollLeft = 0;
            }
        }
        animationFrameRef.current = requestAnimationFrame(scroll);
    }, []);

    useEffect(() => {
        let isDesktop = window.matchMedia('(min-width: 1024px)').matches;

        const startScroll = () => {
            if (isDesktop && !isHovering && !isTouchDevice) {
                animationFrameRef.current = requestAnimationFrame(scroll);
            }
        };

        const stopScroll = () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
        
        startScroll();
        
        return () => stopScroll();
    }, [isHovering, isTouchDevice, scroll]);

    const handleNav = (direction) => {
        if (scrollerRef.current) {
            const cardWidth = 320; // Corresponds to w-80
            scrollerRef.current.scrollBy({
                left: direction * cardWidth,
                behavior: 'smooth',
            });
        }
    };

    return html`
        <div class="h-full flex flex-col">
            <h2 class="text-2xl font-bold tracking-tight text-gray-900">${title}</h2>
            <div 
                class="relative mt-4 flex-grow overflow-hidden group"
                onMouseEnter=${() => setIsHovering(true)}
                onMouseLeave=${() => setIsHovering(false)}
            >
                <div 
                    ref=${scrollerRef}
                    class="h-full flex items-start overflow-x-auto no-scrollbar"
                >
                    ${duplicatedProducts.map((p, index) => html`
                        <div key=${`${p.id}-${index}`} class="w-80 flex-shrink-0 p-2">
                            <${ProductHighlightCard} product=${p} ...${props} />
                        </div>
                    `)}
                </div>

                <button onClick=${() => handleNav(-1)} class="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-4 z-10 bg-white/80 text-gray-900 hover:bg-white rounded-full p-2 shadow-md transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100" >${ICONS.chevron_left}</button>
                <button onClick=${() => handleNav(1)} class="absolute top-1/2 right-0 -translate-y-1/2 translate-x-4 z-10 bg-white/80 text-gray-900 hover:bg-white rounded-full p-2 shadow-md transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100" >${ICONS.chevron_right}</button>
            </div>
        </div>
    `;
};


function PaginatedGrid({ title, items, renderItem, itemsPerPage = 8 }) {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return html`
        <div>
            <h2 class="text-2xl font-bold tracking-tight text-gray-900">${title}</h2>
            <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
                ${paginatedItems.map(item => renderItem(item))}
            </div>
            ${totalPages > 1 && html`
                <nav class="flex items-center justify-between border-t border-gray-200 px-4 sm:px-0 mt-6 pt-4">
                    <div class="-mt-px flex w-0 flex-1">
                        <button disabled=${currentPage === 1} onClick=${() => setCurrentPage(p => p - 1)} class="inline-flex items-center border-t-2 border-transparent pr-1 pt-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-50">
                            ${ICONS.arrow_back} Anterior
                        </button>
                    </div>
                    <div class="hidden md:-mt-px md:flex">
                        <span class="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-gray-500">Página ${currentPage} de ${totalPages}</span>
                    </div>
                    <div class="-mt-px flex w-0 flex-1 justify-end">
                        <button disabled=${currentPage === totalPages} onClick=${() => setCurrentPage(p => p + 1)} class="inline-flex items-center border-t-2 border-transparent pl-1 pt-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-50">
                            Siguiente ${ICONS.chevron_right}
                        </button>
                    </div>
                </nav>
            `}
        </div>
    `;
}

const CompactCard = ({ item, onFilterChange, navigate, slug, type, icon }) => {
    const handleClick = (e) => {
        e.preventDefault();
        onFilterChange(type, type === 'categories' ? item.id : item.nombre);
        navigate(`/catalogo/${slug}/productos`);
    };

    return html`
        <a href="#" onClick=${handleClick} class="group flex flex-col items-center justify-center rounded-lg bg-white p-4 shadow-sm border text-center transition-all hover:shadow-lg hover:-translate-y-1">
            <div class="text-3xl text-primary mb-1">${icon}</div>
            <h3 class="text-sm font-medium text-gray-800 leading-tight">${item.nombre}</h3>
            <p class="text-xs text-gray-500">${item.product_count} prod.</p>
        </a>
    `;
};


export function CatalogHomePage({ products, categories, brands, company, navigate, slug, onFilterChange, sucursales }) {
    const [selectedSucursal, setSelectedSucursal] = useState(null);

    const bestSellers = useMemo(() => {
        return [...products].sort((a, b) => (b.unidades_vendidas_90_dias || 0) - (a.unidades_vendidas_90_dias || 0)).slice(0, 12);
    }, [products]);

    const offers = useMemo(() => {
        return products.filter(p => p.precio_oferta > 0 && p.precio_oferta < p.precio_base).slice(0, 12);
    }, [products]);

    return html`
        <main>
            <div class="relative -mt-16">
                <div class="absolute inset-0">
                    <img class="h-full w-full object-cover" src=${BANNER_IMAGE_URL} alt="Comercio moderno" />
                    <div class="absolute inset-0 bg-gray-900/60" aria-hidden="true"></div>
                </div>
                <div class="relative mx-auto max-w-screen-2xl px-6 pt-40 pb-24 sm:px-12 sm:pt-48 sm:pb-32 lg:px-16 text-center">
                    <h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Bienvenido a nuestro catálogo de productos</h1>
                    <p class="mt-4 text-xl text-white/80 max-w-3xl mx-auto">Descubre la mejor selección de tecnología y componentes a precios increíbles. Calidad, variedad y el mejor servicio, todo en un solo lugar.</p>
                    <div class="mt-8">
                        ${(sucursales && sucursales.length > 0) && html`
                            <p class="text-white/80 mb-4 text-sm">Nuestras Sucursales:</p>
                            <div class="flex flex-wrap justify-center gap-2">
                                ${sucursales.map(s => html`
                                    <button onClick=${() => setSelectedSucursal(s)} class="bg-white/20 text-white rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-white/30 backdrop-blur-sm transition-colors">
                                        ${s.nombre}
                                    </button>
                                `)}
                            </div>
                        `}
                    </div>
                </div>
            </div>

            {/* Offers & Best Sellers section */}
            <section class="bg-slate-50">
                 <div class="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
                    <div class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        <div class="lg:col-span-1 h-[520px]">
                            ${offers.length > 0 && html`
                                <${FeaturedCarousel} title="Oferta Destacada" products=${offers} currencySymbol=${company.moneda_simbolo} navigate=${navigate} slug=${slug} />
                            `}
                        </div>
                        <div class="lg:col-span-2 xl:col-span-3 h-[520px]">
                             ${bestSellers.length > 0 && html`
                                <${HybridCarousel} title="Los Más Vendidos" products=${bestSellers} currencySymbol=${company.moneda_simbolo} navigate=${navigate} slug=${slug} />
                            `}
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Categories & Brands section */}
            <section aria-labelledby="collections-heading" class="bg-white">
                <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">
                    ${categories.length > 0 && html`
                        <${PaginatedGrid} 
                            title="Explorar por Categoría" 
                            items=${categories}
                            renderItem=${(cat) => html`<${CompactCard} item=${cat} onFilterChange=${onFilterChange} navigate=${navigate} slug=${slug} type="categories" icon=${ICONS.category} />`}
                            itemsPerPage=${8}
                        />
                    `}
                     ${brands.length > 0 && html`
                        <${PaginatedGrid} 
                            title="Explorar por Marcas" 
                            items=${brands}
                            renderItem=${(brand) => html`<${CompactCard} item=${brand} onFilterChange=${onFilterChange} navigate=${navigate} slug=${slug} type="brands" icon=${ICONS.local_offer} />`}
                            itemsPerPage=${8}
                        />
                    `}
                </div>
            </section>

            <${SucursalDetailModal} isOpen=${!!selectedSucursal} onClose=${() => setSelectedSucursal(null)} sucursal=${selectedSucursal} />
        </main>
    `;
}