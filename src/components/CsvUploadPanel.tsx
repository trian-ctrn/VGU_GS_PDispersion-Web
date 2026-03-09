import { useRef, type ChangeEvent } from 'react';
import { parseCSV } from '../utils/csvUtils';
import type { Student } from '../utils/graphColoring';

interface CsvUploadPanelProps {
    examCount: number;
    examCsvs: (Student[] | null)[];
    csvFileNames: string[];
    onCsvLoaded: (examIndex: number, students: Student[], fileName: string) => void;
    onCopyFrom: (targetIndex: number, sourceIndex: number) => void;
    onStartProcessing: () => void;
}

export function CsvUploadPanel({
    examCount,
    examCsvs,
    csvFileNames,
    onCsvLoaded,
    onCopyFrom,
    onStartProcessing,
}: CsvUploadPanelProps) {
    const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleFile = (examIndex: number) => (e: ChangeEvent<HTMLInputElement>) => {
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
            onCsvLoaded(examIndex, students, file.name);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Find exams that already have CSVs loaded (for copy dropdown)
    const loadedExams = examCsvs
        .map((csv, i) => (csv ? i : -1))
        .filter(i => i >= 0);

    const allLoaded = examCsvs.every(csv => csv !== null);

    return (
        <div className="csv-upload-panel">
            <h2 className="upload-title">Upload Student Rosters</h2>
            <p className="upload-desc">
                Upload one CSV per exam, or copy from another exam with the same roster.
            </p>

            <div className="upload-slots">
                {Array.from({ length: examCount }, (_, i) => {
                    const csv = examCsvs[i];
                    const fileName = csvFileNames[i];
                    const isLoaded = csv !== null;

                    return (
                        <div key={i} className={`upload-slot ${isLoaded ? 'loaded' : ''}`}>
                            <div className="slot-header">
                                <span className="slot-label">Exam {i + 1}</span>
                                {isLoaded && (
                                    <span className="slot-badge badge-ok">
                                        ✓ {csv!.length} students
                                    </span>
                                )}
                            </div>

                            {isLoaded && (
                                <p className="slot-file">{fileName}</p>
                            )}

                            <div className="slot-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => fileRefs.current[i]?.click()}
                                >
                                    📂 Upload CSV
                                </button>
                                <input
                                    ref={el => { fileRefs.current[i] = el; }}
                                    type="file"
                                    accept=".csv,text/csv"
                                    style={{ display: 'none' }}
                                    onChange={handleFile(i)}
                                />

                                {loadedExams.length > 0 && (
                                    <select
                                        className="field-select slot-copy-select"
                                        value=""
                                        onChange={e => {
                                            const src = Number(e.target.value);
                                            if (!isNaN(src)) onCopyFrom(i, src);
                                        }}
                                    >
                                        <option value="">Copy from…</option>
                                        {loadedExams
                                            .filter(srcIdx => srcIdx !== i)
                                            .map(srcIdx => (
                                                <option key={srcIdx} value={srcIdx}>
                                                    Exam {srcIdx + 1} ({examCsvs[srcIdx]!.length} students)
                                                </option>
                                            ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                className="btn btn-primary start-btn"
                disabled={!allLoaded}
                onClick={onStartProcessing}
            >
                {allLoaded
                    ? `▶ Start Processing ${examCount} Exams`
                    : `Upload all ${examCount} CSVs to continue`}
            </button>
        </div>
    );
}
