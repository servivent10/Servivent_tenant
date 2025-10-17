/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from './Icons.js';
import { useEffect, useRef } from 'preact/hooks';

const RichTextButton = ({ onClick, children, title }) => html`
    <button type="button" title=${title} onMouseDown=${(e) => { e.preventDefault(); onClick(); }} class="p-2 rounded hover:bg-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary">
        ${children}
    </button>
`;

const ColorPicker = ({ onColorChange }) => {
    const colors = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f97316'];
    return html`
        <div class="relative group">
            <button type="button" title="Color de Texto" class="p-2 rounded hover:bg-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary">
                ${ICONS.palette}
            </button>
            <div class="absolute top-full left-0 mt-1 p-2 bg-white border rounded shadow-lg hidden group-focus-within:flex group-hover:flex gap-1 z-10">
                ${colors.map(color => html`
                    <button type="button" onMouseDown=${(e) => { e.preventDefault(); onColorChange(color); }} style=${{ backgroundColor: color }} class="w-6 h-6 rounded-full border focus:outline-none focus:ring-2 focus:ring-primary"></button>
                `)}
            </div>
        </div>
    `;
};

const FontSizePicker = ({ onSizeChange }) => {
    const sizes = [
        { label: 'Pequeño', value: '2' }, // Corresponde a <font size="2">
        { label: 'Normal', value: '3' },
        { label: 'Grande', value: '5' },
        { label: 'Enorme', value: '7' },
    ];
    return html`
        <div class="relative group">
            <button type="button" title="Tamaño de Fuente" class="p-2 rounded hover:bg-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary">
                ${ICONS.fontSize}
            </button>
            <div class="absolute top-full left-0 mt-1 w-32 bg-white border rounded shadow-lg hidden group-focus-within:block group-hover:block z-10">
                ${sizes.map(size => html`
                    <button type="button" onMouseDown=${(e) => { e.preventDefault(); onSizeChange(size.value); }} class="w-full text-left px-3 py-1 text-sm hover:bg-gray-100 focus:outline-none focus:bg-gray-100">${size.label}</button>
                `)}
            </div>
        </div>
    `;
};

export const RichTextInput = ({ label, value, onInput, ...props }) => {
    const editorRef = useRef(null);

    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInputEvent = (e) => {
        onInput(e.currentTarget.innerHTML);
    };
    
    const execCmd = (cmd, arg = null) => {
        document.execCommand(cmd, false, arg);
        editorRef.current?.focus();
        if (editorRef.current) {
            onInput(editorRef.current.innerHTML);
        }
    };
    
    return html`
        <div>
            ${label && html`<label class="block text-sm font-medium leading-6 text-gray-900">${label}</label>`}
            <div class="mt-2 w-full border border-gray-300 rounded-md shadow-sm overflow-hidden focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25">
                <div class="flex items-center p-1 bg-gray-50 border-b border-gray-200 flex-wrap">
                    <${RichTextButton} title="Negrita" onClick=${() => execCmd('bold')}>${ICONS.bold}<//>
                    <${RichTextButton} title="Cursiva" onClick=${() => execCmd('italic')}>${ICONS.italic}<//>
                    <${RichTextButton} title="Subrayado" onClick=${() => execCmd('underline')}>${ICONS.underline}<//>
                    <div class="w-px h-5 bg-gray-300 mx-2"></div>
                    <${FontSizePicker} onSizeChange=${size => execCmd('fontSize', size)} />
                    <${ColorPicker} onColorChange=${color => execCmd('foreColor', color)} />
                </div>
                <div
                    ref=${editorRef}
                    contentEditable="true"
                    onInput=${handleInputEvent}
                    dangerouslySetInnerHTML=${{ __html: value || '' }}
                    class="p-3 min-h-[12rem] bg-white text-gray-900 focus:outline-none whitespace-pre-wrap"
                    ...${props}
                >
                </div>
            </div>
        </div>
    `;
};