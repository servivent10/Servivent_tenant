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
import { useLoading } from '../../hooks/useLoading.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { ProductImportModal } from '../../components/modals/ProductImportModal.js';

const StockPill = ({ stock }) => {
    let pillClass, text;
    if (stock > 10) {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    } else if (stock > 0) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Stock Bajo';
    } else {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">${text} (${stock})</span>`;
};

const ProductCard = ({ product, navigate, onEdit, onDelete }) => {
    const handleCardClick = () => {
        if (window.getSelection().toString()) {
            return;
        }
        navigate(`/productos/${product.id}`);
    };

    const handleActionClick = (e, actionFn) => {
        e.stopPropagation();
        actionFn(product);
    };
    
    const getInfoLine = (p) => {
        if (p.marca && p.modelo) return `${p.marca} - ${p.modelo}`;
        if (p.marca) return p.marca;
        if (p.sku) return `SKU: ${p.sku}`;
        return 'Sin detalles';
    };

    return html`
        <div onClick=${handleCardClick} class="group bg-white rounded-lg shadow-sm border overflow-hidden flex flex-row transition-shadow hover:shadow-md cursor-pointer">
            <div class="w-24 sm:w-28 flex-shrink-0 bg-gray-100 relative">
                 ${product.imagen_principal ? html`
                    <img 
                        src=${product.imagen_principal} 
                        alt=${product.nombre} 
                        class="w-full h-full object-cover" 
                    />
                ` : html`
                    <div class="w-full h-full flex items-center justify-center bg-slate-100">
                        <div class="text-slate-400 text-4xl">${ICONS.products}</div>
                    </div>
                `}
            </div>
            <div class="p-3 flex-grow flex flex-col justify-between w-full min-w-0">
                 <div>
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="font-bold text-gray-800 group-hover:text-primary transition-colors" title=${product.nombre}>${product.nombre}</h3>
                        <div class="flex items-center flex-shrink-0">
                            <button onClick=${(e) => handleActionClick(e, onEdit)} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full">${ICONS.edit}</button>
                            <button onClick=${(e) => handleActionClick(e, onDelete)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full">${ICONS.delete}</button>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mt-1 truncate">
                        ${getInfoLine(product)}
                    </p>
                </div>
                <div class="mt-2 flex items-end justify-between">
                    <p class="text-lg font-semibold text-gray-900">Bs ${Number(product.precio_base).toFixed(2)}</p>
                    <${StockPill} stock=${product.stock_total} />
                </div>
            </div>
        </div>
    `;
};

const ProductTable = ({ products, navigate, onEdit, onDelete }) => {
    const handleRowClick = (product) => {
        navigate(`/productos/${product.id}`);
    };
    
    return html`
    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Categoría</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Base</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Total</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                ${products.map(p => html`
                    <tr key=${p.id} onClick=${() => handleRowClick(p)} class="group hover:bg-gray-50 cursor-pointer">
                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div class="flex items-center">
                                <div class="h-10 w-10 flex-shrink-0">
                                    ${p.imagen_principal ? html`
                                        <img class="h-10 w-10 rounded-md object-cover" src=${p.imagen_principal} alt=${p.nombre} />
                                    ` : html`
                                        <div class="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center">
                                            <div class="text-slate-400 text-2xl">${ICONS.products}</div>
                                        </div>
                                    `}
                                </div>
                                <div class="ml-4">
                                    <div class="font-medium text-gray-900 group-hover:text-primary">${p.nombre}</div>
                                    <div class="text-gray-500">${p.marca}</div>
                                </div>
                            </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${p.sku}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${p.categoria_nombre}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">Bs ${Number(p.precio_base).toFixed(2)}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                             <${StockPill} stock=${p.stock_total} />
                        </td>
                        <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div class="flex items-center justify-end space-x-2">
                                <button onClick=${(e) => { e.stopPropagation(); onEdit(p); }} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                <button onClick=${(e) => { e.stopPropagation(); onDelete(p); }} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                            </div>
                        </td>
                    </tr>
                `)}
            </tbody>
        </table>
    </div>
`};


