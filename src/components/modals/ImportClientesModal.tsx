/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';

const REQUIRED_HEADERS = ['nombre', 'nit_ci', 'telefono', 'correo', 'direccion'];

const StatusIndicator = ({ status }) => {
    if (status === 'loading') {
        return html`<${Spinner} size="h-5 w-5" color="text-gray-500" />`;
    }
    if (status === 'success') {
        return html`<div class="text-emerald-500">${ICONS.success}</div>`;
    }
    if (status === 'error') {
        return html`<div class="text-red-500">${ICONS.error}</div>`;
    }
    // 'pending' state
    return html`<div class="h-5 w-5 flex items-center justify-center"><div class="h-2 w-2 rounded-full bg-gray-300"></div></div>`;
};


export function ImportClientesModal({ isOpen, onClose, onImportSuccess }) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const { addToast } = useToast();

    const [isImporting, setIsImporting] = useState(false);
    const [importSteps, setImportSteps] = useState([]);
    const [importError, setImportError] = useState('');

    const resetState = () => {
        setStep(1);
        setFile(null);
        setParsedData([]);
        setImportResult(null);
        setIsDragOver(false);
        setIsParsing(false);
        setIsImporting(false);
        setImportSteps([]);
        setImportError('');
        onClose();
    };

    const handleDownloadTemplate = () => {
        const headers = "nombre,nit_ci,telefono,correo,direccion";
        const example1 = "Juan Perez,1234567,77712345,juan.perez@email.com,Av. Principal #123";
        const example2 = "Maria Lopez,7654321,66698765,maria.lopez@email.com,Calle Falsa 456";
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, example1, example2].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "plantilla_clientes.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileParse = (fileToParse) => {
        if (!fileToParse) return;
        if (fileToParse.type !== 'text/csv' && !fileToParse.name.endsWith('.csv')) {
            addToast({ message: 'Por favor, sube un archivo CSV.', type: 'error' });
            return;
        }
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                if (typeof text !== 'string') {
                    throw new Error('El contenido del archivo no se pudo leer como texto.');
                }
                const rows = text.trim().split(/\r?\n/);
                const headerRow = rows.shift().split(',').map(h => h.trim().toLowerCase().replace(/\uFEFF/g, ''));
                
                const missingHeaders = REQUIRED_HEADERS.filter(h => !headerRow.includes(h));
                if (missingHeaders.length > 0) {
                    throw new Error(`Faltan las siguientes columnas requeridas: ${missingHeaders.join(', ')}`);
                }

                const data = rows.filter(row => row.trim() !== '').map(row => {
                    const values = row.split(',');
                    const obj = {};
                    headerRow.forEach((header, index) => {
                         if (REQUIRED_HEADERS.includes(header)) {
                             const value = values[index] ? values[index].trim() : '';
                             obj[header] = value === '' ? null : value;
                         }
                    });
                    return obj;
                });
                
                if (data.length === 0) throw new Error('El archivo CSV está vacío o no tiene filas de datos.');
                
                setParsedData(data);
                setFile(fileToParse);
                setStep(2);
            } catch (err) {
                 addToast({ message: `Error al procesar el archivo: ${err.message}`, type: 'error' });
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsText(fileToParse);
    };
    
    const handleFileSelect = (e) => handleFileParse(e.target.files[0]);
    const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragOver(false); handleFileParse(e.dataTransfer.files[0]); }, []);
    const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
    const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragOver(false); }, []);

    const handleImport = async () => {
        setIsImporting(true);
        setImportError('');
        
        const steps = [
            { key: 'sending', label: 'Enviando datos...', status: 'pending' },
            { key: 'processing', label: 'Procesando en base de datos...', status: 'pending' },
            { key: 'finishing', label: 'Finalizando importación...', status: 'pending' },
        ];
        setImportSteps(steps);

        const updateStepStatus = (key, status) => setImportSteps(prev => prev.map(s => s.key === key ? { ...s, status } : s));

        try {
            updateStepStatus('sending', 'loading');
            await new Promise(res => setTimeout(res, 500));
            updateStepStatus('sending', 'success');

            updateStepStatus('processing', 'loading');
            const { data, error } = await supabase.rpc('import_clients_in_bulk', { p_clients: parsedData });
            if (error) throw error;
            updateStepStatus('processing', 'success');

            updateStepStatus('finishing', 'loading');
            await new Promise(res => setTimeout(res, 500));
            updateStepStatus('finishing', 'success');
            
            setImportResult(data);
            setStep(3);

        } catch (err) {
            setImportError(err.message);
            setImportSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
        }
    };
    
    const handleFinish = () => { onImportSuccess(); resetState(); };

    if (!isOpen) return null;

    return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-fade-in" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75" onClick=${resetState}></div>
        <div class="relative w-full max-w-2xl rounded-xl bg-white text-gray-900 shadow-2xl animate-modal-scale-in">
            <div class="flex items-start justify-between p-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold">Importar Clientes</h2>
                <button onClick=${resetState} class="p-1 rounded-full text-gray-400 hover:bg-gray-200">${ICONS.close}</button>
            </div>
            
            <div class="p-6 min-h-[20rem] flex flex-col justify-center">
                ${step === 1 && html`
                    <div class="text-center">
                        <h3 class="text-xl font-semibold mb-2">Paso 1: Sube tu archivo CSV</h3>
                        <p class="text-gray-600 mb-6">Usa nuestra plantilla para asegurar que tus datos se importen correctamente. Si el NIT/CI de un cliente ya existe, se actualizará; si no, se creará uno nuevo.</p>
                        <button onClick=${handleDownloadTemplate} class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">${ICONS.download} Descargar Plantilla</button>
                        <div onDrop=${handleDrop} onDragOver=${handleDragOver} onDragLeave=${handleDragLeave} class="mt-8 p-8 border-2 border-dashed rounded-lg transition-colors ${isDragOver ? 'border-primary bg-primary-light' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}">
                            <div class="text-center">
                                ${isParsing 
                                    ? html`<div class="flex justify-center"><${Spinner} color="text-primary" /></div><p class="mt-2 text-sm text-gray-600">Procesando...</p>`
                                    : html`
                                        <div class="text-4xl text-gray-400">${ICONS.upload_file}</div>
                                        <p class="mt-2 font-semibold text-gray-700">Arrastra y suelta tu archivo aquí</p>
                                        <p class="text-sm text-gray-500">o</p>
                                        <label for="file-upload" class="cursor-pointer text-primary font-semibold hover:underline">
                                            selecciona un archivo
                                            <input id="file-upload" type="file" class="sr-only" accept=".csv,text/csv" onChange=${handleFileSelect} />
                                        </label>
                                    `}
                            </div>
                        </div>
                    </div>
                `}
                ${step === 2 && !isImporting && html`
                    <div class="text-center">
                        <h3 class="text-xl font-semibold mb-2">Paso 2: Confirma la Importación</h3>
                        <p class="text-gray-600 mb-6">Se encontraron <span class="font-bold text-primary">${parsedData.length}</span> clientes en <span class="font-medium text-gray-800">${file?.name}</span>.</p>
                        <div class="flex justify-center gap-4">
                            <button onClick=${() => setStep(1)} class="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Volver</button>
                            <button onClick=${handleImport} class="min-w-[120px] flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Iniciar Importación</button>
                        </div>
                    </div>
                `}
                ${step === 2 && isImporting && html`
                    <div class="text-center">
                        <h3 class="text-xl font-semibold mb-6">${importError ? 'Error en la Importación' : 'Importando...'}</h3>
                        <div class="max-w-sm mx-auto text-left space-y-3">
                            ${importSteps.map(s => html`
                                <div key=${s.key} class="flex items-center justify-between text-gray-700 text-sm animate-fade-in-down">
                                    <span>${s.label}</span>
                                    <${StatusIndicator} status=${s.status} />
                                </div>
                            `)}
                        </div>
                        ${importError && html`
                            <div class="mt-4 p-3 rounded-md bg-red-50 text-red-800 text-sm text-left border border-red-200">
                                <p class="font-bold">Detalle del Error:</p>
                                <p>${importError}</p>
                            </div>
                            <div class="mt-6"><button onClick=${() => setIsImporting(false)} class="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Volver</button></div>
                        `}
                    </div>
                `}
                ${step === 3 && importResult && html`
                    <div class="text-center">
                        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">${ICONS.success}</div>
                        <h3 class="text-xl font-semibold mt-4">Importación Completada</h3>
                        <div class="mt-4 grid grid-cols-3 gap-4 text-center">
                            <div><p class="text-3xl font-bold text-green-600">${importResult.created}</p><p class="text-sm text-gray-500">Creados</p></div>
                            <div><p class="text-3xl font-bold text-blue-600">${importResult.updated}</p><p class="text-sm text-gray-500">Actualizados</p></div>
                            <div><p class="text-3xl font-bold text-red-600">${importResult.errors}</p><p class="text-sm text-gray-500">Errores</p></div>
                        </div>
                        ${importResult.errors > 0 && html`
                            <div class="mt-4 text-left max-h-32 overflow-y-auto bg-gray-100 p-2 rounded-md border text-xs text-red-700">
                                <h4 class="font-bold mb-1">Detalles de errores:</h4>
                                <ul>${importResult.error_messages.map(msg => html`<li>- ${msg}</li>`)}</ul>
                            </div>
                        `}
                        <div class="mt-8"><button onClick=${handleFinish} class="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Finalizar</button></div>
                    </div>
                `}
            </div>
        </div>
    </div>
    `;
}