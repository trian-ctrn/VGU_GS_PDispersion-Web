import { useRef, useCallback } from 'react';

type PaintMode = 'select' | 'deselect';

/**
 * Click-and-drag cell painting.
 *
 * - `onCellDown`  → each cell's `onPointerDown`
 * - `onCellEnter` → each cell's `onPointerEnter`
 * - `stopDrag`    → container's `onPointerUp` / `onPointerLeave`
 */
export function useDragSelect(
    onPaint: (r: number, c: number, mode: PaintMode) => void,
) {
    const mode = useRef<PaintMode | null>(null);

    const onCellDown = useCallback(
        (r: number, c: number, isCurrentlySelected: boolean) => {
            mode.current = isCurrentlySelected ? 'deselect' : 'select';
            onPaint(r, c, mode.current);
        },
        [onPaint],
    );

    const onCellEnter = useCallback(
        (r: number, c: number) => {
            if (mode.current) onPaint(r, c, mode.current);
        },
        [onPaint],
    );

    const stopDrag = useCallback(() => {
        mode.current = null;
    }, []);

    return { onCellDown, onCellEnter, stopDrag };
}
