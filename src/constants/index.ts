export const GRID_CONFIG = {
    DEFAULT_ROWS: 5,
    DEFAULT_COLS: 5,
    MIN_ROWS: 1,
    MIN_COLS: 1,
    MAX_ROWS: 8,
    MAX_COLS: 8,
} as const;

export const PIPELINE_CONFIG = {
    MAX_EXAMS: 10,
    DEFAULT_MEMORY_WINDOW: 3,
    RERUN_TRIALS: 20,
    MAX_ATTEMPTS_PER_EXAM: 50,
} as const;
