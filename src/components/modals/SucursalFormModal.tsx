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

export function SucursalFormModal({ isOpen, onClose, onSave, sucursalToEdit }) {
    const isEditMode = Boolean(sucursalToEdit);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        nombre: '',
        direccion: '',
        telefono: '',
        latitud: null,
        longitud: null,
        tipo: 'Sucursal',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({ nombre: '' });

    const mapRef = useRef(null);
    const searchInputRef = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const [isMapLoading, setIsMapLoading] = useState(true);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'nombre' && errors.nombre) {
            setErrors(prev => ({ ...prev, nombre: '' }));
        }
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
                if (place.name && !addressText.toLowerCase().includes(place.name.toLowerCase())) {
                    addressText = `${place.name}, ${addressText}`;
                }

                if (searchInputRef.current) {
                    searchInputRef.current.value = addressText;
                }

                setFormData(prev => ({
                    ...prev,
                    direccion: addressText,
                    latitud: place.geometry.location.lat(),
                    longitud: place.geometry.location.lng()
                }));
            }
        });
    }, []);

    const geocodePosition = useCallback((pos) => {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const address = results[0].formatted_address;
                setFormData(prev => ({ ...prev, direccion: address }));
                if(searchInputRef.current) searchInputRef.current.value = address;
            } else {
                console.warn('Geocode was not successful for the following reason: ' + status);
            }
        });
    }, []);

    const initMap = useCallback(() => {
        if (!isOpen || mapInstance.current || !mapRef.current || !(window as any).google) {
            return;
        }

        setIsMapLoading(true);

        const defaultLocation = { lat: -17.7833, lng: -63.1821 }; // Santa Cruz, Bolivia

        const setupGoogleMap = (location) => {
            mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
                center: location,
                zoom: 16,
                mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
            });

            markerInstance.current = new (window as any).google.maps.Marker({
                position: location, map: mapInstance.current, draggable: true,
                title: "Arrastra para ajustar la ubicación", animation: (window as any).google.maps.Animation.DROP,
            });

            markerInstance.current.addListener('dragend', () => {
                const newPosition = markerInstance.current.getPosition();
                if (newPosition) {
                    setFormData(prev => ({ ...prev, latitud: newPosition.lat(), longitud: newPosition.lng() }));
                    geocodePosition(newPosition);
                }
            });
            
            initAutocomplete(mapInstance.current);
            setIsMapLoading(false);
        };
        
        let initialLocation = isEditMode && sucursalToEdit.latitud && sucursalToEdit.longitud
            ? { lat: Number(sucursalToEdit.latitud), lng: Number(sucursalToEdit.longitud) }
            : null;
        
        if (initialLocation) {
            setupGoogleMap(initialLocation);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => setupGoogleMap({ lat: position.coords.latitude, lng: position.coords.longitude }),
                () => setupGoogleMap(defaultLocation)
            );
        } else {
            setupGoogleMap(defaultLocation);
        }
    }, [isOpen, isEditMode, sucursalToEdit, initAutocomplete, geocodePosition]);

    useEffect(() => {
        if (isOpen) {
            setErrors({ nombre: '' });
            if (isEditMode) {
                setFormData({
                    nombre: sucursalToEdit.nombre || '',
                    direccion: sucursalToEdit.direccion || '',
                    telefono: sucursalToEdit.telefono || '',
                    latitud: sucursalToEdit.latitud || null,
                    longitud: sucursalToEdit.longitud || null,
                    tipo: sucursalToEdit.tipo || 'Sucursal',
                });
            } else {
                setFormData({ nombre: '', direccion: '', telefono: '', latitud: null, longitud: null, tipo: 'Sucursal' });
            }
            // Use a short timeout to ensure the modal DOM is ready before initializing the map
            setTimeout(initMap, 150);
        } else {
            // Cleanup map instances when modal closes to prevent memory leaks
            mapInstance.current = null;
            markerInstance.current = null;
        }
    }, [isOpen, sucursalToEdit, isEditMode, initMap]);


    const handleConfirm = async () => {
        if (!formData.nombre.trim()) {
            setErrors({ nombre: 'El nombre de la ubicación es obligatorio.' });
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                p_nombre: formData.nombre,
                p_direccion: formData.direccion,
                p_telefono: formData.telefono,
                p_latitud: formData.latitud,
                p_longitud: formData.longitud,
                p_tipo: formData.tipo,
            };

            if (isEditMode) {
                const { error } = await supabase.rpc('update_sucursal', { ...payload, p_sucursal_id: sucursalToEdit.id });
                if (error) throw error;
                onSave('edit');
            } else {
                const { error } = await supabase.rpc('create_sucursal', payload);
                if (error) throw error;
                onSave('create');
            }
        } catch (err) {
            console.error('Error saving sucursal:', err);
            let friendlyError = err.message.includes('Límite de sucursales alcanzado')
                ? 'Has alcanzado el límite de sucursales de tu plan.'
                : err.message;
            addToast({ message: `Error: ${friendlyError}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Ubicación' : 'Añadir Nueva Ubicación';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Ubicación')}
            icon=${ICONS.storefront}
            maxWidthClass="max-w-4xl"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <${FormInput} label="Nombre" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} error=${errors.nombre} />
                    <${FormInput} label="Teléfono (Opcional)" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} required=${false} />
                    <${FormInput} label="Dirección Completa" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} />
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Tipo de Ubicación</label>
                        <fieldset class="mt-2">
                            <div class="space-y-2">
                                <div class="flex items-center gap-x-3">
                                    <input id="tipo-sucursal" name="tipo" type="radio" value="Sucursal" checked=${formData.tipo === 'Sucursal'} onInput=${handleInput} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                                    <label for="tipo-sucursal" class="block text-sm font-medium leading-6 text-gray-900">Sucursal (Punto de Venta)</label>
                                </div>
                                <div class="flex items-center gap-x-3">
                                    <input id="tipo-deposito" name="tipo" type="radio" value="Depósito" checked=${formData.tipo === 'Depósito'} onInput=${handleInput} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                                    <label for="tipo-deposito" class="block text-sm font-medium leading-6 text-gray-900">Depósito (Solo Almacén)</label>
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>
                <div>
                     <label class="block text-sm font-medium text-gray-700">Ubicación en el Mapa</label>
                    <div class="mt-1 relative">
                        <input
                            ref=${searchInputRef}
                            type="text"
                            placeholder="Buscar un lugar, comercio o dirección..."
                            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                        />
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                           ${ICONS.search}
                        </div>
                    </div>
                    <div ref=${mapRef} class="mt-2 h-80 w-full rounded-md bg-gray-200 relative overflow-hidden">
                        ${isMapLoading && html`<div class="absolute inset-0 flex items-center justify-center bg-gray-200/50"><${Spinner} color="text-primary"/></div>`}
                    </div>
                </div>
            </div>
        <//>
    `;
}