/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

const unidadesDeMedida = ['Unidad', 'Pieza', 'Caja', 'Paquete', 'Docena', 'Kg', 'Gramo', 'Litro', 'Metro'];

export function ProductFormModal({ isOpen, onClose, onSave, productToEdit, user }) {
    const isEditMode = Boolean(productToEdit);
    const { addToast } = useToast();
    const fileInputRef = useRef(null);
    const [showModal, setShowModal] = useState(isOpen);

    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        nombre: '', sku: '', marca: '', modelo: '',
        descripcion: '', categoria_id: '', unidad_medida: 'Unidad'
    });
    const [errors, setErrors] = useState({ nombre: '' });
    
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setShowModal(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setShowModal(false);
                document.body.style.overflow = 'auto';
            }, 200); // Match animation duration
            return () => clearTimeout(timer);
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    const fetchCategories = async () => {
        const { data, error } = await supabase.rpc('get_all_categories');
        if (error) {
            addToast({ message: 'Error al cargar categorías.', type: 'error' });
        } else {
            setCategories(data || []);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCategories();

            if (isEditMode) {
                setFormData({
                    nombre: productToEdit.nombre || '', sku: productToEdit.sku || '',
                    marca: productToEdit.marca || '', modelo: productToEdit.modelo || '',
                    descripcion: productToEdit.descripcion || '',
                    categoria_id: productToEdit.categoria_id || '',
                    unidad_medida: productToEdit.unidad_medida || 'Unidad'
                });
                // TODO: Cargar imágenes existentes si estamos en modo edición.
            } else {
                 setFormData({
                    nombre: '', sku: '', marca: '', modelo: '',
                    descripcion: '', categoria_id: '', unidad_medida: 'Unidad'
                });
            }
            // Reset states
            setErrors({ nombre: '' });
            setImageFiles([]);
            setImagePreviews([]);
            setIsAddingCategory(false);
            setNewCategoryName('');
        }
    }, [isOpen, productToEdit, isEditMode]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'nombre' && errors.nombre) {
             setErrors(prev => ({ ...prev, nombre: '' }));
        }
    };

    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const files = target.files ? Array.from(target.files) : [];
        const newImageFiles: File[] = [];
        const newImagePreviews: string[] = [];

        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast({ message: `El archivo ${file.name} es demasiado grande (máx 5MB).`, type: 'error' });
                return;
            }
            newImageFiles.push(file);
            newImagePreviews.push(URL.createObjectURL(file));
        });

        setImageFiles(prev => [...prev, ...newImageFiles]);
        setImagePreviews(prev => [...prev, ...newImagePreviews]);
    };

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            addToast({ message: 'El nombre de la categoría no puede estar vacío.', type: 'warning' });
            return;
        }
        setIsLoading(true);
        try {
            const { data: newCategory, error } = await supabase.rpc('create_category', { p_nombre: newCategoryName });
            if (error) throw error;
            
            addToast({ message: `Categoría "${newCategory.nombre}" creada.`, type: 'success' });
            await fetchCategories();
            setFormData(prev => ({ ...prev, categoria_id: newCategory.id }));
            setIsAddingCategory(false);
            setNewCategoryName('');

        } catch (err) {
            addToast({ message: `Error al crear categoría: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const validateForm = () => {
        const newErrors = { nombre: '' };
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre del producto es obligatorio.';
        }
        setErrors(newErrors);
        return !newErrors.nombre;
    };

    const handleConfirm = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            // Step 1: Create/Update the product entry in the database
            const { data: productId, error: upsertError } = await supabase.rpc('upsert_product', {
                p_id: isEditMode ? productToEdit.id : null,
                p_nombre: formData.nombre,
                p_sku: formData.sku || null,
                p_marca: formData.marca || null,
                p_modelo: formData.modelo || null,
                p_descripcion: formData.descripcion || null,
                p_categoria_id: formData.categoria_id || null,
                p_unidad_medida: formData.unidad_medida
            });
            if (upsertError) throw upsertError;

            // Step 2: If there are images, upload them to Storage
            if (imageFiles.length > 0) {
                const uploadPromises = imageFiles.map(file => {
                    const fileExt = file.name.split('.').pop();
                    const filePath = `${user.empresa_id}/${productId}/${crypto.randomUUID()}.${fileExt}`;
                    return supabase.storage.from('productos').upload(filePath, file);
                });

                const uploadResults = await Promise.all(uploadPromises);
                const failedUploads = uploadResults.filter(res => res.error);
                if (failedUploads.length > 0) {
                    throw new Error(`Fallo al subir ${failedUploads.length} imágenes: ${failedUploads[0].error.message}`);
                }
                
                // Step 3: Get public URLs and associate them with the product
                const imageData = uploadResults.map((res, index) => {
                    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(res.data.path);
                    return { imagen_url: urlData.publicUrl, orden: index };
                });
                
                const { error: imageError } = await supabase.rpc('add_product_images', {
                    p_producto_id: productId,
                    p_images: imageData
                });
                if (imageError) throw imageError;
            }

            onSave(isEditMode ? 'edit' : 'create', productId);
        } catch (err) {
            console.error('Error saving product:', err);
             let friendlyError = err.message;
             if (err.message.includes('productos_sku_empresa_id_key')) {
                friendlyError = `El SKU "${formData.sku}" ya está en uso. Debe ser único.`;
            }
            addToast({ message: `Error al guardar: ${friendlyError}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Producto' : 'Añadir Nuevo Producto';

    if (!showModal) {
        return null;
    }

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Producto')}
            icon=${ICONS.products}
            maxWidthClass="max-w-4xl"
        >
                <div class="max-h-[70vh] overflow-y-auto -m-6 p-6 text-gray-600">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                            <label class="block font-medium leading-6 text-gray-900">Imágenes</label>
                            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                ${imagePreviews.map((src, index) => html`
                                    <div class="relative group aspect-square">
                                        <img src=${src} class="w-full h-full object-cover rounded-md" />
                                        <button onClick=${() => removeImage(index)} class="absolute top-0 right-0 -m-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            ${ICONS.close}
                                        </button>
                                    </div>
                                `)}
                                <button onClick=${() => fileInputRef.current.click()} class="flex items-center justify-center aspect-square w-full border-2 border-dashed border-gray-300 rounded-md text-gray-400 hover:border-primary hover:text-primary transition-colors">
                                    ${ICONS.add}
                                </button>
                            </div>
                            <input ref=${fileInputRef} type="file" class="hidden" accept="image/png, image/jpeg, image/webp" onChange=${handleFileChange} multiple />
                        </div>
                        
                        <div class="space-y-4">
                            <${FormInput} label="Nombre del Producto" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} error=${errors.nombre} />
                            <div class="grid grid-cols-2 gap-4">
                                <${FormInput} label="Marca" name="marca" type="text" value=${formData.marca} onInput=${handleInput} required=${false} />
                                <${FormInput} label="Modelo" name="modelo" type="text" value=${formData.modelo} onInput=${handleInput} required=${false} />
                            </div>
                            <${FormInput} label="SKU (Código)" name="sku" type="text" value=${formData.sku} onInput=${handleInput} required=${false} />
                            
                            <div>
                                <label for="categoria_id" class="block font-medium leading-6 text-gray-900">Categoría</label>
                                ${isAddingCategory ? html`
                                    <div class="flex items-center gap-2 mt-1">
                                        <input type="text" value=${newCategoryName} onInput=${e => setNewCategoryName(e.target.value)} placeholder="Nueva categoría" class="flex-grow block w-full rounded-md border border-gray-300 p-2 text-gray-900 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" />
                                        <button onClick=${handleCreateCategory} disabled=${isLoading} class="p-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white">${ICONS.success}</button>
                                        <button onClick=${() => setIsAddingCategory(false)} class="p-2 rounded-md bg-gray-500 hover:bg-gray-400 text-white">${ICONS.close}</button>
                                    </div>
                                ` : html`
                                    <div class="flex items-center gap-2 mt-1">
                                        <select id="categoria_id" name="categoria_id" value=${formData.categoria_id} onInput=${handleInput} class="flex-grow block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                            <option value="">Sin categoría</option>
                                            ${categories.map(cat => html`<option value=${cat.id}>${cat.nombre}</option>`)}
                                        </select>
                                        <button onClick=${() => setIsAddingCategory(true)} title="Nueva Categoría" class="p-2 rounded-md bg-primary hover:bg-primary-hover text-white">${ICONS.add}</button>
                                    </div>
                                `}
                            </div>

                            <div>
                                <label for="unidad_medida" class="block font-medium leading-6 text-gray-900">Unidad de Medida</label>
                                <select id="unidad_medida" name="unidad_medida" value=${formData.unidad_medida} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                    ${unidadesDeMedida.map(unidad => html`<option value=${unidad}>${unidad}</option>`)}
                                </select>
                            </div>
                            
                            <div>
                                <label for="descripcion" class="block font-medium leading-6 text-gray-900">Descripción (Opcional)</label>
                                <textarea id="descripcion" name="descripcion" rows="3" onInput=${handleInput} value=${formData.descripcion} class="mt-1 block w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
        <//>
    `;
}