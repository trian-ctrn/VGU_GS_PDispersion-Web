import { useRef, type ChangeEvent } from 'react';
import type { Student } from '../utils/graphColoring';
import { parseCSV } from '../utils/csvUtils';

interface CsvImportProps {
    onStudentsLoaded: (students: Student[]) => void;
    studentCount: number;
}

const SAMPLE_ROWS = [
    '1,Alice Nguyen',
    '2,Bob Tran',
    '3,Charlie Le',
    '4,Diana Pham',
    '5,Edward Hoang',
    '6,Fiona Vu',
    '7,George Dao',
    '8,Hannah Bui',
    '9,Ivan Do',
    '10,Julia Ngo',
    '11,Kevin Ly',
    '12,Linda Huynh',
];

const downloadSample = () => {
    const content = ['id,name', ...SAMPLE_ROWS].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
};

export function CsvImport({ onStudentsLoaded, studentCount }: CsvImportProps) {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result as string;
            const students = parseCSV(text);
            if (students.length === 0) {
                alert('No valid students found. Expected columns: id, name');
                return;
            }
            onStudentsLoaded(students);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <section className="panel">
            <div className="panel-row csv-header">
                <span className="field-label">Student Roster</span>
                <span className="help-tip">?
                    <span className="tip-text">Upload a CSV with "id" and "name" columns. Or use the sample file as a template.</span>
                </span>
            </div>
            <div className="panel-row actions">
                <button className="btn btn-secondary" onClick={downloadSample}>
                    ⬇ Sample CSV
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={() => fileRef.current?.click()}
                >
                    📂 Upload CSV
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={handleFile}
                />
            </div>
            <p className="csv-status">
                {studentCount > 0 ? (
                    <>
                        ✓ <strong className="csv-count">{studentCount}</strong>{' '}
                        student{studentCount !== 1 ? 's' : ''} loaded
                    </>
                ) : (
                    <>No roster — using auto-generated students</>
                )}
            </p>
        </section>
    );
}
