import type { Student } from './graphColoring';

export const parseCSV = (text: string): Student[] => {
    const lines = text.trim().split(/\r?\n/);
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('id') || firstLine.includes('name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines
        .filter(l => l.trim())
        .map(line => {
            const parts = line.match(/(".*?"|[^,]+)/g) ?? line.split(',');
            const id = parts[0]?.replace(/"/g, '').trim() ?? '';
            const name = parts[1]?.replace(/"/g, '').trim() ?? '';
            return { id, name };
        })
        .filter(s => s.id && s.name);
};
