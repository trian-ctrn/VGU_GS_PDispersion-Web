import { useEffect, useState, useCallback } from 'react';
import './App.css';
import init, { Point, solve_p_dispersion } from '../pkg/p_dispersion';

import { Board, cellKey } from './components/Board';
import { ControlPanel } from './components/ControlPanel';
import { useDragSelect } from './hooks/useDragSelect';
import { GRID_CONFIG } from './constants';

const { DEFAULT_ROWS, DEFAULT_COLS } = GRID_CONFIG;

function App() {
    const [ready, setReady] = useState(false);
    const [rows, setRows] = useState(DEFAULT_ROWS);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [placements, setPlacements] = useState(2);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [resultCells, setResultCells] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

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

    /* ── Solver ── */
    const solve = () => {
        setError(null);
        setResultCells(new Set());

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
            indices.forEach((i: number) => result.add(keyList[i]));
            setResultCells(result);
        } catch (e: unknown) {
            setError(
                `Solver error: ${e instanceof Error ? e.message : String(e)}`,
            );
        }
    };

    return (
        <div className="app" onPointerUp={stopDrag} onPointerLeave={stopDrag}>
            <header className="header">
                <h1>P-Dispersion Solver</h1>
                <p className="subtitle">
                    Click &amp; drag to select candidates · adjust settings · hit{' '}
                    <strong>Solve</strong>
                </p>
            </header>

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

            {error && <p className="error">{error}</p>}

            <Board
                rows={rows}
                cols={cols}
                selected={selected}
                resultCells={resultCells}
                onCellDown={onCellDown}
                onCellEnter={onCellEnter}
            />
        </div>
    );
}

export default App;
