/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

declare const html2canvas: any;
declare const jspdf: any;

export async function generatePdfFromComponent(element: HTMLElement, fileName: string, format: 'a4' | 'ticket' = 'a4') {
    if (!element) {
        throw new Error('Elemento para convertir a PDF no encontrado.');
    }

    const canvas = await html2canvas(element, {
        scale: 2, // Aumentar la resolución para mejor calidad
        useCORS: true,
        logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    
    let pdf;
    
    if (format === 'ticket') {
        // Para formato de ticket, ajustamos el PDF a las dimensiones del contenido
        const ticketWidth = 72; // mm
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pdfHeight = (imgHeight * ticketWidth) / imgWidth;
        pdf = new jspdf.jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [ticketWidth, pdfHeight]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, ticketWidth, pdfHeight);
    } else { // A4 format
        pdf = new jspdf.jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 0;
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    }

    pdf.save(fileName);
}
