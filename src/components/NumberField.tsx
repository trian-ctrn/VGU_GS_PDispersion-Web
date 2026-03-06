import { useState, useEffect, useRef } from 'react';

const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

interface NumberFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}

/**
 * Numeric input that keeps a string draft while the user types,
 * so they can freely clear the field before entering a new number.
 * Validation + clamping happen on blur or Enter.
 */
export function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
    const [draft, setDraft] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (document.activeElement !== inputRef.current) {
            setDraft(String(value));
        }
    }, [value]);

    const commit = () => {
        const n = parseInt(draft, 10);
        if (Number.isNaN(n) || draft.trim() === '') {
            setDraft(String(value));
        } else {
            const clamped = clamp(n, min, max);
            onChange(clamped);
            setDraft(String(clamped));
        }
    };

    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                className="field-input"
                value={draft}
                onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            />
        </div>
    );
}
