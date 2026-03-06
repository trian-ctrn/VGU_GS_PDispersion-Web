import { useState } from 'react';

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
 * Numeric input that keeps a local string draft only while focused,
 * so the user can freely clear the field before entering a new number.
 * When blurred, the displayed value always reflects the parent prop.
 */
export function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const focused = draft !== null;

    const commit = () => {
        if (draft === null) return;
        const n = parseInt(draft, 10);
        if (!Number.isNaN(n) && draft.trim() !== '') {
            onChange(clamp(n, min, max));
        }
        setDraft(null);
    };

    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <input
                type="text"
                inputMode="numeric"
                className="field-input"
                value={focused ? draft : String(value)}
                onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                onFocus={() => setDraft(String(value))}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            />
        </div>
    );
}
