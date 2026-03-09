import type { ExamResult, RerunState } from '../utils/graphColoring';

interface ExamReviewProps {
    examResults: ExamResult[];
    rerunState: RerunState | null;
    onViewMap: (examId: number) => void;
    onRerunFrom: (examIndex: number) => void;
    onExportExam: (examIndex: number, type: 'csv' | 'png' | 'pdf') => void;
    onBackToSetup: () => void;
}

export function ExamReview({
    examResults,
    rerunState,
    onViewMap,
    onRerunFrom,
    onExportExam,
    onBackToSetup,
}: ExamReviewProps) {
    const allClear = examResults.every(r => r.conflictCount === 0);

    return (
        <div className="exam-review">
            <h2 className="review-title">
                {allClear ? '✅ All Exams Clear!' : '📋 Exam Results'}
            </h2>

            {rerunState?.running && (
                <div className="trial-counter panel">
                    <p className="trial-text">
                        🔄 Rerunning from Exam {rerunState.fromExam}…
                        Trial <strong>{rerunState.currentTrial}</strong> / {rerunState.totalTrials}
                    </p>
                    <div className="trial-bar">
                        <div
                            className="trial-fill"
                            style={{ width: `${(rerunState.currentTrial / rerunState.totalTrials) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="review-list">
                {examResults.map((result, i) => {
                    const isClear = result.conflictCount === 0;
                    return (
                        <div key={result.examId} className={`review-row ${isClear ? 'clear' : 'has-conflicts'}`}>
                            <div className="review-row-header">
                                <span className="review-exam-label">Exam {result.examId}</span>
                                <span className={`conflict-badge ${isClear ? 'badge-clear' : 'badge-conflict'}`}>
                                    {isClear ? '✅ Clear' : `⚠️ ${result.conflictCount} conflict${result.conflictCount !== 1 ? 's' : ''}`}
                                </span>
                            </div>

                            <p className="review-summary">
                                {result.assignments.length} student{result.assignments.length !== 1 ? 's' : ''} seated
                            </p>

                            <div className="review-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => onViewMap(result.examId)}
                                >
                                    🗺 View Map
                                </button>

                                {!isClear && !rerunState?.running && (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => onRerunFrom(i)}
                                    >
                                        🔄 Rerun from Exam {result.examId}
                                    </button>
                                )}

                                <div className="review-export-group">
                                    {(['csv', 'png', 'pdf'] as const).map(type => (
                                        <button
                                            key={type}
                                            className={`btn btn-export btn-export-${type} btn-sm`}
                                            onClick={() => onExportExam(i, type)}
                                            disabled={rerunState?.running ?? false}
                                        >
                                            {type.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="review-footer">
                <button className="btn btn-secondary" onClick={onBackToSetup}>
                    ← Start Over
                </button>
            </div>
        </div>
    );
}
