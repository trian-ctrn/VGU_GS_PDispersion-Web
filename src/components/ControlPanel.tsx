import { NumberField } from './NumberField';
import { GRID_CONFIG } from '../constants';

const { MIN_ROWS, MIN_COLS, MAX_ROWS, MAX_COLS } = GRID_CONFIG;

interface ControlPanelProps {
    rows: number;
    cols: number;
    placements: number;
    ready: boolean;
    onRowsChange: (v: number) => void;
    onColsChange: (v: number) => void;
    onPlacementsChange: (v: number) => void;
    onSelectAll: () => void;
    onClear: () => void;
    onSolve: () => void;
}

export function ControlPanel({
    rows,
    cols,
    placements,
    ready,
    onRowsChange,
    onColsChange,
    onPlacementsChange,
    onSelectAll,
    onClear,
    onSolve,
}: ControlPanelProps) {
    return (
        <section className="panel">
            <div className="panel-row">
                <NumberField
                    label="Room Rows"
                    value={rows}
                    min={MIN_ROWS}
                    max={MAX_ROWS}
                    onChange={onRowsChange}
                />
                <NumberField
                    label="Room Columns"
                    value={cols}
                    min={MIN_COLS}
                    max={MAX_COLS}
                    onChange={onColsChange}
                />
                <NumberField
                    label="Seats to Use"
                    value={placements}
                    min={1}
                    max={999}
                    onChange={onPlacementsChange}
                />
            </div>

            <div className="panel-row actions">
                <button className="btn btn-secondary" onClick={onSelectAll}>
                    Mark All Available
                </button>
                <button className="btn btn-secondary" onClick={onClear}>
                    Reset Room
                </button>
                <button
                    className="btn btn-primary"
                    onClick={onSolve}
                    disabled={!ready}
                >
                    {ready ? '🪑 Assign Seats' : 'Loading…'}
                </button>
            </div>
        </section>
    );
}
