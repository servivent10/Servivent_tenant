/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

export function DireccionFormModal({ isOpen, onClose, onSave, addressToEdit }) {
    const isEditMode = Boolean(addressToEdit);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        nombre: '',
        direccion_texto: '',
        latitud: 0,
        longitud: 0,
        es_principal: false,
    });
    const [isLoading, setIsLoading] = useState(false);

    const mapRef = useRef(null);
    const searchInputRef = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const [isMapLoading, setIsMapLoading] = useState(true);

    const handleInput = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const initAutocomplete = useCallback((map) => {
        if (!searchInputRef.current || !(window as any).google) return;
        
        const autocomplete = new (window as any).google.maps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: "bo" },
            fields: ["name", "formatted_address", "geometry"],
        });

        autocomplete.bindTo("bounds", map);

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                map.setCenter(place.geometry.location);
                if (markerInstance.current) {
                    markerInstance.current.setPosition(place.geometry.location);
                }
                
                let addressText = place.formatted_address || '';
                if (place.name && !addressText.startsWith(place.name)) {
                    addressText = `${place.name}, ${addressText}`;
                }

                if (searchInputRef.current) {
                    searchInputRef.current.value = addressText;
                }

                setFormData(prev => ({
                    ...prev,
                    direccion_texto: addressText,
                    latitud: place.geometry.location.lat(),
                    longitud: place.geometry.location.lng()
                }));
            }
        });
    }, []);

    const initMap = useCallback(() => {
        if (!isOpen || mapInstance.current || !mapRef.current || !(window as any).google) {
            return;
        }

        setIsMapLoading(true);

        const defaultLocation = { lat: -16.5000, lng: -68.1500 }; // La Paz, Bolivia

        const setupGoogleMap = (location) => {
            mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
                center: location,
                zoom: 16,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
            });

            markerInstance.current = new (window as any).google.maps.Marker({
                position: location,
                map: mapInstance.current,
                draggable: true,
                title: "Arrastra para ajustar la ubicación",
                animation: (window as any).google.maps.Animation.DROP,
            });

            markerInstance.current.addListener('dragend', () => {
                const newPosition = markerInstance.current.getPosition();
                if (newPosition) {
                    setFormData(prev => ({
                        ...prev,
                        latitud: newPosition.lat(),
                        longitud: newPosition.lng()
                    }));
                }
            });
            
            initAutocomplete(mapInstance.current);
            setIsMapLoading(false);
        };
        
        let initialLocation = isEditMode && addressToEdit.latitud && addressToEdit.longitud
            ? { lat: Number(addressToEdit.latitud), lng: Number(addressToEdit.longitud) }
            : null;
        
        if (initialLocation) {
            setupGoogleMap(initialLocation);
            setFormData(prev => ({...prev, latitud: initialLocation.lat, longitud: initialLocation.lng}));
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setupGoogleMap(userLocation);
                    setFormData(prev => ({...prev, latitud: userLocation.lat, longitud: userLocation.lng}));
                },
                () => {
                    setupGoogleMap(defaultLocation);
                    setFormData(prev => ({...prev, latitud: defaultLocation.lat, longitud: defaultLocation.lng}));
                }
            );
        } else {
            setupGoogleMap(defaultLocation);
            setFormData(prev => ({...prev, latitud: defaultLocation.lat, longitud: defaultLocation.lng}));
        }
    }, [isOpen, isEditMode, addressToEdit, initAutocomplete]);


    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setFormData({
                    nombre: addressToEdit.nombre || '',
                    direccion_texto: addressToEdit.direccion_texto || '',
                    latitud: Number(addressToEdit.latitud) || 0,
                    longitud: Number(addressToEdit.longitud) || 0,
                    es_principal: addressToEdit.es_principal || false,
                });
            } else {
                setFormData({
                    nombre: '', direccion_texto: '', latitud: 0, longitud: 0, es_principal: false,
                });
            }
            setTimeout(initMap, 150);
        } else {
            mapInstance.current = null;
            markerInstance.current = null;
        }
    }, [isOpen, isEditMode, addressToEdit, initMap]);


    const handleConfirm = async () => {
        if (!formData.nombre.trim() || !formData.direccion_texto.trim()) {
            addToast({ message: 'El nombre y la dirección son obligatorios.', type: 'error' });
            return;
        }
        if (!formData.latitud || !formData.longitud) {
            addToast({ message: 'Por favor, selecciona una ubicación en el mapa.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('upsert_direccion', {
                p_id: isEditMode ? addressToEdit.id : null,
                p_nombre: formData.nombre,
                p_direccion_texto: formData.direccion_texto,
                p_latitud: formData.latitud,
                p_longitud: formData.longitud,
                p_es_principal: formData.es_principal,
            });
            if (error) throw error;
            addToast({ message: `Dirección ${isEditMode ? 'actualizada' : 'guardada'} con éxito.`, type: 'success' });
            onSave();
        } catch (err) {
            addToast({ message: `Error al guardar la dirección: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const title = isEditMode ? 'Editar Dirección' : 'Añadir Nueva Dirección';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Guardar Dirección')}
            icon=${ICONS.storefront}
            maxWidthClass="max-w-2xl"
        >
            <div class="space-y-4">
                <${FormInput} label="Nombre del Lugar (ej. Casa, Oficina)" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} />
                
                <div>
                    <label class="block text-sm font-medium text-gray-700">Ubicación en el Mapa</label>
                    <div class="mt-1 relative">
                        <input
                            ref=${searchInputRef}
                            type="text"
                            placeholder="Busca un lugar, comercio o dirección..."
                            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                        />
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                           ${ICONS.search}
                        </div>
                    </div>
                    <div ref=${mapRef} class="mt-2 h-64 w-full rounded-md bg-gray-200 relative overflow-hidden">
                        ${isMapLoading && html`<div class="absolute inset-0 flex items-center justify-center"><${Spinner} color="text-primary"/></div>`}
                    </div>
                </div>

                <${FormInput} label="Dirección Detallada (ej. Edificio, N° de puerta, referencia)" name="direccion_texto" type="text" value=${formData.direccion_texto} onInput=${handleInput} />
                
                <div class="relative flex items-start">
                    <div class="flex h-6 items-center">
                        <input id="es_principal" name="es_principal" type="checkbox" checked=${formData.es_principal} onChange=${handleInput} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    </div>
                    <div class="ml-3 text-sm leading-6">
                        <label for="es_principal" class="font-medium text-gray-900">Marcar como dirección principal</label>
                    </div>
                </div>
            </div>
        <//>
    `;
}