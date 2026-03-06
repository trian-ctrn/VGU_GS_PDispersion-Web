import { useEffect, useState, useCallback } from 'react';
import './App.css';
import init, { Point, solve_p_dispersion } from '../pkg/p_dispersion';

import { Board, cellKey } from './components/Board';
import { ControlPanel } from './components/ControlPanel';
import { CsvImport } from './components/CsvImport';
import { NumberField } from './components/NumberField';
import { useDragSelect } from './hooks/useDragSelect';
import { GRID_CONFIG } from './constants';
import {
    assignStudentsToSeats,
    getForbiddenPairs,
    type Student,
    type ExamRecord,
    type Assignment,
} from './utils/graphColoring';
import { exportCSV, exportPNG, exportPDF } from './utils/exportUtils';

const { DEFAULT_ROWS, DEFAULT_COLS } = GRID_CONFIG;

const generateDefaultRoster = (count: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `Student ${i + 1}`,
    }));

function App() {
    const [ready, setReady] = useState(false);
    const [rows, setRows] = useState(DEFAULT_ROWS);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [placements, setPlacements] = useState(2);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [resultCells, setResultCells] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    /* ── Student & exam state ── */
    const [classRoster, setClassRoster] = useState<Student[]>(generateDefaultRoster(12));
    const [historyLimit, setHistoryLimit] = useState(3);
    const [history, setHistory] = useState<ExamRecord[]>([]);
    const [currentAssignments, setCurrentAssignments] = useState<Assignment[]>([]);
    const [examCounter, setExamCounter] = useState(1);
    const [exporting, setExporting] = useState<string | null>(null);

    useEffect(() => {
        init().then(() => setReady(true));
    }, []);

    /* ── Drag-select painting ── */
    const paintCell = useCallback(
        (r: number, c: number, mode: 'select' | 'deselect') => {
            const key = cellKey(r, c);
            setSelected(prev => {
                const next = new Set(prev);
                mode === 'select' ? next.add(key) : next.delete(key);
                return next;
            });
            setResultCells(new Set());
            setCurrentAssignments([]);
            setError(null);
        },
        [],
    );

    const { onCellDown, onCellEnter, stopDrag } = useDragSelect(paintCell);

    /* ── Board helpers ── */
    const resetBoard = useCallback(() => {
        setSelected(new Set());
        setResultCells(new Set());
        setCurrentAssignments([]);
        setError(null);
    }, []);

    const selectAll = useCallback(() => {
        const all = new Set<string>();
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) all.add(cellKey(r, c));
        setSelected(all);
        setResultCells(new Set());
        setCurrentAssignments([]);
        setError(null);
    }, [rows, cols]);

    const handleRowsChange = (v: number) => { setRows(v); resetBoard(); };
    const handleColsChange = (v: number) => { setCols(v); resetBoard(); };

    /* ── Solver ── */
    const solve = () => {
        setError(null);
        setResultCells(new Set());
        setCurrentAssignments([]);

        const points: InstanceType<typeof Point>[] = [];
        const keyList: string[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (selected.has(cellKey(r, c))) {
                    points.push(new Point(r, c));
                    keyList.push(cellKey(r, c));
                }
            }
        }

        if (points.length === 0) {
            setError('Select at least one cell on the board.');
            return;
        }
        if (placements > points.length) {
            setError(
                `Placements (${placements}) exceeds selected cells (${points.length}).`,
            );
            return;
        }

        try {
            const indices = solve_p_dispersion(points, placements);
            const result = new Set<string>();
            const optimalSeats: InstanceType<typeof Point>[] = [];
            indices.forEach((i: number) => {
                result.add(keyList[i]);
                optimalSeats.push(points[i]);
            });
            setResultCells(result);

            // Assign students to optimal seats via graph coloring
            if (classRoster.length > 0 && placements > 0) {
                const studentsToAssign = classRoster.slice(0, placements);
                const forbiddenPairs = getForbiddenPairs(history, historyLimit);
                const assignments = assignStudentsToSeats(
                    optimalSeats,
                    studentsToAssign,
                    forbiddenPairs,
                );
                setCurrentAssignments(assignments);

                const conflictCount = assignments.filter(a => a.hasConflict).length;
                setHistory(prev => [...prev, { id: examCounter, assignments }]);
                setExamCounter(prev => prev + 1);

                if (conflictCount > 0) {
                    setError(
                        `⚠ Exam ${examCounter} assigned with ${conflictCount} conflict(s)!`,
                    );
                }
            }
        } catch (e: unknown) {
            setError(
                `Solver error: ${e instanceof Error ? e.message : String(e)}`,
            );
        }
    };

    /* ── Export ── */
    const handleExport = async (type: 'csv' | 'png' | 'pdf') => {
        if (currentAssignments.length === 0) return;
        setExporting(type);
        try {
            const examId = examCounter - 1;
            if (type === 'csv') exportCSV(currentAssignments, examId);
            else if (type === 'png') await exportPNG('seating-result', examId);
            else await exportPDF('seating-result', examId);
        } finally {
            setExporting(null);
        }
    };

    /* ── Build assignment map for seating display ── */
    const assignmentMap = new Map<string, { name: string; hasConflict: boolean }>();
    currentAssignments.forEach(a => {
        assignmentMap.set(`${a.point.x},${a.point.y}`, {
            name: a.student.name,
            hasConflict: a.hasConflict ?? false,
        });
    });

    return (
        <div className="app" onPointerUp={stopDrag} onPointerLeave={stopDrag}>
            <header className="header">
                <h1>P-Dispersion Solver</h1>
                <p className="subtitle">
                    Click &amp; drag to select candidates · adjust settings · hit{' '}
                    <strong>Solve</strong>
                </p>
            </header>

            <CsvImport
                onStudentsLoaded={setClassRoster}
                studentCount={classRoster.length}
            />

            <ControlPanel
                rows={rows}
                cols={cols}
                placements={placements}
                ready={ready}
                onRowsChange={handleRowsChange}
                onColsChange={handleColsChange}
                onPlacementsChange={setPlacements}
                onSelectAll={selectAll}
                onClear={resetBoard}
                onSolve={solve}
            />

            <section className="panel">
                <div className="panel-row">
                    <NumberField
                        label="History Limit"
                        value={historyLimit}
                        min={0}
                        max={10}
                        onChange={setHistoryLimit}
                    />
                    <div className="field">
                        <span className="field-label">Students</span>
                        <span className="info-value">{classRoster.length}</span>
                    </div>
                    <div className="field">
                        <span className="field-label">Exams Run</span>
                        <span className="info-value">{history.length}</span>
                    </div>
                </div>
            </section>

            {error && <p className="error">{error}</p>}

            <Board
                rows={rows}
                cols={cols}
                selected={selected}
                resultCells={resultCells}
                onCellDown={onCellDown}
                onCellEnter={onCellEnter}
            />

            {/* ── Assignment Results ── */}
            {currentAssignments.length > 0 && (
                <section className="panel results-section">
                    <h3 className="results-title">
                        Exam {examCounter - 1} — {currentAssignments.length} student
                        {currentAssignments.length !== 1 ? 's' : ''} assigned
                    </h3>

                    <div id="seating-result" className="seating-grid-wrapper">
                        <div
                            className="seating-grid"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, 60px)`,
                            }}
                        >
                            {Array.from({ length: rows * cols }, (_, i) => {
                                const r = Math.floor(i / cols);
                                const c = i % cols;
                                const key = `${r},${c}`;
                                const data = assignmentMap.get(key);
                                const isOccupied = !!data;
                                const hasConflict = data?.hasConflict ?? false;

                                return (
                                    <div
                                        key={i}
                                        className={`seating-cell ${
                                            isOccupied
                                                ? hasConflict
                                                    ? 'conflict'
                                                    : 'occupied'
                                                : 'empty'
                                        }`}
                                        title={
                                            isOccupied
                                                ? `${data.name} at (${r}, ${c})${hasConflict ? ' - CONFLICT!' : ''}`
                                                : `Empty (${r}, ${c})`
                                        }
                                    >
                                        {isOccupied ? data.name : `${r},${c}`}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="export-bar">
                        <span className="export-label">Export:</span>
                        {(['csv', 'png', 'pdf'] as const).map(type => (
                            <button
                                key={type}
                                className={`btn btn-export btn-export-${type}`}
                                onClick={() => handleExport(type)}
                                disabled={exporting !== null}
                            >
                                {exporting === type
                                    ? 'Exporting…'
                                    : type.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <details className="results-details">
                        <summary>
                            Assignment list ({currentAssignments.length} students)
                        </summary>
                        <ul className="assignment-list">
                            {currentAssignments.map((a, i) => (
                                <li
                                    key={i}
                                    className={a.hasConflict ? 'conflict' : ''}
                                >
                                    {a.student.name} → row {a.point.x}, col{' '}
                                    {a.point.y}
                                    {a.hasConflict ? ' ⚠️ conflict' : ''}
                                </li>
                            ))}
                        </ul>
                    </details>

                    {history.length > 0 && (
                        <details className="results-details">
                            <summary>Exam history ({history.length})</summary>
                            <ul className="assignment-list">
                                {history.map(e => (
                                    <li key={e.id}>
                                        <strong>Exam {e.id}:</strong>{' '}
                                        {e.assignments.length} students
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </section>
            )}
        </div>
    );
}

export default App;
