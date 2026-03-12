import type { Assignment } from './graphColoring';

interface GridInfo {
    rows: number;
    cols: number;
}

/* ── Build a row×col grid from assignments ── */
const buildGrid = (assignments: Assignment[], grid: GridInfo) => {
    const map = new Map<string, Assignment>();
    assignments.forEach(a => map.set(`${a.point.x},${a.point.y}`, a));
    return { map, rows: grid.rows, cols: grid.cols };
};

/* ═══════════════════════════════════════
   CSV — visual seat-map grid
   ═══════════════════════════════════════ */

export const exportCSV = (assignments: Assignment[], examId: number, grid: GridInfo): void => {
    const { map, rows, cols } = buildGrid(assignments, grid);

    const lines: string[] = [];
    lines.push(`Exam ${examId} - Seating Map`);
    lines.push('');

    // Header row: blank corner + column numbers
    const header = [''].concat(Array.from({ length: cols }, (_, c) => `Col ${c + 1}`));
    lines.push(header.join(','));

    // Data rows
    for (let r = 0; r < rows; r++) {
        const row = [`Row ${r + 1}`];
        for (let c = 0; c < cols; c++) {
            const a = map.get(`${r},${c}`);
            if (a) {
                const conflict = a.hasConflict ? ' [!]' : '';
                row.push(`"${a.student.id} ${a.student.name}${conflict}"`);
            } else {
                row.push('');
            }
        }
        lines.push(row.join(','));
    }

    // Legend
    lines.push('');
    lines.push(`Total students: ${assignments.length}`);
    const conflicts = assignments.filter(a => a.hasConflict).length;
    if (conflicts > 0) lines.push(`Conflicts: ${conflicts}`);
    lines.push('[!] = conflict with adjacent student');

    downloadBlob(
        new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `seating_exam_${examId}.csv`,
    );
};

/* ═══════════════════════════════════════
   Canvas rendering (shared by PNG & PDF)
   ═══════════════════════════════════════ */

const CELL_W = 120;
const CELL_H = 56;
const HEADER_SIZE = 28;
const PADDING = 16;
const TITLE_H = 36;

const renderSeatMapCanvas = (assignments: Assignment[], examId: number, grid: GridInfo): HTMLCanvasElement => {
    const { map, rows, cols } = buildGrid(assignments, grid);

    const totalW = PADDING * 2 + HEADER_SIZE + cols * CELL_W;
    const totalH = PADDING * 2 + TITLE_H + HEADER_SIZE + rows * CELL_H + 30;

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, totalW, totalH);

    const ox = PADDING + HEADER_SIZE;
    const oy = PADDING + TITLE_H + HEADER_SIZE;

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Seat Map — Exam #${examId}`, totalW / 2, PADDING + 20);

    // Column headers
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    for (let c = 0; c < cols; c++) {
        ctx.fillText(`Col ${c + 1}`, ox + c * CELL_W + CELL_W / 2, oy - 8);
    }

    // Row headers
    ctx.textAlign = 'right';
    for (let r = 0; r < rows; r++) {
        ctx.fillText(`Row ${r + 1}`, ox - 6, oy + r * CELL_H + CELL_H / 2 + 4);
    }

    // Cells
    ctx.textAlign = 'center';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = ox + c * CELL_W;
            const y = oy + r * CELL_H;
            const a = map.get(`${r},${c}`);

            // Cell background
            if (a) {
                ctx.fillStyle = a.hasConflict ? '#7f1d1d' : '#1e3a5f';
            } else {
                ctx.fillStyle = '#0f172a';
            }
            ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

            // Cell border
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);

            if (a) {
                // Student ID
                ctx.fillStyle = a.hasConflict ? '#fca5a5' : '#93c5fd';
                ctx.font = 'bold 12px system-ui, sans-serif';
                ctx.fillText(a.student.id, x + CELL_W / 2, y + 20);

                // Student name (truncate if long)
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '10px system-ui, sans-serif';
                let name = a.student.name;
                if (ctx.measureText(name).width > CELL_W - 10) {
                    while (name.length > 3 && ctx.measureText(name + '…').width > CELL_W - 10) {
                        name = name.slice(0, -1);
                    }
                    name += '…';
                }
                ctx.fillText(name, x + CELL_W / 2, y + 36);

                // Conflict marker
                if (a.hasConflict) {
                    ctx.fillStyle = '#ef4444';
                    ctx.font = 'bold 10px system-ui, sans-serif';
                    ctx.fillText('⚠', x + CELL_W - 10, y + 12);
                }
            }
        }
    }

    // Legend bar
    const legendY = oy + rows * CELL_H + 14;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const items: [string, string][] = [
        ['#0f172a', 'Empty'],
        ['#1e3a5f', 'Seated'],
        ['#7f1d1d', 'Conflict'],
    ];
    let lx = PADDING;
    for (const [color, label] of items) {
        ctx.fillStyle = color;
        ctx.fillRect(lx, legendY - 8, 12, 12);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(lx, legendY - 8, 12, 12);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, lx + 16, legendY + 2);
        lx += ctx.measureText(label).width + 32;
    }

    return canvas;
};

/* ═══════════════════════════════════════
   PNG export
   ═══════════════════════════════════════ */

export const exportPNG = (assignments: Assignment[], examId: number, grid: GridInfo): void => {
    const canvas = renderSeatMapCanvas(assignments, examId, grid);
    canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, `seating_exam_${examId}.png`);
    }, 'image/png');
};

/* ═══════════════════════════════════════
   PDF export
   ═══════════════════════════════════════ */

export const exportPDF = async (assignments: Assignment[], examId: number, grid: GridInfo): Promise<void> => {
    const canvas = renderSeatMapCanvas(assignments, examId, grid);
    const { jsPDF } = await import('jspdf');

    const imgData = canvas.toDataURL('image/png');
    const pxPerMm = canvas.width / (canvas.width / 2 / 2.8346);
    const imgWidthMm = canvas.width / pxPerMm;
    const imgHeightMm = canvas.height / pxPerMm;

    const pdf = new jsPDF({
        orientation: imgWidthMm > imgHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [imgWidthMm + 20, imgHeightMm + 20],
    });

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidthMm, imgHeightMm);
    pdf.save(`seating_exam_${examId}.pdf`);
};

/* ── Helper ── */
const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
