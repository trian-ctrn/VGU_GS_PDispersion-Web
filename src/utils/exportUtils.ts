import type { Assignment } from './graphColoring';

export const exportCSV = (assignments: Assignment[], examId: number): void => {
    const header = 'exam_id,student_id,student_name,seat_row,seat_col';
    const rows = assignments.map(
        a => `${examId},${a.student.id},"${a.student.name}",${a.point.x},${a.point.y}`,
    );
    const csvContent = [header, ...rows].join('\n');
    downloadBlob(
        new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
        `seating_exam_${examId}.csv`,
    );
};

export const exportPNG = async (elementId: string, examId: number): Promise<void> => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(el, { backgroundColor: '#1a1a1a', scale: 2 });
    canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, `seating_exam_${examId}.png`);
    }, 'image/png');
};

export const exportPDF = async (elementId: string, examId: number): Promise<void> => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(el, { backgroundColor: '#1a1a1a', scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pxPerMm = 2.8346;
    const imgWidthMm = canvas.width / pxPerMm;
    const imgHeightMm = canvas.height / pxPerMm;

    const pdf = new jsPDF({
        orientation: imgWidthMm > imgHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [imgWidthMm + 20, imgHeightMm + 30],
    });

    pdf.setFontSize(14);
    pdf.text(`Seating Map – Exam ${examId}`, 10, 12);
    pdf.addImage(imgData, 'PNG', 10, 20, imgWidthMm, imgHeightMm);
    pdf.save(`seating_exam_${examId}.pdf`);
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
