import { NumberField } from './NumberField';
import { GRID_CONFIG } from '../constants';
import type { Algorithm } from '../App';

const { MIN_ROWS, MIN_COLS, MAX_ROWS, MAX_COLS } = GRID_CONFIG;

const ALGORITHM_OPTIONS: { value: Algorithm; label: string }[] = [
    { value: 'exact', label: 'Exact (Optimal)' },
    { value: 'greedy', label: 'Greedy (Fast)' },
    { value: 'random', label: 'Random' },
];

interface ControlPanelProps {
    rows: number;
    cols: number;
    algorithm: Algorithm;
    onRowsChange: (v: number) => void;
    onColsChange: (v: number) => void;
    onAlgorithmChange: (v: Algorithm) => void;
    onSelectAll: () => void;
    onClear: () => void;
}

export function ControlPanel({
    rows,
    cols,
    algorithm,
    onRowsChange,
    onColsChange,
    onAlgorithmChange,
    onSelectAll,
    onClear,
}: ControlPanelProps) {
    return (
        <section className="panel">
            <div className="panel-grid">
                <NumberField
                    label="Rows"
                    value={rows}
                    min={MIN_ROWS}
                    max={MAX_ROWS}
                    onChange={onRowsChange}
                />
                <NumberField
                    label="Columns"
                    value={cols}
                    min={MIN_COLS}
                    max={MAX_COLS}
                    onChange={onColsChange}
                />
                <div className="field">
                    <label className="field-label">Algorithm</label>
                    <select
                        className="field-select"
                        value={algorithm}
                        onChange={e => onAlgorithmChange(e.target.value as Algorithm)}
                    >
                        {ALGORITHM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="panel-row actions">
                <button className="btn btn-secondary" onClick={onSelectAll}>
                    Mark All Available
                </button>
                <button className="btn btn-secondary" onClick={onClear}>
                    Reset Room
                </button>
            </div>
        </section>
    );
}
