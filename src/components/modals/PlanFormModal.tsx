/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Tabs } from '../Tabs.js';

const initialPlanState = {
    id: null, nombre: '', descripcion: '', precio_mensual: null, precio_anual: null,
    precio_unico: null, es_publico: true, es_recomendado: false
};

export function PlanFormModal({ isOpen, onClose, onSave, planId }) {
    const isEditMode = Boolean(planId);
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [activeTab, setActiveTab] = useState('general');

    const [plan, setPlan] = useState(initialPlanState);
    const [caracteristicasLogicas, setCaracteristicasLogicas] = useState([]);
    const [featuresDisplay, setFeaturesDisplay] = useState([]);

    // State for drag-and-drop reordering
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const fetchData = useCallback(async () => {
        if (!isOpen) return;
        setIsFetching(true);
        try {
            const { data, error } = await supabase.rpc('get_plan_details_management', { p_plan_id: planId || '00000000-0000-0000-0000-000000000000' });
            if (error) throw error;
            
            setPlan(data.plan || initialPlanState);
            setCaracteristicasLogicas(data.caracteristicas_logicas || []);
            setFeaturesDisplay(data.features_display || []);
        } catch (err) {
            addToast({ message: `Error al cargar datos del plan: ${err.message}`, type: 'error' });
            onClose();
        } finally {
            setIsFetching(false);
        }
    }, [isOpen, planId, addToast, onClose]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePlanInput = (e) => {
        const { name, value, type, checked } = e.target;
        setPlan(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleCaracteristicaInput = (id, value) => {
        setCaracteristicasLogicas(prev => prev.map(c => c.id === id ? { ...c, valor: value } : c));
    };

    const handleDisplayFeatureInput = (index, field, value) => {
        setFeaturesDisplay(prev => {
            const newFeatures = [...prev];
            newFeatures[index] = { ...newFeatures[index], [field]: value };
            return newFeatures;
        });
    };

    const addDisplayFeature = () => {
        setFeaturesDisplay(prev => [...prev, { texto_caracteristica: '', incluida: true, orden: prev.length }]);
    };

    const removeDisplayFeature = (index) => {
        setFeaturesDisplay(prev => prev.filter((_, i) => i !== index));
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (index !== dragOverIndex) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedItemIndex === null) return;

        const draggedItem = featuresDisplay[draggedItemIndex];
        const newFeatures = [...featuresDisplay];
        newFeatures.splice(draggedItemIndex, 1);
        newFeatures.splice(dropIndex, 0, draggedItem);
        
        setFeaturesDisplay(newFeatures);
        handleDragEnd();
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverIndex(null);
    };
    
    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const caracteristicasLogicasPayload = caracteristicasLogicas
                .filter(c => c.valor !== null && String(c.valor).trim() !== '')
                .map(c => ({ id: c.id, valor: String(c.valor) }));
            
            const featuresDisplayPayload = featuresDisplay
                .filter(f => f.texto_caracteristica.trim() !== '')
                .map((f, index) => ({
                    texto_caracteristica: f.texto_caracteristica,
                    incluida: f.incluida,
                    orden: index
                }));

            const { error } = await supabase.rpc('upsert_plan_with_features', {
                p_plan: plan,
                p_caracteristicas_logicas: caracteristicasLogicasPayload,
                p_features_display: featuresDisplayPayload
            });

            if (error) throw error;
            addToast({ message: 'Plan guardado con éxito.', type: 'success' });
            onSave();
        } catch (err) {
            addToast({ message: `Error al guardar el plan: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? `Editando Plan: ${plan.nombre}` : 'Crear Nuevo Plan';
    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'logicas', label: 'Características del Sistema' },
        { id: 'display', label: 'Características para Mostrar' },
    ];

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar Cambios'}
            icon=${ICONS.credit_score}
            maxWidthClass="max-w-3xl"
        >
            ${isFetching ? html`<div class="flex justify-center items-center h-96"><${Spinner} /></div>` :
                html`
                <div class="space-y-4">
                    <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
                    <div class="mt-4">
                        ${activeTab === 'general' && html`
                            <div class="space-y-4 animate-fade-in-down">
                                <${FormInput} label="Nombre del Plan" name="nombre" value=${plan.nombre} onInput=${handlePlanInput} />
                                <${FormInput} label="Descripción" name="descripcion" value=${plan.descripcion} onInput=${handlePlanInput} required=${false} />
                                <div class="grid grid-cols-3 gap-4">
                                    <${FormInput} label="Precio Mensual (USD)" name="precio_mensual" type="number" value=${plan.precio_mensual} onInput=${handlePlanInput} required=${false} />
                                    <${FormInput} label="Precio Anual (USD)" name="precio_anual" type="number" value=${plan.precio_anual} onInput=${handlePlanInput} required=${false} />
                                    <${FormInput} label="Precio Único (USD)" name="precio_unico" type="number" value=${plan.precio_unico} onInput=${handlePlanInput} required=${false} />
                                </div>
                                <div class="flex items-center gap-6">
                                    <div class="relative flex items-start"><div class="flex h-6 items-center"><input id="es_publico" name="es_publico" type="checkbox" checked=${plan.es_publico} onChange=${handlePlanInput} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /></div><div class="ml-3 text-sm leading-6"><label for="es_publico" class="font-medium text-gray-900">Visible en Registro</label></div></div>
                                    <div class="relative flex items-start"><div class="flex h-6 items-center"><input id="es_recomendado" name="es_recomendado" type="checkbox" checked=${plan.es_recomendado} onChange=${handlePlanInput} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /></div><div class="ml-3 text-sm leading-6"><label for="es_recomendado" class="font-medium text-gray-900">Marcar como Recomendado</label></div></div>
                                </div>
                            </div>
                        `}
                        ${activeTab === 'logicas' && html`
                            <div class="space-y-3 max-h-80 overflow-y-auto pr-2 animate-fade-in-down">
                                ${caracteristicasLogicas.map(c => html`
                                    <div class="grid grid-cols-2 gap-4 items-center">
                                        <label for=${`feat-${c.id}`} class="font-medium text-gray-700 text-sm">${c.nombre_visible}</label>
                                        ${c.tipo === 'BOOLEAN' ? html`
                                            <div class="flex items-center">
                                                <label for=${`feat-${c.id}`} class="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        id=${`feat-${c.id}`}
                                                        checked=${String(c.valor) === 'true'} 
                                                        onChange=${(e) => handleCaracteristicaInput(c.id, String(e.target.checked))}
                                                        class="sr-only peer"
                                                    />
                                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        ` : html`
                                            <input id=${`feat-${c.id}`} type="number" value=${c.valor} onInput=${(e) => handleCaracteristicaInput(c.id, e.target.value)} class="block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" />
                                        `}
                                    </div>
                                `)}
                            </div>
                        `}
                         ${activeTab === 'display' && html`
                            <div class="space-y-3 max-h-80 overflow-y-auto pr-2 animate-fade-in-down">
                                <p class="text-sm text-gray-600">Estas son las características que se mostrarán en la tarjeta del plan. Arrástralas para reordenarlas.</p>
                                ${featuresDisplay.map((f, index) => html`
                                    <div
                                        key=${f.id || index}
                                        draggable="true"
                                        onDragStart=${(e) => handleDragStart(e, index)}
                                        onDragOver=${(e) => handleDragOver(e, index)}
                                        onDrop=${(e) => handleDrop(e, index)}
                                        onDragEnd=${handleDragEnd}
                                        onDragLeave=${() => setDragOverIndex(null)}
                                        class=${`flex items-center gap-2 p-2 rounded-md border transition-all duration-150 ${draggedItemIndex === index ? 'opacity-50 bg-slate-100' : 'bg-white'} ${dragOverIndex === index ? 'border-t-2 border-primary' : 'border-transparent'}`}
                                    >
                                        <div class="text-gray-400 cursor-move">${ICONS.drag_handle}</div>
                                        <input type="checkbox" checked=${f.incluida} onChange=${e => handleDisplayFeatureInput(index, 'incluida', e.target.checked)} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                        <input type="text" value=${f.texto_caracteristica} onInput=${e => handleDisplayFeatureInput(index, 'texto_caracteristica', e.target.value)} class="flex-grow block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" />
                                        <button onClick=${() => removeDisplayFeature(index)} class="text-gray-400 hover:text-red-600">${ICONS.delete}</button>
                                    </div>
                                `)}
                                <button onClick=${addDisplayFeature} class="text-sm font-semibold text-primary hover:underline flex items-center gap-1">${ICONS.add} Añadir característica</button>
                            </div>
                         `}
                    </div>
                </div>
            `}
        <//>
    `;
}