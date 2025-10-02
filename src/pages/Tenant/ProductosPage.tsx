/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { ProductImportModal } from '../../components/modals/ProductImportModal.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { FilterBar, AdvancedFilterPanel } from '../../components/shared/FilterComponents.js';
import { CategoryFormModal } from '../../components/modals/CategoryFormModal.js';
import { Spinner } from '../../components/Spinner.js';

const CategoryManagerModal = ({ isOpen, onClose, onRefreshRequired }) => {
    const { addToast } = useToast();
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_all_categories_with_product_count');
            if (error) throw error;
            setCategories(data);
        } catch (err) {
            addToast({ message: `Error al cargar categorías: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const handleAdd = () => { setCategoryToEdit(null); setFormModalOpen(true); };
    const handleEdit = (cat) => { setCategoryToEdit(cat); setFormModalOpen(true); };
    const handleDelete = (cat) => { setCategoryToDelete(cat); setDeleteModalOpen(true); };

    const handleSave = () => {
        setFormModalOpen(false);
        fetchData();
        onRefreshRequired();
    };
    
    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return;
        if (categoryToDelete.product_count > 0) {
            addToast({ message: 'No se puede eliminar una categoría que tiene productos asignados.', type: 'error' });
            setDeleteModalOpen(false);
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('delete_category', { p_id: categoryToDelete.id });
            if (error) throw error;
            addToast({ message: `Categoría "${categoryToDelete.nombre}" eliminada.`, type: 'success' });
            fetchData();
            onRefreshRequired();
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
            setDeleteModalOpen(false);
        }
    };

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            title="Gestionar Categorías"
            icon=${ICONS.category}
            maxWidthClass="max-w-2xl"
            customFooter=${html`
                <div class="flex-shrink-0 flex justify-between items-center p-4 bg-gray-50 rounded-b-xl border-t">
                    <button onClick=${handleAdd} class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        ${ICONS.add} Nueva Categoría
                    </button>
                    <button onClick=${onClose} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        Cerrar
                    </button>
                </div>
            `}
        >
            <div class="max-h-[60vh] overflow-y-auto -m-6 p-6">
                ${isLoading ? html`<div class="flex justify-center p-8"><${Spinner} /></div>` :
                    categories.length === 0 ? html`<p class="text-center text-gray-500 py-8">No hay categorías. Crea la primera.</p>` :
                    html`
                    <ul class="divide-y divide-gray-200">
                        ${categories.map(cat => html`
                            <li key=${cat.id} class="py-3 flex items-center justify-between">
                                <div>
                                    <p class="font-medium text-gray-800">${cat.nombre}</p>
                                    <p class="text-sm text-gray-500">${cat.product_count} ${cat.product_count === 1 ? 'producto' : 'productos'}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onClick=${() => handleEdit(cat)} class="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                    <button onClick=${() => handleDelete(cat)} class="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                                </div>
                            </li>
                        `)}
                    </ul>
                    `
                }
            </div>

            <${CategoryFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSave}
                categoryToEdit=${categoryToEdit}
            />

            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText=${isLoading ? html`<${Spinner}/>` : 'Sí, eliminar'}
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar la categoría <span class="font-bold text-gray-800">${categoryToDelete?.nombre}</span>?</p>
                ${categoryToDelete?.product_count > 0 && html`
                    <div class="mt-4 p-3 rounded-md bg-red-50 text-red-800 border border-red-200">
                        <p class="font-bold">Acción bloqueada</p>
                        <p class="text-sm">Esta categoría no puede ser eliminada porque contiene ${categoryToDelete.product_count} productos.</p>
                    </div>
                `}
            <//>
        </${ConfirmationModal}>
    `;
};


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

const ProductCard = ({ product, navigate, onEdit, onDelete, user }) => {
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
    
    const stockToShow = user.role === 'Propietario' ? product.stock_total : product.stock_sucursal;

    return html`
        <div onClick=${handleCardClick} class="group bg-white rounded-lg shadow-sm border overflow-hidden flex flex-row transition-shadow hover:shadow-md cursor-pointer">
            <div class="w-24 sm:w-28 flex-shrink-0 bg-gray-100 relative">
                <img 
                    src=${product.imagen_principal || NO_IMAGE_ICON_URL} 
                    alt=${product.nombre} 
                    class="w-full h-full object-cover" 
                />
            </div>
            <div class="p-3 flex-grow flex flex-col justify-between w-full min-w-0">
                 <div>
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-800 group-hover:text-primary transition-colors truncate" title=${product.nombre}>${product.nombre}</h3>
                            <p class="text-sm text-gray-500 truncate" title=${product.modelo || ''}>${product.modelo || 'Sin modelo'}</p>
                        </div>
                        <div class="flex items-center flex-shrink-0">
                            <button onClick=${(e) => handleActionClick(e, onEdit)} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full">${ICONS.edit}</button>
                            <button onClick=${(e) => handleActionClick(e, onDelete)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full">${ICONS.delete}</button>
                        </div>
                    </div>
                </div>
                <div class="mt-2 flex items-end justify-between">
                    <p class="text-lg font-semibold text-gray-900">
                        ${Number(product.precio_base) > 0 ? `Bs ${Number(product.precio_base).toFixed(2)}` : html`<span class="text-sm text-amber-600 font-medium">Precio no asignado</span>`}
                    </p>
                    <${StockPill} stock=${stockToShow} />
                </div>
            </div>
        </div>
    `;
};

const ProductTable = ({ products, navigate, onEdit, onDelete, user }) => {
    const handleRowClick = (product) => {
        navigate(`/productos/${product.id}`);
    };
    
    return html`
    <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table class="min-w-full divide-y divide-gray-300 table-fixed">
            <colgroup>
                <col />
                <col class="w-[150px]" />
                <col class="w-[150px]" />
                <col class="w-[100px]" />
            </colgroup>
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Base</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Acciones</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
            ${products.map(p => {
                const stockToShow = user.role === 'Propietario' ? p.stock_total : p.stock_sucursal;
                return html`
                <tr key=${p.id} onClick=${() => handleRowClick(p)} class="group hover:bg-gray-50 cursor-pointer">
                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                        <img class="h-10 w-10 rounded-md object-cover" src=${p.imagen_principal || NO_IMAGE_ICON_URL} alt=${p.nombre} />
                    </div>
                    <div class="ml-4 min-w-0">
                        <div class="font-medium text-gray-900 group-hover:text-primary truncate" title=${p.nombre}>${p.nombre}</div>
                        <div class="text-gray-500 truncate" title=${p.modelo || ''}>${p.modelo || 'Sin modelo'}</div>
                    </div>
                    </div>
                </td>
                
                <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">
                    ${Number(p.precio_base) > 0
                    ? `Bs ${Number(p.precio_base).toFixed(2)}`
                    : html`<span class="text-xs text-amber-600 font-medium">Precio no asignado</span>`
                    }
                </td>
                
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <${StockPill} stock=${stockToShow} />
                </td>
                
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div class="flex items-center justify-end space-x-1">
                    <button onClick=${(e) => { e.stopPropagation(); onEdit(p); }} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                    <button onClick=${(e) => { e.stopPropagation(); onDelete(p); }} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                    </div>
                </td>
                </tr>
            `})}
            </tbody>
        </table>
    </div>
`};

const initialFilters = {
    searchTerm: '',
    status: 'all',
    category_ids: [],
    brand_names: [],
};

const productStatusOptions = [
    { value: 'all', label: 'Todos los Estados' },
    { value: 'with_price', label: 'Con Precio Asignado' },
    { value: 'without_price', label: 'Sin Precio Asignado' }
];

export function ProductosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [products, setProducts] = useState([]);
    const [kpis, setKpis] = useState({ total_products: 0, total_stock_items: 0, products_without_stock: 0 });
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    
    const [filters, setFilters] = useState(initialFilters);
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });

    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const [productsRes, optionsRes] = await Promise.all([
                supabase.rpc('get_company_products_with_stock_and_cost'),
                supabase.rpc('get_inventory_filter_data')
            ]);
            
            if (productsRes.error) throw productsRes.error;
            if (optionsRes.error) throw optionsRes.error;
            
            const productData = productsRes.data || [];
            setProducts(productData);
            setFilterOptions(optionsRes.data || { categories: [], brands: [] });

            const totalStock = productData.reduce((sum, p) => sum + Number(p.stock_total || 0), 0);
            const withoutStock = productData.filter(p => (p.stock_total || 0) <= 0).length;

            setKpis({
                total_products: productData.length,
                total_stock_items: totalStock,
                products_without_stock: withoutStock
            });
        } catch (err) {
            console.error("Error fetching data:", err);
            addToast({ message: `Error al cargar datos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [addToast, startLoading, stopLoading]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        const example1 = "SKU001,Laptop Gamer XYZ,GamerCorp,Nitro 5,Teclado RGB y pantalla 144Hz,Laptops,Unidad,8500.5";
        const example2 = "SKU002,Mouse Inalámbrico,Tech,M1,Diseño ergonómico,Periféricos,Pieza,150";
        const bom = "\uFEFF";
        const csvContent = "data:text/csv;charset=utf-8," + bom + [headers, example1, example2].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "plantilla_productos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const matchesSearch = filters.searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower);

            let matchesStatus = true;
            if (filters.status === 'with_price') {
                matchesStatus = Number(p.precio_base || 0) > 0;
            } else if (filters.status === 'without_price') {
                matchesStatus = Number(p.precio_base || 0) <= 0;
            }

            const matchesCategory = filters.category_ids.length === 0 || filters.category_ids.includes(p.categoria_id);
            const matchesBrand = filters.brand_names.length === 0 || filters.brand_names.includes(p.marca);

            return matchesSearch && matchesStatus && matchesCategory && matchesBrand;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [products, filters]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const handleClearFilters = () => {
        setFilters(initialFilters);
        setIsAdvancedSearchOpen(false);
    };
    
    const handleOpenCategoryManager = () => {
        setIsFabOpen(false);
        setIsCategoryManagerOpen(true);
    };

    const breadcrumbs = [ { name: 'Productos', href: '#/productos' } ];

    const ProductList = () => html`
        <div class="grid grid-cols-1 xl:hidden gap-4">
            ${filteredProducts.map(p => html`
                <${ProductCard} product=${p} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} user=${user} />
            `)}
        </div>
        <div class="hidden xl:block">
            <${ProductTable} products=${filteredProducts} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} user=${user} />
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
                <div class="hidden sm:flex items-center gap-2">
                    <button onClick=${() => addToast({ message: 'Funcionalidad de exportar no implementada.'})} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.download} Exportar</button>
                    <button onClick=${() => setImportModalOpen(true)} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.upload_file} Importar</button>
                    ${(user.role === 'Propietario' || user.role === 'Administrador') && html`
                        <button onClick=${handleOpenCategoryManager} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.category} Gestionar</button>
                    `}
                    <button onClick=${handleAddProduct} class="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">${ICONS.add} Añadir Producto</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                <${KPI_Card} title="Productos Totales" value=${kpis.total_products || 0} icon=${ICONS.products} color="primary" />
                <${KPI_Card} title="Unidades en Stock" value=${kpis.total_stock_items || 0} icon=${ICONS.inventory} color="green" />
                <${KPI_Card} title="Productos Agotados" value=${kpis.products_without_stock || 0} icon=${ICONS.warning} color="red" />
            </div>

            <div class="mt-8">
                <${FilterBar} 
                    filters=${filters}
                    onFilterChange=${handleFilterChange}
                    onClear=${handleClearFilters}
                    onToggleAdvanced=${() => setIsAdvancedSearchOpen(p => !p)}
                    isAdvancedOpen=${isAdvancedSearchOpen}
                    statusOptions=${productStatusOptions}
                />
                <${AdvancedFilterPanel}
                    isOpen=${isAdvancedSearchOpen}
                    filters=${filters}
                    onFilterChange=${handleFilterChange}
                    filterOptions=${filterOptions}
                />
                
                <div class="mt-6">
                    <p class="text-sm text-gray-600 mb-2">Mostrando ${filteredProducts.length} de ${products.length} productos</p>
                    ${filteredProducts.length === 0 ? html`
                        <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                            <h3 class="text-lg font-medium text-gray-900">No se encontraron productos</h3>
                            <p class="mt-1 text-sm text-gray-500">Intenta con otro término de búsqueda o ajusta los filtros.</p>
                        </div>
                    ` : html`<${ProductList} />`}
                </div>
            </div>
            
            <div class="sm:hidden fixed bottom-6 right-6 z-30 flex flex-col-reverse items-end gap-4">
                <button onClick=${() => setIsFabOpen(prev => !prev)} class="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 focus:outline-none z-10" aria-expanded=${isFabOpen} aria-label="Abrir menú de acciones">
                    <div class="transform transition-transform duration-300 ${isFabOpen ? 'rotate-45' : 'rotate-0'}">${ICONS.add}</div>
                </button>
                <div class="flex flex-col items-end gap-3 transition-all duration-300 ease-in-out ${isFabOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
                    <button onClick=${handleAddProduct} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">Añadir Producto ${ICONS.add_circle}</button>
                    ${(user.role === 'Propietario' || user.role === 'Administrador') && html`
                        <button onClick=${handleOpenCategoryManager} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">Gestionar Categorías ${ICONS.category}</button>
                    `}
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

            <${CategoryManagerModal}
                isOpen=${isCategoryManagerOpen}
                onClose=${() => setIsCategoryManagerOpen(false)}
                onRefreshRequired=${fetchData}
            />
        <//>
    `;
}