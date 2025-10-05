/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../Icons.js';
import { GastoCategoriaFormModal } from './GastoCategoriaFormModal.js';

export function GastoFormModal({ isOpen, onClose, onSave, gastoToEdit, categorias, user, onCategoryAdded }) {
    const isEditMode = Boolean(gastoToEdit);
    const { addToast } = useToast();
    const fileInputRef = useRef(null);

    const getInitialState = () => ({
        concepto: '',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        categoria_id: '',
        comprobante_url: null
    });

    const [formData, setFormData] = useState(getInitialState());
    const [comprobanteFile, setComprobanteFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ concepto?: string; monto?: string; }>({});
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [justAddedCategoryName, setJustAddedCategoryName] = useState(null);
    const comboboxRef = useRef(null);
    const itemRefs = useRef([]);

    // Effect to initialize or reset the form ONLY when the modal opens
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setComprobanteFile(null);
            setFileName('');
            setJustAddedCategoryName(null);

            if (isEditMode) {
                const cat = categorias.find(c => c.id === gastoToEdit.categoria_id);
                setSearchTerm(cat ? cat.nombre : '');
                
                setFormData({
                    concepto: gastoToEdit.concepto || '',
                    monto: gastoToEdit.monto || '',
                    fecha: gastoToEdit.fecha ? new Date(gastoToEdit.fecha).toISOString().split('T')[0] : getInitialState().fecha,
                    categoria_id: gastoToEdit.categoria_id || '',
                    comprobante_url: gastoToEdit.comprobante_url || null,
                });
                setFileName(gastoToEdit.comprobante_url ? 'Recibo existente' : '');
            } else {
                setFormData(getInitialState());
                setSearchTerm('');
            }
        }
    }, [isOpen, gastoToEdit]);
    
    // Effect to auto-select a newly added category without resetting the form
    useEffect(() => {
        if (justAddedCategoryName && categorias.length > 0) {
            const newCat = categorias.find(c => c.nombre === justAddedCategoryName);
            if (newCat) {
                setFormData(prev => ({ ...prev, categoria_id: newCat.id }));
                setSearchTerm(newCat.nombre);
                setJustAddedCategoryName(null);
            }
        }
    }, [categorias, justAddedCategoryName]);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                addToast({ message: 'El archivo es demasiado grande (máx 5MB).', type: 'error' });
                return;
            }
            setComprobanteFile(file);
            setFileName(file.name);
        }
    };

    const handleConfirm = async () => {
        const newErrors: { concepto?: string, monto?: string } = {};
        if (!formData.concepto.trim()) newErrors.concepto = 'El concepto es obligatorio.';
        if (!formData.monto || Number(formData.monto) <= 0) newErrors.monto = 'El monto debe ser mayor a cero.';
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);
        try {
            let fileUrl = formData.comprobante_url;

            if (comprobanteFile) {
                const fileExt = comprobanteFile.name.split('.').pop();
                const filePath = `${user.empresa_id}/comprobantes_gastos/${crypto.randomUUID()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('comprobantes').upload(filePath, comprobanteFile);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(filePath);
                fileUrl = urlData.publicUrl;
            }

            const { error: rpcError } = await supabase.rpc('upsert_gasto', {
                p_id: isEditMode ? gastoToEdit.id : null,
                p_concepto: formData.concepto,
                p_monto: Number(formData.monto),
                p_fecha: formData.fecha,
                p_categoria_id: formData.categoria_id || null,
                p_comprobante_url: fileUrl
            });

            if (rpcError) throw rpcError;
            addToast({ message: `Gasto ${isEditMode ? 'actualizado' : 'registrado'} con éxito.`, type: 'success' });
            onSave();
        } catch (err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const filteredCategories = useMemo(() => {
        const allOptions = [{ id: 'add_new', nombre: 'Agregar nueva categoría' }, ...categorias];
        if (!searchTerm) return allOptions;
        const lowerCaseTerm = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Agregar nueva categoría' },
            ...categorias.filter(c => c.nombre.toLowerCase().includes(lowerCaseTerm))
        ];
    }, [searchTerm, categorias]);

    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isDropdownOpen]);

    const handleSelectCategory = (cat) => {
        if (cat.id === 'add_new') {
            setIsCategoryModalOpen(true);
        } else {
            setFormData(prev => ({ ...prev, categoria_id: cat.id }));
            setSearchTerm(cat.nombre);
        }
        setDropdownOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredCategories.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredCategories.length) % filteredCategories.length);
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelectCategory(filteredCategories[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
        }
    };
    
    const handleClearCategory = () => {
        setFormData(prev => ({ ...prev, categoria_id: '' }));
        setSearchTerm('');
    };

    const handleCategorySave = (newCategoryName) => {
        setJustAddedCategoryName(newCategoryName);
        onCategoryAdded();
        setIsCategoryModalOpen(false);
    };
    
    const title = isEditMode ? 'Editar Gasto' : 'Registrar Gasto';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar'}
            icon=${ICONS.expenses}
        >
            <div class="space-y-4">
                <${FormInput} label="Concepto" name="concepto" type="text" value=${formData.concepto} onInput=${handleInput} error=${errors.concepto} />
                <div class="grid grid-cols-2 gap-4">
                    <${FormInput} label="Monto (Bs)" name="monto" type="number" value=${formData.monto} onInput=${handleInput} error=${errors.monto} />
                    <${FormInput} label="Fecha" name="fecha" type="date" value=${formData.fecha} onInput=${handleInput} />
                </div>
                
                <div ref=${comboboxRef}>
                    <label class="block text-sm font-medium text-gray-700">Categoría (Opcional)</label>
                    <div class="relative mt-1">
                        <input
                            type="text"
                            value=${searchTerm}
                            onFocus=${(e) => { e.target.select(); setDropdownOpen(true); }}
                            onInput=${(e) => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
                            onKeyDown=${handleKeyDown}
                            placeholder="Buscar o seleccionar categoría..."
                            class="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 shadow-sm focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                        />
                         <div class="absolute inset-y-0 right-0 flex items-center pr-2">
                             ${searchTerm && html`
                                <button type="button" onClick=${handleClearCategory} class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
                             `}
                            <button type="button" onClick=${() => setDropdownOpen(p => !p)} class="text-gray-400 hover:text-gray-600">${ICONS.chevron_down}</button>
                        </div>
                        ${isDropdownOpen && html`
                            <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                ${filteredCategories.map((cat, index) => html`
                                    <li 
                                        key=${cat.id}
                                        ref=${el => itemRefs.current[index] = el}
                                        onClick=${() => handleSelectCategory(cat)}
                                        onMouseEnter=${() => setHighlightedIndex(index)}
                                        class=${`relative cursor-pointer select-none p-2
                                        ${cat.id === 'add_new' ? 'font-semibold text-primary' : 'text-gray-900'}
                                        ${highlightedIndex === index ? 'bg-primary-light' : ''} hover:bg-primary-light`}
                                    >
                                        <span class="flex items-center gap-2">${cat.id === 'add_new' ? ICONS.add : ''} ${cat.nombre}</span>
                                    </li>
                                `)}
                            </ul>
                        `}
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Comprobante (Opcional)</label>
                    <div class="mt-1 flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6">
                        <div class="space-y-1 text-center">
                            <div class="text-4xl text-gray-400">${ICONS.upload_file}</div>
                            <div class="flex text-sm text-gray-600">
                                <label for="file-upload-gasto" class="relative cursor-pointer rounded-md bg-white font-medium text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary-dark">
                                    <span>Sube un archivo</span>
                                    <input ref=${fileInputRef} id="file-upload-gasto" name="file-upload-gasto" type="file" class="sr-only" onChange=${handleFileChange} accept="image/*,.pdf" />
                                </label>
                                <p class="pl-1">o arrástralo aquí</p>
                            </div>
                            <p class="text-xs text-gray-500">PNG, JPG, PDF hasta 5MB</p>
                            ${fileName && html`<p class="text-xs font-semibold text-emerald-600 truncate">${fileName}</p>`}
                        </div>
                    </div>
                </div>
            </div>
            <${GastoCategoriaFormModal}
                isOpen=${isCategoryModalOpen}
                onClose=${() => setIsCategoryModalOpen(false)}
                onSave=${handleCategorySave}
            />
        <//>
    `;
}