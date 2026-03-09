import { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';
import init, { Point, solve_exact, solve_greedy, solve_random } from '../pkg/p_dispersion';

export type Algorithm = 'exact' | 'greedy' | 'random';

const SOLVERS: Record<Algorithm, (points: any, placements: number) => Uint32Array> = {
    exact: solve_exact,
    greedy: solve_greedy,
    random: solve_random,
};

import { Board } from './components/Board';
import { cellKey } from './utils/cellKey';
import { ControlPanel } from './components/ControlPanel';
import { NumberField } from './components/NumberField';
import { ExamSetup } from './components/ExamSetup';
import { CsvUploadPanel } from './components/CsvUploadPanel';
import { ExamReview } from './components/ExamReview';
import { SeatMapModal } from './components/SeatMapModal';
import { useDragSelect } from './hooks/useDragSelect';
import { GRID_CONFIG, PIPELINE_CONFIG } from './constants';
import {
    assignStudentsToSeats,
    assignStudentsToSeatsRandomized,
    countConflicts,
    getForbiddenPairs,
    type Student,
    type ExamRecord,
    type Assignment,
    type ExamResult,
    type RerunState,
    type PipelinePhase,
} from './utils/graphColoring';
import { exportCSV, exportPNG, exportPDF } from './utils/exportUtils';

const { DEFAULT_ROWS, DEFAULT_COLS } = GRID_CONFIG;

/* ── Yield to the browser between heavy computations ── */
const yieldFrame = () => new Promise<void>(r => setTimeout(r, 0));

function App() {
    const [ready, setReady] = useState(false);
    const [rows, setRows] = useState<number>(DEFAULT_ROWS);
    const [cols, setCols] = useState<number>(DEFAULT_COLS);
    const [placements, setPlacements] = useState(2);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [resultCells, setResultCells] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [algorithm, setAlgorithm] = useState<Algorithm>('exact');
    const [historyLimit, setHistoryLimit] = useState<number>(PIPELINE_CONFIG.DEFAULT_MEMORY_WINDOW);

    /* ── Pipeline state ── */
    const [phase, setPhase] = useState<PipelinePhase>('setup');
    const [examCount, setExamCount] = useState(5);
    const [examCsvs, setExamCsvs] = useState<(Student[] | null)[]>([]);
    const [csvFileNames, setCsvFileNames] = useState<string[]>([]);
    const [examResults, setExamResults] = useState<ExamResult[]>([]);
    const [currentExamIndex, setCurrentExamIndex] = useState(0);
    const [processingAttempt, setProcessingAttempt] = useState(0);
    const [rerunState, setRerunState] = useState<RerunState | null>(null);
    const [modalExamId, setModalExamId] = useState<number | null>(null);
    const stopRef = useRef(false);

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
            setError(null);
        },
        [],
    );

    const { onCellDown, onCellEnter, stopDrag } = useDragSelect(paintCell);

    /* ── Board helpers ── */
    const resetBoard = useCallback(() => {
        setSelected(new Set());
        setResultCells(new Set());
        setError(null);
    }, []);

    const selectAll = useCallback(() => {
        const all = new Set<string>();
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) all.add(cellKey(r, c));
        setSelected(all);
        setResultCells(new Set());
        setError(null);
    }, [rows, cols]);

    const handleRowsChange = (v: number) => { setRows(v); resetBoard(); };
    const handleColsChange = (v: number) => { setCols(v); resetBoard(); };

    /* ── Build seats array from selection ── */
    const buildSeatsAndKeys = () => {
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
        return { points, keyList };
    };

    /* ── Run p-dispersion → graph coloring for one exam ── */
    const solveExam = (
        students: Student[],
        history: ExamRecord[],
        seed?: number,
    ): { assignments: Assignment[]; seatKeys: Set<string> } | null => {
        const { points, keyList } = buildSeatsAndKeys();
        if (points.length === 0) return null;

        const numPlacements = Math.min(students.length, points.length);
        try {
            const solver = SOLVERS[algorithm];
            const indices = solver(points, numPlacements);
            const seatKeys = new Set<string>();
            const optimalSeats: InstanceType<typeof Point>[] = [];
            indices.forEach((i: number) => {
                seatKeys.add(keyList[i]);
                optimalSeats.push(points[i]);
            });

            const studentsToAssign = students.slice(0, numPlacements);
            const forbiddenPairs = getForbiddenPairs(history, historyLimit);
            const assignments = seed !== undefined
                ? assignStudentsToSeatsRandomized(optimalSeats, studentsToAssign, forbiddenPairs, seed)
                : assignStudentsToSeats(optimalSeats, studentsToAssign, forbiddenPairs);

            return { assignments, seatKeys };
        } catch {
            return null;
        }
    };

    /* ═══════════════════════════════════════
       Phase transitions
       ═══════════════════════════════════════ */

    /* Step 1 → Step 2 */
    const handleExamCountSelected = (count: number) => {
        setExamCount(count);
        setExamCsvs(new Array(count).fill(null));
        setCsvFileNames(new Array(count).fill(''));
        setPhase('upload');
    };

    /* CSV upload handlers */
    const handleCsvLoaded = (examIndex: number, students: Student[], fileName: string) => {
        setExamCsvs(prev => {
            const next = [...prev];
            next[examIndex] = students;
            return next;
        });
        setCsvFileNames(prev => {
            const next = [...prev];
            next[examIndex] = fileName;
            return next;
        });
    };

    const handleCopyFrom = (targetIndex: number, sourceIndex: number) => {
        setExamCsvs(prev => {
            const next = [...prev];
            next[targetIndex] = prev[sourceIndex];
            return next;
        });
        setCsvFileNames(prev => {
            const next = [...prev];
            next[targetIndex] = `(copied from Exam ${sourceIndex + 1})`;
            return next;
        });
    };

    /* Step 2 → Step 3: Sequential processing */
    const handleStartProcessing = async () => {
        if (selected.size === 0) {
            setError('Select available seats on the floor plan first.');
            return;
        }

        setPhase('processing');
        stopRef.current = false;
        const accHistory: ExamRecord[] = [];
        const results: ExamResult[] = [];

        for (let i = 0; i < examCount; i++) {
            if (stopRef.current) break;
            setCurrentExamIndex(i);
            setProcessingAttempt(0);

            const students = examCsvs[i]!;
            let bestAssignments: Assignment[] | null = null;
            let bestConflicts = Infinity;
            let bestSeatKeys = new Set<string>();

            // Memory window: try up to DEFAULT_MEMORY_WINDOW attempts, then continue if conflicts
            const memoryWindow = PIPELINE_CONFIG.DEFAULT_MEMORY_WINDOW;
            let attempt = 0;

            while (attempt < PIPELINE_CONFIG.MAX_ATTEMPTS_PER_EXAM) {
                if (stopRef.current) break;
                attempt++;
                setProcessingAttempt(attempt);
                await yieldFrame();

                const seed = attempt === 1 ? undefined : attempt * 7919 + i * 1013;
                const result = solveExam(students, accHistory, seed);
                if (!result) {
                    setError(`Failed to solve Exam ${i + 1}. Check room & seat configuration.`);
                    break;
                }

                const conflicts = countConflicts(result.assignments);
                if (conflicts < bestConflicts) {
                    bestConflicts = conflicts;
                    bestAssignments = result.assignments;
                    bestSeatKeys = result.seatKeys;
                }

                if (conflicts === 0) break;
                if (attempt >= memoryWindow && conflicts > 0) {
                    // Continue beyond memory window but keep trying
                    continue;
                }
            }

            if (bestAssignments) {
                const examId = i + 1;
                accHistory.push({ id: examId, assignments: bestAssignments });
                setResultCells(bestSeatKeys);

                const examResult: ExamResult = {
                    examId,
                    assignments: bestAssignments,
                    conflictCount: bestConflicts,
                    seatMap: bestSeatKeys,
                    status: bestConflicts === 0 ? 'done' : 'conflict',
                };
                results.push(examResult);
                setExamResults([...results]);
            }
        }

        setExamResults(results);
        setPhase('review');
    };

    /* ── Rerun from a specific exam ── */
    const handleRerunFrom = async (fromIndex: number) => {
        stopRef.current = false;
        const totalTrials = PIPELINE_CONFIG.RERUN_TRIALS;

        setRerunState({
            running: true,
            fromExam: fromIndex + 1,
            currentTrial: 0,
            totalTrials,
        });

        // Rebuild history from exams before fromIndex
        const accHistory: ExamRecord[] = [];
        for (let i = 0; i < fromIndex; i++) {
            const prev = examResults[i];
            if (prev) {
                accHistory.push({ id: prev.examId, assignments: prev.assignments });
            }
        }

        const updatedResults = [...examResults];

        for (let i = fromIndex; i < examCount; i++) {
            if (stopRef.current) break;
            const students = examCsvs[i]!;
            const examId = i + 1;

            let bestAssignments: Assignment[] | null = null;
            let bestConflicts = Infinity;
            let bestSeatKeys = new Set<string>();

            for (let trial = 1; trial <= totalTrials; trial++) {
                if (stopRef.current) break;

                setRerunState(prev => prev ? {
                    ...prev,
                    fromExam: examId,
                    currentTrial: trial,
                } : null);
                await yieldFrame();

                const seed = trial * 104729 + i * 7919 + Date.now() % 10000;
                const result = solveExam(students, accHistory, seed);
                if (!result) continue;

                const conflicts = countConflicts(result.assignments);
                if (conflicts < bestConflicts) {
                    bestConflicts = conflicts;
                    bestAssignments = result.assignments;
                    bestSeatKeys = result.seatKeys;
                }

                if (conflicts === 0) break;
            }

            if (bestAssignments) {
                accHistory.push({ id: examId, assignments: bestAssignments });
                updatedResults[i] = {
                    examId,
                    assignments: bestAssignments,
                    conflictCount: bestConflicts,
                    seatMap: bestSeatKeys,
                    status: bestConflicts === 0 ? 'done' : 'conflict',
                };
                setExamResults([...updatedResults]);
            }
        }

        setRerunState(null);
    };

    /* ── Export for a specific exam ── */
    const handleExportExam = async (examIndex: number, type: 'csv' | 'png' | 'pdf') => {
        const result = examResults[examIndex];
        if (!result) return;

        if (type === 'csv') {
            exportCSV(result.assignments, result.examId);
        } else {
            // Open modal to render the map, then export
            setModalExamId(result.examId);
            await yieldFrame();
            if (type === 'png') await exportPNG('seating-result', result.examId);
            else await exportPDF('seating-result', result.examId);
        }
    };

    /* ── Back to setup ── */
    const handleBackToSetup = () => {
        setPhase('setup');
        setExamResults([]);
        setExamCsvs([]);
        setCsvFileNames([]);
        setResultCells(new Set());
        setError(null);
        stopRef.current = true;
        setRerunState(null);
    };

    /* ── Modal data ── */
    const modalResult = modalExamId
        ? examResults.find(r => r.examId === modalExamId)
        : null;

    /* ── Current exam assignments for seating map display during processing ── */
    const currentResult = phase === 'processing' && examResults[currentExamIndex]
        ? examResults[currentExamIndex]
        : null;

    const assignmentMap = new Map<string, { id: string; name: string; hasConflict: boolean }>();
    if (currentResult) {
        currentResult.assignments.forEach(a => {
            assignmentMap.set(`${a.point.x},${a.point.y}`, {
                id: a.student.id,
                name: a.student.name,
                hasConflict: a.hasConflict ?? false,
            });
        });
    }

    /* ── Previous exam result (for modal during processing) ── */
    const previousResult = phase === 'processing' && currentExamIndex > 0
        ? examResults[currentExamIndex - 1]
        : null;

    return (
        <div className="app" onPointerUp={stopDrag} onPointerLeave={stopDrag}>
            <header className="header">
                <h1>🎓 Exam Seating Allocator</h1>
                <p className="subtitle">
                    Optimally space students apart using P-Dispersion &amp; Graph Coloring
                </p>
            </header>

            {/* ═══════ PHASE: SETUP ═══════ */}
            {phase === 'setup' && (
                <ExamSetup onContinue={handleExamCountSelected} />
            )}

            {/* ═══════ PHASE: UPLOAD ═══════ */}
            {phase === 'upload' && (
                <div className="layout-grid">
                    <aside className="col-left">
                        <div className="step-group">
                            <h2 className="step-heading">
                                <span className="step-num">1</span> Room Setup
                                <span className="help-tip">?
                                    <span className="tip-text">Set the room size, then click &amp; drag on the floor plan to mark which seats are available.</span>
                                </span>
                            </h2>
                            <ControlPanel
                                rows={rows}
                                cols={cols}
                                placements={placements}
                                algorithm={algorithm}
                                onRowsChange={handleRowsChange}
                                onColsChange={handleColsChange}
                                onPlacementsChange={setPlacements}
                                onAlgorithmChange={setAlgorithm}
                                onSelectAll={selectAll}
                                onClear={resetBoard}
                            />
                        </div>

                        <div className="step-group">
                            <h2 className="step-heading">
                                <span className="step-num">2</span> Upload Rosters
                            </h2>
                            <section className="panel compact-panel">
                                <div className="panel-row">
                                    <NumberField
                                        label="Conflict Memory"
                                        value={historyLimit}
                                        min={0}
                                        max={10}
                                        onChange={setHistoryLimit}
                                    />
                                    <span className="help-tip">?
                                        <span className="tip-text">How many past exams to remember. Students who sat next to each other within this window are kept apart.</span>
                                    </span>
                                </div>
                            </section>
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                <p className="alert-msg">{error}</p>
                            </div>
                        )}
                    </aside>

                    <div className="col-right">
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
                            <div className="legend">
                                <span className="legend-item">
                                    <span className="legend-swatch swatch-empty" /> Unavailable
                                </span>
                                <span className="legend-item">
                                    <span className="legend-swatch swatch-selected" /> Available
                                </span>
                            </div>
                        </div>

                        <CsvUploadPanel
                            examCount={examCount}
                            examCsvs={examCsvs}
                            csvFileNames={csvFileNames}
                            onCsvLoaded={handleCsvLoaded}
                            onCopyFrom={handleCopyFrom}
                            onStartProcessing={handleStartProcessing}
                        />
                    </div>
                </div>
            )}

            {/* ═══════ PHASE: PROCESSING ═══════ */}
            {phase === 'processing' && (
                <div className="processing-view">
                    <div className="progress-indicator panel">
                        <h2 className="progress-title">
                            Processing Exam {currentExamIndex + 1} / {examCount}
                        </h2>
                        <p className="progress-detail">
                            Attempt {processingAttempt} / {PIPELINE_CONFIG.MAX_ATTEMPTS_PER_EXAM}
                            {processingAttempt <= PIPELINE_CONFIG.DEFAULT_MEMORY_WINDOW && (
                                <> (memory window: {PIPELINE_CONFIG.DEFAULT_MEMORY_WINDOW})</>
                            )}
                        </p>
                        <div className="progress-bar-track">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${((currentExamIndex + 1) / examCount) * 100}%` }}
                            />
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { stopRef.current = true; }}
                            style={{ marginTop: '0.5rem' }}
                        >
                            ⏹ Stop Processing
                        </button>
                    </div>

                    {/* Completed exams summary */}
                    {examResults.length > 0 && (
                        <div className="completed-exams">
                            {examResults.map(r => (
                                <span
                                    key={r.examId}
                                    className={`mini-badge ${r.conflictCount === 0 ? 'badge-clear' : 'badge-conflict'}`}
                                    onClick={() => setModalExamId(r.examId)}
                                    title={`Click to view Exam ${r.examId} seat map`}
                                >
                                    Exam {r.examId}: {r.conflictCount === 0 ? '✅' : `⚠️ ${r.conflictCount}`}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Show previous exam map button */}
                    {previousResult && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setModalExamId(previousResult.examId)}
                            style={{ marginTop: '0.5rem' }}
                        >
                            🗺 View Previous Exam (#{previousResult.examId}) Map
                        </button>
                    )}

                    {/* Current processing seating map */}
                    {currentResult && (
                        <div className="grid-section" style={{ marginTop: '1rem' }}>
                            <h3 className="grid-title">
                                Current: Exam #{currentResult.examId}
                                {currentResult.conflictCount > 0 && (
                                    <span className="conflict-badge badge-conflict" style={{ marginLeft: '0.5rem' }}>
                                        ⚠️ {currentResult.conflictCount} conflict{currentResult.conflictCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </h3>
                            <div className="seating-grid-wrapper">
                                <div
                                    className="seating-grid"
                                    style={{ gridTemplateColumns: `repeat(${cols}, 44px)` }}
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
                                                className={`seating-cell ${isOccupied ? (hasConflict ? 'conflict' : 'occupied') : 'empty'}`}
                                                title={
                                                    isOccupied
                                                        ? `${data.name} — Row ${r + 1}, Seat ${c + 1}${hasConflict ? ' ⚠ CONFLICT' : ''}`
                                                        : `Empty — Row ${r + 1}, Seat ${c + 1}`
                                                }
                                            >
                                                {isOccupied ? data.id : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="legend">
                                <span className="legend-item"><span className="legend-swatch swatch-empty-seat" /> Empty</span>
                                <span className="legend-item"><span className="legend-swatch swatch-occupied" /> Seated</span>
                                <span className="legend-item"><span className="legend-swatch swatch-conflict" /> Conflict</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ PHASE: REVIEW ═══════ */}
            {phase === 'review' && (
                <ExamReview
                    examResults={examResults}
                    rerunState={rerunState}
                    onViewMap={examId => setModalExamId(examId)}
                    onRerunFrom={handleRerunFrom}
                    onExportExam={handleExportExam}
                    onBackToSetup={handleBackToSetup}
                />
            )}

            {/* ═══════ MODAL ═══════ */}
            {modalResult && (
                <SeatMapModal
                    examId={modalResult.examId}
                    assignments={modalResult.assignments}
                    rows={rows}
                    cols={cols}
                    onClose={() => setModalExamId(null)}
                />
            )}
        </div>
    );
}

export default App;
