import { useState } from 'react';
import { PIPELINE_CONFIG } from '../constants';

interface ExamSetupProps {
    onContinue: (examCount: number) => void;
}

export function ExamSetup({ onContinue }: ExamSetupProps) {
    const [count, setCount] = useState(5);

    return (
        <div className="exam-setup">
            <div className="setup-card panel">
                <h2 className="setup-title">How many exams this semester?</h2>
                <p className="setup-desc">
                    Select the number of exams. You'll upload one student roster (CSV) per exam.
                </p>
                <div className="setup-input-row">
                    <label className="field-label" htmlFor="exam-count">Number of Exams</label>
                    <input
                        id="exam-count"
                        className="field-input setup-input"
                        type="number"
                        min={1}
                        max={PIPELINE_CONFIG.MAX_EXAMS}
                        value={count}
                        onChange={e => {
                            const v = Math.max(1, Math.min(PIPELINE_CONFIG.MAX_EXAMS, Number(e.target.value) || 1));
                            setCount(v);
                        }}
                    />
                </div>
                <button
                    className="btn btn-primary setup-btn"
                    onClick={() => onContinue(count)}
                >
                    Continue with {count} exam{count !== 1 ? 's' : ''} →
                </button>
            </div>
        </div>
    );
}
