/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException, DecodeHintType } from '@zxing/library';
import { ICONS } from './Icons.js';
import { useToast } from '../hooks/useToast.js';

export function CameraScanner({ isOpen, onClose, onScanSuccess }) {
    const videoRef = useRef(null);
    const controlsRef = useRef(null);
    const hasScannedRef = useRef(false);
    const { addToast } = useToast();
    const [isStarting, setIsStarting] = useState(true);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        hasScannedRef.current = false;
        setIsSuccess(false);
        setIsStarting(true);

        const codeReader = new BrowserMultiFormatReader(new Map([
            [DecodeHintType.TRY_HARDER, false]
        ]));

        const startScanner = async () => {
            try {
                const constraints = {
                    audio: false,
                    video: {
                        facingMode: 'environment',
                        focusMode: 'continuous'
                    }
                };

                const controls = await codeReader.decodeFromConstraints(constraints, videoRef.current, (result, err) => {
                    if (isStarting) {
                       setIsStarting(false);
                    }

                    if (result && !hasScannedRef.current) {
                        hasScannedRef.current = true;
                        setIsSuccess(true);
                        
                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }

                        setTimeout(() => {
                            onScanSuccess(result.getText());
                        }, 300);
                    }

                    if (err && !(err instanceof NotFoundException) && !err.message.includes('No MultiFormat Readers were able to detect the code')) {
                        console.error('Error de escaneo:', err);
                        addToast({ message: `Error de escaneo: ${err.message}`, type: 'error' });
                    }
                });
                
                controlsRef.current = controls;

            } catch (err) {
                console.error("Error al iniciar el escáner:", err);
                let errorMessage;
                switch (err.name) {
                    case 'NotAllowedError':
                        errorMessage = 'Permiso de cámara denegado. Habilítalo en la configuración de tu navegador.';
                        break;
                    case 'NotFoundError':
                    case 'OverconstrainedError':
                        errorMessage = 'No se encontró una cámara compatible o no soporta el modo de enfoque requerido.';
                        break;
                    default:
                        errorMessage = `No se pudo acceder a la cámara: ${err.message}`;
                        break;
                }
                addToast({ message: errorMessage, type: 'error', duration: 8000 });
                onClose();
            }
        };

        startScanner();

        return () => {
            if (controlsRef.current) {
                controlsRef.current.stop();
                controlsRef.current = null;
            }
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }
    
    const viewfinderBorderClass = isSuccess ? 'border-green-400' : 'border-white';

    return html`
        <div class="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center animate-modal-fade-in" role="dialog" aria-modal="true">
            <video ref=${videoRef} class="absolute top-0 left-0 w-full h-full object-cover z-0" playsinline />
            
            <div class="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                <div class="w-4/5 max-w-sm aspect-video relative overflow-hidden" id="viewfinder">
                    <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 ${viewfinderBorderClass} rounded-tl-lg transition-colors duration-300"></div>
                    <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 ${viewfinderBorderClass} rounded-tr-lg transition-colors duration-300"></div>
                    <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 ${viewfinderBorderClass} rounded-bl-lg transition-colors duration-300"></div>
                    <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 ${viewfinderBorderClass} rounded-br-lg transition-colors duration-300"></div>

                    ${!isSuccess && html`
                        <div 
                            class="absolute w-full h-1.5 bg-gradient-to-b from-red-500/0 via-red-500 to-red-500/0"
                            style="
                                box-shadow: 0 0 15px 2px #ef4444;
                                animation: scan-line-animation 2.5s ease-in-out infinite alternate;
                            "
                        ></div>
                    `}
                    
                    ${isSuccess && html`
                        <div class="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg animate-fade-in-down">
                            <div class="text-green-300 text-8xl" style="filter: drop-shadow(0 0 10px #6ee7b7);">${ICONS.success}</div>
                        </div>
                    `}
                </div>

                <style>
                    @keyframes scan-line-animation {
                        0% { top: 0; }
                        100% { top: calc(100% - 6px); }
                    }
                </style>
                
                ${isStarting && html`<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">Iniciando cámara...</div>`}
                <p class="mt-4 text-white font-semibold text-center z-10 bg-black/30 p-2 rounded">Apunta la cámara al código de barras</p>
            </div>
            
            <button
                onClick=${onClose}
                class="absolute top-4 right-4 z-20 bg-black/50 text-white rounded-full p-3 hover:bg-black/75 pointer-events-auto"
                aria-label="Cerrar escáner"
            >
                ${ICONS.close}
            </button>
        </div>
    `;
}
