/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput, FormSelect } from '../FormComponents.js';
import { RichTextInput } from '../RichTextInput.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { CameraScanner } from '../CameraScanner.js';
import { useProductForm } from '../../contexts/StatePersistence.js';

const unidadesDeMedida = ['Unidad', 'Pieza', 'Caja', 'Paquete', 'Docena', 'Kg', 'Gramo', 'Litro', 'Metro'];

export function ProductFormModal({ onSave, user }) {
    const { isModalOpen, setIsModalOpen, productToEdit, setProductToEdit, draft, setDraft, clearDraft } = useProductForm();
    const isEditMode = Boolean(productToEdit);
    const { addToast } = useToast();
    const fileInputRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [errors, setErrors] = useState({ nombre: '' });
    
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // State for category combobox
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryComboboxRef = useRef(null);
    const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
    const categoryItemRefs = useRef([]);

    // State for brand combobox
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
    const brandComboboxRef = useRef(null);
    const [highlightedBrandIndex, setHighlightedBrandIndex] = useState(-1);
    const brandItemRefs = useRef([]);


    const fetchData = useCallback(async () => {
        setIsFetchingData(true);
        try {
            const [catRes, brandRes] = await Promise.all([
                supabase.rpc('get_all_categories'),
                supabase.rpc('get_inventory_filter_data')
            ]);
            if (catRes.error) throw catRes.error;
            if (brandRes.error) throw brandRes.error;
            setCategories(catRes.data || []);
            setBrands(brandRes.data?.brands || []);
        } catch (error) {
            addToast({ message: 'Error al cargar datos para el formulario.', type: 'error' });
        } finally {
            setIsFetchingData(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (isModalOpen) {
            fetchData();
        }
    }, [isModalOpen, fetchData]);

    useEffect(() => {
        if (!isModalOpen) return;

        if (isEditMode && productToEdit) {
            setDraft({
                formData: {
                    nombre: productToEdit.nombre || '', sku: productToEdit.sku || '', marca: productToEdit.marca || '',
                    modelo: productToEdit.modelo || '', descripcion: productToEdit.descripcion || '',
                    categoria_id: productToEdit.categoria_id || '', unidad_medida: productToEdit.unidad_medida || 'Unidad',
                    costo_inicial: String(productToEdit.precio_compra || ''),
                    precio_base: String(productToEdit.precio_base || '')
                },
                imageFiles: [], imagePreviews: [], categorySearchTerm: '', brandSearchTerm: productToEdit.marca || ''
            });
        }
    }, [isModalOpen, isEditMode, productToEdit, setDraft]);
    
    useEffect(() => {
        if (isModalOpen && isEditMode && categories.length > 0 && draft.formData.categoria_id) {
            const categoryName = categories.find(c => c.id === draft.formData.categoria_id)?.nombre || '';
            if (draft.categorySearchTerm !== categoryName) {
                setDraft(prev => ({ ...prev, categorySearchTerm: categoryName }));
            }
        }
    }, [isModalOpen, isEditMode, categories, draft.formData.categoria_id, draft.categorySearchTerm, setDraft]);


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (categoryComboboxRef.current && !categoryComboboxRef.current.contains(event.target)) { setIsCategoryDropdownOpen(false); }
            if (brandComboboxRef.current && !brandComboboxRef.current.contains(event.target)) { setIsBrandDropdownOpen(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        if (isCategoryDropdownOpen && highlightedCategoryIndex >= 0 && categoryItemRefs.current[highlightedCategoryIndex]) {
            categoryItemRefs.current[highlightedCategoryIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedCategoryIndex, isCategoryDropdownOpen]);

    useEffect(() => {
        if (isBrandDropdownOpen && highlightedBrandIndex >= 0 && brandItemRefs.current[highlightedBrandIndex]) {
            brandItemRefs.current[highlightedBrandIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedBrandIndex, isBrandDropdownOpen]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setDraft(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
        if (name === 'nombre' && errors.nombre) { setErrors(prev => ({ ...prev, nombre: '' })); }
    };
    
    const handleScanSuccess = (scannedCode) => {
        setDraft(prev => ({...prev, formData: {...prev.formData, sku: scannedCode}}));
        setIsScannerOpen(false);
        addToast({ message: 'Código de barras escaneado.', type: 'success' });
    };

    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const files = target.files ? Array.from(target.files) : [];
        files.forEach((file) => {
            if (file.size > 5 * 1024 * 1024) { addToast({ message: `El archivo ${file.name} es demasiado grande (máx 5MB).`, type: 'error' }); return; }
            setDraft(prev => ({
                ...prev,
                imageFiles: [...prev.imageFiles, file],
                imagePreviews: [...prev.imagePreviews, URL.createObjectURL(file)]
            }));
        });
    };

    const removeImage = (index) => {
        setDraft(prev => ({
            ...prev,
            imageFiles: prev.imageFiles.filter((_, i) => i !== index),
            imagePreviews: prev.imagePreviews.filter((_, i) => i !== index)
        }));
    };

    const handleCreateCategory = async () => {
        if (!isNewCategory) return;
        setIsLoading(true);
        try {
            const { data: newCategory, error } = await supabase.rpc('create_category', { p_nombre: draft.categorySearchTerm.trim() });
            if (error) throw error;
            addToast({ message: `Categoría "${newCategory.nombre}" creada.`, type: 'success' });
            await fetchData();
            setDraft(prev => ({ ...prev, formData: { ...prev.formData, categoria_id: newCategory.id }, categorySearchTerm: newCategory.nombre }));
            setIsCategoryDropdownOpen(false);
        } catch (err) {
            addToast({ message: `Error al crear categoría: ${err.message}`, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleConfirm = async () => {
        if (!draft.formData.nombre.trim()) { setErrors({ nombre: 'El nombre es obligatorio.' }); return; }
        setIsLoading(true);
        try {
            const { data: productId, error: upsertError } = await supabase.rpc('upsert_product', {
                p_id: isEditMode ? productToEdit.id : null,
                p_nombre: draft.formData.nombre, p_sku: draft.formData.sku || null,
                p_marca: draft.brandSearchTerm || null, p_modelo: draft.formData.modelo || null,
                p_descripcion: draft.formData.descripcion || null, p_categoria_id: draft.formData.categoria_id || null,
                p_unidad_medida: draft.formData.unidad_medida,
                p_costo_inicial: draft.formData.costo_inicial ? Number(draft.formData.costo_inicial) : null,
                p_precio_base: draft.formData.precio_base ? Number(draft.formData.precio_base) : null
            });
            if (upsertError) throw upsertError;

            if (draft.imageFiles.length > 0) {
                const uploadPromises = draft.imageFiles.map(file => {
                    const filePath = `${user.empresa_id}/${productId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
                    return supabase.storage.from('productos').upload(filePath, file);
                });
                const uploadResults = await Promise.all(uploadPromises);
                if (uploadResults.some(res => res.error)) throw new Error('Fallo al subir imágenes.');
                const imageData = uploadResults.map((res, i) => ({ imagen_url: supabase.storage.from('productos').getPublicUrl(res.data.path).data.publicUrl, orden: i }));
                const { error: imageError } = await supabase.rpc('add_product_images', { p_producto_id: productId, p_images: imageData });
                if (imageError) throw imageError;
            }
            clearDraft();
            onSave(isEditMode ? 'edit' : 'create', productId);
        } catch (err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleClose = () => { clearDraft(); setIsModalOpen(false); setProductToEdit(null); };
    const handleCategorySearchChange = (e) => { setDraft(prev => ({ ...prev, categorySearchTerm: e.target.value })); setIsCategoryDropdownOpen(true); setHighlightedCategoryIndex(-1); };
    const handleSelectCategory = (category) => { setDraft(prev => ({ ...prev, formData: { ...prev.formData, categoria_id: category.id }, categorySearchTerm: category.nombre })); setIsCategoryDropdownOpen(false); };
    const handleBrandSearchChange = (e) => { const value = e.target.value; setDraft(prev => ({ ...prev, brandSearchTerm: value, formData: { ...prev.formData, marca: value } })); setIsBrandDropdownOpen(true); setHighlightedBrandIndex(-1); };
    const handleSelectBrand = (brandName) => { setDraft(prev => ({ ...prev, brandSearchTerm: brandName, formData: { ...prev.formData, marca: brandName } })); setIsBrandDropdownOpen(false); };

    const isNewCategory = useMemo(() => {
        const searchTerm = draft.categorySearchTerm.trim();
        return searchTerm && !categories.some(c => c.nombre.toLowerCase() === searchTerm.toLowerCase());
    }, [draft.categorySearchTerm, categories]);

    const finalCategoryOptions = useMemo(() => {
        const filtered = categories.filter(c => c.nombre.toLowerCase().includes(draft.categorySearchTerm.toLowerCase()));
        if(isNewCategory) {
            return [...filtered, { id: 'CREATE_NEW', nombre: `+ Crear "${draft.categorySearchTerm}"` }];
        }
        return filtered;
    }, [categories, draft.categorySearchTerm, isNewCategory]);

    const finalBrandOptions = useMemo(() => {
        if (!draft.brandSearchTerm.trim()) return brands.map(b => b.nombre);
        const lowerCaseTerm = draft.brandSearchTerm.toLowerCase();
        return brands.map(b => b.nombre).filter(b => b.toLowerCase().includes(lowerCaseTerm));
    }, [draft.brandSearchTerm, brands]);

    const handleCategoryKeyDown = (e) => {
        if (!isCategoryDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setIsCategoryDropdownOpen(true); setHighlightedCategoryIndex(0); return; }
        if (!isCategoryDropdownOpen) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setHighlightedCategoryIndex(prev => (prev + 1) % finalCategoryOptions.length); break;
            case 'ArrowUp': e.preventDefault(); setHighlightedCategoryIndex(prev => (prev - 1 + finalCategoryOptions.length) % finalCategoryOptions.length); break;
            case 'Enter':
                e.preventDefault();
                if (highlightedCategoryIndex >= 0 && finalCategoryOptions[highlightedCategoryIndex]) {
                    const selected = finalCategoryOptions[highlightedCategoryIndex];
                    if (selected.id === 'CREATE_NEW') { handleCreateCategory(); } else { handleSelectCategory(selected); }
                }
                break;
            case 'Escape': setIsCategoryDropdownOpen(false); break;
        }
    };

    const handleBrandKeyDown = (e) => {
        if (!isBrandDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setIsBrandDropdownOpen(true); setHighlightedBrandIndex(0); return; }
        if (!isBrandDropdownOpen) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setHighlightedBrandIndex(prev => (prev + 1) % finalBrandOptions.length); break;
            case 'ArrowUp': e.preventDefault(); setHighlightedBrandIndex(prev => (prev - 1 + finalBrandOptions.length) % finalBrandOptions.length); break;
            case 'Enter':
                e.preventDefault();
                if (highlightedBrandIndex >= 0 && finalBrandOptions[highlightedBrandIndex]) { handleSelectBrand(finalBrandOptions[highlightedBrandIndex]); }
                else { setIsBrandDropdownOpen(false); }
                break;
            case 'Escape': setIsBrandDropdownOpen(false); break;
        }
    };
    
    const hasPurchases = isEditMode && productToEdit?.has_purchases;
    const hasSales = isEditMode && productToEdit?.has_sales;

    const CostoInfoIcon = hasPurchases ? html`
        <div class="text-gray-400" title="El costo ahora se gestiona por el Costo Promedio Ponderado (CAPP) basado en las compras.">
            ${ICONS.info}
        </div>
    ` : null;

    const PrecioInfoIcon = hasSales ? html`
        <div class="text-gray-400" title="Los precios ahora se gestionan desde la pestaña 'Precios y Costos' en la vista de detalle del producto.">
            ${ICONS.info}
        </div>
    ` : null;

    return html`
        <${ConfirmationModal} isOpen=${isModalOpen} onClose=${handleClose} onConfirm=${handleConfirm} title=${isEditMode ? 'Editar Producto' : 'Añadir Producto'} confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Producto')} icon=${ICONS.products} maxWidthClass="max-w-4xl">
            ${isFetchingData ? html`<div class="flex justify-center items-center h-96"><${Spinner} /></div>` : html`
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div class="space-y-6">
                        <div class="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                            <label class="block font-medium leading-6 text-gray-900">Imágenes</label>
                            <div class="grid grid-cols-4 gap-2">
                                ${draft.imagePreviews.map((src, index) => html`
                                    <div class="relative group aspect-square"><img src=${src} class="w-full h-full object-cover rounded-md" /><button onClick=${() => removeImage(index)} class="absolute top-0 right-0 -m-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">${ICONS.close}</button></div>`)}
                                <button onClick=${() => fileInputRef.current.click()} class="flex items-center justify-center aspect-square w-full border-2 border-dashed border-gray-300 rounded-md text-gray-400 hover:border-primary hover:text-primary transition-colors">${ICONS.add}</button>
                            </div>
                            <input ref=${fileInputRef} type="file" class="hidden" accept="image/png, image/jpeg, image/webp" onChange=${handleFileChange} multiple />
                        </div>
                         <${RichTextInput} label="Descripción (Opcional)" value=${draft.formData.descripcion} onInput=${(htmlValue) => handleInput({ target: { name: 'descripcion', value: htmlValue } })} />
                    </div>
                    <div class="space-y-6">
                        <${FormInput} label="Nombre del Producto" name="nombre" type="text" value=${draft.formData.nombre} onInput=${handleInput} error=${errors.nombre} />
                        <div class="grid grid-cols-2 gap-4">
                           <div ref=${brandComboboxRef} class="relative">
                               <${FormInput} label="Marca" name="marca" type="text" value=${draft.brandSearchTerm} onInput=${handleBrandSearchChange} onFocus=${() => setIsBrandDropdownOpen(true)} onKeyDown=${handleBrandKeyDown} required=${false} autocomplete="off" />
                                ${isBrandDropdownOpen && html`
                                    <ul class="absolute z-20 top-full mt-1 w-full max-h-40 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                        ${finalBrandOptions.map((brandName, index) => html`<li ref=${el => brandItemRefs.current[index] = el} onMouseEnter=${() => setHighlightedBrandIndex(index)} onClick=${() => handleSelectBrand(brandName)} class="cursor-pointer select-none relative py-2 px-4 text-gray-900 ${highlightedBrandIndex === index ? 'bg-primary-light' : 'hover:bg-primary-light'}">${brandName}</li>`)}
                                    </ul>`}
                            </div>
                            <${FormInput} label="Modelo" name="modelo" type="text" value=${draft.formData.modelo} onInput=${handleInput} required=${false} />
                        </div>
                        <div class="relative">
                            <${FormInput} label="SKU (Código)" name="sku" type="text" value=${draft.formData.sku} onInput=${handleInput} required=${false} />
                            <button type="button" onClick=${() => setIsScannerOpen(true)} class="absolute top-8 right-3 text-gray-500 hover:text-primary p-1 rounded-full" aria-label="Escanear código de barras">${ICONS.qr_code_scanner}</button>
                        </div>
                        <div>
                            <label for="categoria_search" class="block text-sm font-medium leading-6 text-gray-900">Categoría</label>
                            <div ref=${categoryComboboxRef} class="mt-2 relative">
                                <input id="categoria_search" type="text" value=${draft.categorySearchTerm} onInput=${handleCategorySearchChange} onFocus=${(e) => { e.target.select(); setIsCategoryDropdownOpen(true); }} onKeyDown=${handleCategoryKeyDown} placeholder="Buscar o crear categoría..." class="w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" />
                                ${isCategoryDropdownOpen && html`
                                    <ul class="absolute z-20 bottom-full mb-1 w-full max-h-40 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                        ${finalCategoryOptions.map((cat, index) => html`
                                            <li ref=${el => categoryItemRefs.current[index] = el} onMouseEnter=${() => setHighlightedCategoryIndex(index)} onClick=${() => cat.id === 'CREATE_NEW' ? handleCreateCategory() : handleSelectCategory(cat)} class=${`cursor-pointer select-none relative py-2 px-4 ${highlightedCategoryIndex === index ? 'bg-primary-light' : 'hover:bg-primary-light'} ${cat.id === 'CREATE_NEW' ? 'font-semibold text-primary' : 'text-gray-900'}`}>
                                                ${cat.nombre}
                                            </li>
                                        `)}
                                        ${finalCategoryOptions.length === 0 && !isNewCategory && html`<li class="p-2 text-sm text-gray-500 text-center">No se encontraron categorías.</li>`}
                                    </ul>`}
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <${FormInput} 
                                label="Costo Inicial" 
                                name="costo_inicial" 
                                type="number" 
                                value=${draft.formData.costo_inicial} 
                                onInput=${handleInput} 
                                required=${false} 
                                disabled=${hasPurchases}
                                rightElement=${CostoInfoIcon}
                            />
                            <${FormInput} 
                                label="Precio Venta" 
                                name="precio_base" 
                                type="number" 
                                value=${draft.formData.precio_base} 
                                onInput=${handleInput} 
                                required=${false}
                                disabled=${hasSales}
                                rightElement=${PrecioInfoIcon}
                            />
                            <${FormSelect} 
                                label="Medidas" 
                                name="unidad_medida" 
                                value=${draft.formData.unidad_medida} 
                                onInput=${handleInput}
                            >
                                ${unidadesDeMedida.map(unidad => html`<option value=${unidad}>${unidad}</option>`)}
                            <//>
                        </div>
                    </div>
                </div>`}
        <//>
        <${CameraScanner} isOpen=${isScannerOpen} onClose=${() => setIsScannerOpen(false)} onScanSuccess=${handleScanSuccess}/>
    `;
}