export function ProductosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [data, setData] = useState({ products: [], kpis: { total_products: 0, total_stock_items: 0, products_without_stock: 0 } });
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_products_with_stock');
            if (error) throw error;
            setData(data);
        } catch (err) {
            console.error("Error fetching products:", err);
            addToast({ message: `Error al cargar productos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleAddProduct = () => {
        setIsFabOpen(false);
        setProductToEdit(null);
        setFormModalOpen(true);
    };
    
    const handleEditProduct = (product) => {
        setProductToEdit(product);
        setFormModalOpen(true);
    };

    const handleDeleteProduct = (product) => {
        setProductToDelete(product);
        setDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!productToDelete) return;
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_product', { p_producto_id: productToDelete.id });
            if (error) throw error;
            addToast({ message: `Producto "${productToDelete.nombre}" eliminado.`, type: 'success' });
            fetchData();
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setDeleteModalOpen(false);
            setProductToDelete(null);
        }
    };
    
    const handleSaveProduct = (action, productId) => {
        setFormModalOpen(false);
        addToast({ message: `Producto ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData();
        if (action === 'create' && productId) {
            navigate(`/productos/${productId}`);
        }
    };
    
    const handleDownloadTemplate = () => {
        const headers = "sku,nombre,marca,modelo,descripcion,categoria_nombre,unidad_medida,precio_base";
        const example1 = "SKU001,Laptop Gamer XYZ,GamerCorp,Nitro 5,,Teclado RGB y pantalla 144Hz,Laptops,Unidad,8500.50";
        const example2 = ",Mouse Inalámbrico,Tech,M1,Diseño ergonómico,Periféricos,Pieza,150";
        const csvContent = "data:text/csv;charset=utf-8," + [headers, example1, example2].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "plantilla_productos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const filteredProducts = useMemo(() => {
        if (!data?.products) return [];
        const lowercasedFilter = searchTerm.toLowerCase();
        return data.products.filter(p => {
            return (
                p.nombre?.toLowerCase().includes(lowercasedFilter) ||
                p.sku?.toLowerCase().includes(lowercasedFilter) ||
                p.marca?.toLowerCase().includes(lowercasedFilter) ||
                p.categoria_nombre?.toLowerCase().includes(lowercasedFilter)
            );
        });
    }, [data, searchTerm]);

    const breadcrumbs = [ { name: 'Productos', href: '#/productos' } ];
    // FIX: Provide a default object for kpis and use optional chaining to prevent errors if data is null from the RPC call.
    const kpis = data?.kpis || { total_products: 0, total_stock_items: 0, products_without_stock: 0 };

    const ProductList = () => html`
        <div class="grid grid-cols-1 xl:hidden gap-4">
            ${filteredProducts.map(p => html`
                <${ProductCard} product=${p} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} />
            `)}
        </div>
        <div class="hidden xl:block">
            <${ProductTable} products=${filteredProducts} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} />
        </div>
    `;

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Productos"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Catálogo de Productos</h1>
                    <p class="mt-1 text-sm text-gray-600">Gestiona todos los artículos de tu empresa. Aquí se centraliza la información de cada producto.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                <${KPI_Card} title="Productos Totales" value=${kpis.total_products || 0} icon=${ICONS.products} color="primary" />
                <${KPI_Card} title="Unidades en Stock" value=${kpis.total_stock_items || 0} icon=${ICONS.inventory} color="green" />
                <${KPI_Card} title="Productos Agotados" value=${kpis.products_without_stock || 0} icon=${ICONS.warning} color="red" />
            </div>

            <div class="mt-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border">
                <div class="relative flex-grow">
                    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">${ICONS.search}</div>
                    <input type="text" placeholder="Buscar por Nombre, SKU, marca, modelo..." value=${searchTerm} onInput=${e => setSearchTerm(e.target.value)} class="block w-full rounded-md border-0 pl-10 p-2 bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm transition-colors duration-200" />
                </div>
                 <div class="hidden xl:flex items-center gap-2">
                    <button onClick=${() => addToast({ message: 'Funcionalidad de exportar no implementada.'})} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.download} Exportar</button>
                    <button onClick=${() => setImportModalOpen(true)} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.upload_file} Importar</button>
                    <button onClick=${() => addToast({ message: 'Funcionalidad de filtros no implementada.'})} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.settings} Filtros</button>
                    <button onClick=${handleAddProduct} class="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">${ICONS.add} Añadir Producto</button>
                </div>
            </div>

            <div class="mt-6">
                ${filteredProducts.length === 0 && searchTerm ? html`
                    <div class="text-center py-12">
                        <h3 class="text-lg font-medium text-gray-900">No se encontraron productos</h3>
                        <p class="mt-1 text-sm text-gray-500">Intenta con otro término de búsqueda.</p>
                    </div>
                ` : html`<${ProductList} />`}
            </div>
            
            <div class="xl:hidden fixed bottom-6 right-6 z-30 flex flex-col-reverse items-end gap-4">
                <button
                    onClick=${() => setIsFabOpen(prev => !prev)}
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 focus:outline-none z-10"
                    aria-expanded=${isFabOpen}
                    aria-label="Abrir menú de acciones"
                >
                    <div class=${`transform transition-transform duration-300 ${isFabOpen ? 'rotate-45' : 'rotate-0'}`}>
                        ${ICONS.add}
                    </div>
                </button>
                
                <div class=${`flex flex-col items-end gap-3 transition-all duration-300 ease-in-out ${isFabOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick=${() => { addToast({ message: 'Funcionalidad de filtros no implementada.'}); setIsFabOpen(false); }} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">
                        Filtros ${ICONS.settings}
                    </button>
                    <button onClick=${handleAddProduct} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">
                        Añadir Producto ${ICONS.add_circle}
                    </button>
                    <button onClick=${() => { setImportModalOpen(true); setIsFabOpen(false); }} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">
                        Importar ${ICONS.upload_file}
                    </button>
                    <button onClick=${() => addToast({ message: 'Funcionalidad de exportar no implementada.'})} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">
                        Exportar ${ICONS.download}
                    </button>
                </div>
            </div>
            
            <${ProductFormModal}
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSaveProduct}
                user=${user}
                productToEdit=${productToEdit}
            />

            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar el producto <span class="font-bold text-gray-800">${productToDelete?.nombre}</span>? Esta acción no se puede deshacer.</p>
                 ${productToDelete?.stock_total > 0 && html`<p class="mt-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-md"><strong>Advertencia:</strong> Este producto aún tiene ${productToDelete.stock_total} unidades en stock. La eliminación está bloqueada por seguridad.</p>`}
            <//>
            
            <${ProductImportModal}
                isOpen=${isImportModalOpen}
                onClose=${() => setImportModalOpen(false)}
                onImportSuccess=${fetchData}
                onDownloadTemplate=${handleDownloadTemplate}
            />
        <//>
    `;
}