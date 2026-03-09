import { cellKey } from '../utils/cellKey';
import type { Assignment } from '../utils/graphColoring';

interface SeatMapModalProps {
    examId: number;
    assignments: Assignment[];
    rows: number;
    cols: number;
    onClose: () => void;
}

export function SeatMapModal({ examId, assignments, rows, cols, onClose }: SeatMapModalProps) {
    const assignmentMap = new Map<string, { id: string; name: string; hasConflict: boolean }>();
    assignments.forEach(a => {
        assignmentMap.set(cellKey(a.point.x, a.point.y), {
            id: a.student.id,
            name: a.student.name,
            hasConflict: a.hasConflict ?? false,
        });
    });

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Seat Map — Exam #{examId}</h3>
                    <button className="btn btn-secondary btn-sm modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
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
                                        className={`seating-cell ${
                                            isOccupied
                                                ? hasConflict ? 'conflict' : 'occupied'
                                                : 'empty'
                                        }`}
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

                    <div className="legend" style={{ marginTop: '0.75rem' }}>
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

                    <details className="results-details" open style={{ marginTop: '0.75rem' }}>
                        <summary>Seat assignments ({assignments.length})</summary>
                        <ul className="assignment-list">
                            {assignments.map((a, i) => (
                                <li key={i} className={a.hasConflict ? 'conflict' : ''}>
                                    {a.student.name} → Row {a.point.x + 1}, Seat {a.point.y + 1}
                                    {a.hasConflict ? ' ⚠️ conflict' : ''}
                                </li>
                            ))}
                        </ul>
                    </details>
                </div>
            </div>
        </div>
    );
}
