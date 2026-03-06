import { useEffect, useState, useCallback } from 'react';
import './App.css';
import init, { Point, solve_p_dispersion } from '../pkg/p_dispersion';

import { Board } from './components/Board';
import { cellKey } from './utils/cellKey';
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
    const [rows, setRows] = useState<number>(DEFAULT_ROWS);
    const [cols, setCols] = useState<number>(DEFAULT_COLS);
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
                if (mode === 'select') next.add(key); else next.delete(key);
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
                <h1>🎓 Exam Seating Allocator</h1>
                <p className="subtitle">
                    Optimally space students apart using P-Dispersion &amp; Graph Coloring
                </p>
            </header>

            <div className="layout-grid">
                {/* ── Left column: step-by-step controls ── */}
                <aside className="col-left">
                    {/* Step 1 — Room */}
                    <div className="step-group">
                        <h2 className="step-heading">
                            <span className="step-num">1</span> Room Setup
                            <span className="help-tip" title="Set the room size, then click &amp; drag on the floor plan to mark which seats are available for this exam.">?</span>
                        </h2>
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
                    </div>

                    {/* Step 2 — Students */}
                    <div className="step-group">
                        <h2 className="step-heading">
                            <span className="step-num">2</span> Students
                        </h2>
                        <CsvImport
                            onStudentsLoaded={setClassRoster}
                            studentCount={classRoster.length}
                        />
                        <section className="panel compact-panel">
                            <div className="panel-row">
                                <NumberField
                                    label="Conflict Memory"
                                    value={historyLimit}
                                    min={0}
                                    max={10}
                                    onChange={setHistoryLimit}
                                />
                                <span className="help-tip" title="How many past exams to remember. Students who sat next to each other within this many exams will be kept apart.">?</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat">
                                    <span className="stat-value">{classRoster.length}</span> students
                                </span>
                                <span className="stat-sep">·</span>
                                <span className="stat">
                                    <span className="stat-value">{history.length}</span> exam{history.length !== 1 ? 's' : ''} run
                                </span>
                            </div>
                        </section>
                    </div>

                    {/* Step 3 — Results */}
                    <div className="step-group">
                        <h2 className="step-heading">
                            <span className="step-num">3</span> Results
                        </h2>

                        {error && (
                            <div className={`alert ${currentAssignments.some(a => a.hasConflict) ? 'alert-warning' : 'alert-error'}`}>
                                <p className="alert-msg">{error}</p>
                                {currentAssignments.some(a => a.hasConflict) && (
                                    <div className="alert-body">
                                        <p className="alert-explain">
                                            Some students were placed next to someone they sat beside in a recent exam.
                                            Try increasing the room size, reducing "Seats to Use", or clearing exam history.
                                        </p>
                                        <button className="btn btn-secondary btn-sm" onClick={solve}>
                                            🔄 Re-assign
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentAssignments.length > 0 ? (
                            <section className="panel results-section">
                                <h3 className="results-title">
                                    Exam #{examCounter - 1} — {currentAssignments.length} student{currentAssignments.length !== 1 ? 's' : ''} seated
                                </h3>

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

                                <details className="results-details" open>
                                    <summary>
                                        Seat assignments ({currentAssignments.length})
                                    </summary>
                                    <ul className="assignment-list">
                                        {currentAssignments.map((a, i) => (
                                            <li
                                                key={i}
                                                className={a.hasConflict ? 'conflict' : ''}
                                            >
                                                {a.student.name} → Row {a.point.x + 1}, Seat{' '}
                                                {a.point.y + 1}
                                                {a.hasConflict ? ' ⚠️ neighbor conflict' : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </details>

                                {history.length > 0 && (
                                    <details className="results-details">
                                        <summary>Past exams ({history.length})</summary>
                                        <ul className="assignment-list">
                                            {history.map(e => (
                                                <li key={e.id}>
                                                    <strong>Exam #{e.id}:</strong>{' '}
                                                    {e.assignments.length} students
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                            </section>
                        ) : (
                            <p className="placeholder-text">
                                Mark available seats on the floor plan, then click
                                <strong> 🪑 Assign Seats</strong> to generate results.
                            </p>
                        )}
                    </div>
                </aside>

                {/* ── Column 2: floor plan ── */}
                <main className="col-center">
                    <div className="grid-section">
                        <h3 className="grid-title">Floor Plan</h3>
                        <p className="grid-hint">Click &amp; drag to mark available seats</p>

                        <Board
                            rows={rows}
                            cols={cols}
                            selected={selected}
                            resultCells={resultCells}
                            onCellDown={onCellDown}
                            onCellEnter={onCellEnter}
                        />

                        {/* Color legend */}
                        <div className="legend">
                            <span className="legend-item">
                                <span className="legend-swatch swatch-empty" /> Unavailable
                            </span>
                            <span className="legend-item">
                                <span className="legend-swatch swatch-selected" /> Available
                            </span>
                            <span className="legend-item">
                                <span className="legend-swatch swatch-result" /> Assigned
                            </span>
                        </div>
                    </div>
                </main>

                {/* ── Column 3: seating map (visible after solving) ── */}
                <div className="col-right">
                    {currentAssignments.length > 0 ? (
                        <div className="grid-section">
                            <h3 className="grid-title">Seating Map — Exam #{examCounter - 1}</h3>

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
                                                        ? `${data.name} — Row ${r + 1}, Seat ${c + 1}${hasConflict ? ' ⚠ NEIGHBOR CONFLICT' : ''}`
                                                        : `Empty — Row ${r + 1}, Seat ${c + 1}`
                                                }
                                            >
                                                {isOccupied ? data.name : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Seating map legend */}
                            <div className="legend">
                                <span className="legend-item">
                                    <span className="legend-swatch swatch-empty-seat" /> Empty
                                </span>
                                <span className="legend-item">
                                    <span className="legend-swatch swatch-occupied" /> Seated
                                </span>
                                <span className="legend-item">
                                    <span className="legend-swatch swatch-conflict" /> Conflict
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="col-placeholder">
                            <p className="placeholder-text">
                                Seating map will appear here after you assign seats.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
