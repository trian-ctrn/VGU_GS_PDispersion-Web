import { cellKey } from '../utils/cellKey';

export const CELL_SIZE = 48;
const GAP = 3;

interface BoardProps {
    rows: number;
    cols: number;
    selected: Set<string>;
    resultCells: Set<string>;
    onCellDown: (r: number, c: number, isSelected: boolean) => void;
    onCellEnter: (r: number, c: number) => void;
}

export function Board({
    rows,
    cols,
    selected,
    resultCells,
    onCellDown,
    onCellEnter,
}: BoardProps) {
    return (
        <div
            className="board-wrapper"
            style={{
                width: cols * CELL_SIZE + (cols - 1) * GAP,
                height: rows * CELL_SIZE + (rows - 1) * GAP,
            }}
        >
            <div
                className="board"
                style={{
                    gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                    gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
                }}
            >
                {Array.from({ length: rows }, (_, r) =>
                    Array.from({ length: cols }, (_, c) => {
                        const key = cellKey(r, c);
                        const isSelected = selected.has(key);
                        const isResult = resultCells.has(key);

                        let cls = 'cell';
                        if (isResult) cls += ' result';
                        else if (isSelected) cls += ' selected';

                        return (
                            <button
                                key={key}
                                className={cls}
                                onPointerDown={e => {
                                    e.preventDefault();
                                    onCellDown(r, c, isSelected);
                                }}
                                onPointerEnter={() => onCellEnter(r, c)}
                                title={`Row ${r + 1}, Seat ${c + 1}`}
                            />
                        );
                    }),
                )}
            </div>
        </div>
    );
}
