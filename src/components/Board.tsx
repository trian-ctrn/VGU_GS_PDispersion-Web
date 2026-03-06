import { GRID_CONFIG } from '../constants';

const { MAX_ROWS, MAX_COLS } = GRID_CONFIG;

const CELL_SIZE = 70;
const GAP = 4;
const BOARD_WIDTH = MAX_COLS * CELL_SIZE + (MAX_COLS - 1) * GAP;
const BOARD_HEIGHT = MAX_ROWS * CELL_SIZE + (MAX_ROWS - 1) * GAP;

export const cellKey = (r: number, c: number) => `${r},${c}`;

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
            style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
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
                                title={`(${r}, ${c})`}
                            />
                        );
                    }),
                )}
            </div>
        </div>
    );
}
