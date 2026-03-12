# Exam Seating Allocation System — Instruction File

This file provides persistent guidance for the AI coding assistant to comprehend the system's structure, algorithm concepts, and software development goals.

---

## 1. System Requirements

### 1.1 Purpose

This is an **exam seating allocation system** that assigns students to seats across multiple exams in a semester. The system ensures no two students with conflicts (same class, same subject, or previously adjacent in a prior exam) sit next to each other. It combines **p-dispersion** for optimal seat selection with **graph coloring** for conflict-free student-to-seat assignment.

### 1.2 Application Pipeline

The application follows a **4-phase pipeline**:

1. **Setup** — User selects the total number of exams in the semester (1–10).
2. **Upload** — User uploads one CSV file per exam (with an option to copy a CSV from one exam to another if rosters are identical) and configures the room layout (rows, columns, available seats).
3. **Processing** — The system processes seat maps one exam at a time, in order. After each exam, the graph coloring state (conflict history) is carried forward to the next exam. The user can review the previous exam's seat map while the current one is being processed.
4. **Review** — All results are displayed with conflict badges (✅ Clear or ⚠️ Has Conflicts). The user can rerun conflicted exams or export results.

### 1.3 Memory / Retry Logic

- A configurable **memory window** (default: 3) controls how many past exams are retained for conflict avoidance.
- Per exam, the solver runs up to `MAX_ATTEMPTS_PER_EXAM` (50) iterations. If conflicts remain after the memory window, it continues with randomized seeds.
- Processing stops when a conflict-free solution is found or all attempts are exhausted, keeping the best result.

### 1.4 Rerun Behavior

After all exams are processed, exams with remaining conflicts can be rerun:

- **"Rerun from Exam X"** restarts allocation from the selected exam onward.
- Each rerun runs up to `RERUN_TRIALS` (20) independent random trials per exam.
- If any trial yields zero conflicts, it is accepted immediately; otherwise the trial with the fewest conflicts is kept.

### 1.5 CSV Data Format

Each CSV contains student information with a header row `id,name`:

```
id,name
S001,Nguyen Van An
S002,Tran Thi Bich
...
```

A valid student requires a non-empty `id` and a non-empty `name`. The parser auto-detects headers and handles quoted fields.

---

## 2. Algorithm Concepts

### 2.1 P-Dispersion (Seat Selection)

Given a set of available seats in the room, select N seats (one per student) that are **maximally dispersed** — i.e., maximize the minimum pairwise distance. This is solved via a WebAssembly module exposing three strategies: `solve_exact`, `solve_greedy`, and `solve_random`.

### 2.2 Graph Coloring (Student-to-Seat Assignment)

Once optimal seat positions are chosen, students are assigned to those seats using graph coloring as a constraint-satisfaction method:

- **Nodes**: Students.
- **Edges**: Conflict relationships — two students share an edge if they belong to the same class/subject group or were **8-way adjacent** (including diagonals) in any previous exam within the memory window.
- **Colors**: Seats. The coloring ensures no two connected students are assigned to adjacent seats.

### 2.3 Solver Strategies (in order of preference)

1. **Backtracking with Forward Checking** — Orders seats by degree (most-constrained first), assigns students greedily with backtracking. Uses forward checking to prune future domains and detects domain wipeouts early.
2. **DSatur (Degree of Saturation)** — Greedy fallback. Selects the seat with the highest saturation (most constrained neighbors) at each step. If no valid student exists, picks the one with minimum conflicts (graceful degradation).
3. **Randomized Variant** — Wraps the above with a seeded Mulberry32 PRNG and Fisher-Yates shuffle to explore different solution orderings across trials.

### 2.4 State Accumulation Across Exams

After each exam, the assignment history is appended to an accumulated record. Before solving the next exam, the system scans this history to build a **forbidden pairs set** — pairs of students who sat adjacent in any prior exam. This set grows across the semester to maximize overall separation.

---

## 3. Available Tools & Project Structure

### 3.1 Tech Stack

| Tool | Version / Details |
|---|---|
| React | 19.x (functional components, hooks) |
| TypeScript | 5.x (strict mode) |
| Vite | 7.x (build tool with HMR) |
| WebAssembly | P-dispersion solver compiled to WASM via `vite-plugin-wasm` |
| html2canvas | Screenshot generation for PNG export |
| jsPDF | PDF generation |
| ESLint | 9.x + TypeScript ESLint (strict linting) |

### 3.2 Project Structure

```
├── src/
│   ├── App.tsx                  # Main state manager, pipeline orchestration, solve/rerun logic
│   ├── main.tsx                 # React entry point
│   ├── components/
│   │   ├── Board.tsx            # Drag-select seat grid (room layout)
│   │   ├── ControlPanel.tsx     # Room config (rows, cols, algorithm), board actions
│   │   ├── CsvImport.tsx        # Single CSV uploader with sample download
│   │   ├── CsvUploadPanel.tsx   # Multi-exam upload slots, copy-from dropdown
│   │   ├── ExamReview.tsx       # Results summary: conflict badges, view/rerun/export
│   │   ├── ExamSetup.tsx        # Exam count selector
│   │   ├── NumberField.tsx      # Reusable numeric input with draft state
│   │   └── SeatMapModal.tsx     # Full-screen modal for viewing a seat map
│   ├── constants/
│   │   └── index.ts             # GRID_CONFIG, PIPELINE_CONFIG
│   ├── hooks/
│   │   └── useDragSelect.ts     # Click-and-drag cell painting hook
│   └── utils/
│       ├── cellKey.ts           # "r,c" string key helper for Set/Map lookups
│       ├── csvUtils.ts          # CSV parser (auto-detect headers, handle quoting)
│       ├── exportUtils.ts       # CSV/PNG/PDF export helpers
│       └── graphColoring.ts     # Core algorithm: forbidden pairs, seat graph, solvers
├── demo/                        # Sample CSV files (12 students each)
├── index.html                   # HTML entry point
├── vite.config.ts               # Vite config with WASM plugin
└── package.json                 # Dependencies and scripts
```

### 3.3 Key Data Types

```typescript
interface Student { id: string; name: string }

interface Assignment {
  student: Student;
  point: Point;              // seat coordinates (row, col)
  hasConflict?: boolean;     // true if a constraint was violated
}

interface ExamResult {
  examId: number;
  assignments: Assignment[];
  conflictCount: number;
  seatMap: Set<string>;
  status: 'pending' | 'processing' | 'done' | 'conflict';
}

type PipelinePhase = 'setup' | 'upload' | 'processing' | 'review';
type Algorithm = 'exact' | 'greedy' | 'random';
```

### 3.4 Constants

```typescript
GRID_CONFIG = {
  DEFAULT_ROWS: 5, DEFAULT_COLS: 5,
  MIN_ROWS: 1, MAX_ROWS: 8,
  MIN_COLS: 1, MAX_COLS: 8,
}

PIPELINE_CONFIG = {
  MAX_EXAMS: 10,
  DEFAULT_MEMORY_WINDOW: 3,
  RERUN_TRIALS: 20,
  MAX_ATTEMPTS_PER_EXAM: 50,
}
```

---

## 4. Coding Style

### 4.1 TypeScript

- **Strict mode** is enforced — no `any`, no unused locals or parameters.
- Use **interfaces** for data shapes (`Student`, `Assignment`, `ExamResult`).
- Use **discriminated unions** for enum-like types (`Algorithm`, `PipelinePhase`).
- Prefer **explicit types** over inference at function boundaries.

### 4.2 React

- **Functional components** with hooks (`useState`, `useCallback`, `useRef`, `useEffect`).
- Props are passed as a single destructured object.
- Event handlers use `useCallback` where performance matters; inline arrow functions otherwise.
- All application state lives in `App.tsx` via local `useState` — no external state manager.
- Conditional CSS classes via template literals.

### 4.3 Naming Conventions

- `camelCase` for variables, functions, and props.
- `PascalCase` for components and type/interface names.
- `on*` prefix for event handler props (e.g., `onCellDown`, `onExportExam`).
- `UPPER_SNAKE_CASE` for constants.
- Standard abbreviations: `csv`, `ref`, `rng`, `WASM`.

### 4.4 Code Organization

- **Separation of concerns**: `components/` (UI), `utils/` (algorithms and helpers), `hooks/` (reusable logic), `constants/` (configuration).
- Arrow function declarations preferred (`const func = () => {}`).
- Section headers in utility files use `/* ── Title ── */` comment style.
- Helper functions are defined at module level in utility files.

### 4.5 CSS

- Custom properties and CSS Grid for layouts.
- Dark theme (dark background, light text).
- Responsive breakpoints via `@media (max-width: 780px)`.

---

## 5. Summary Flow

```
Select N exams
  └─> Upload N CSVs (with optional copy) + configure room layout
        └─> Process Exam 1
              └─> Save graph state (forbidden pairs)
                    └─> Display Exam 1 map → Process Exam 2
                          └─> Save graph state
                                └─> ... repeat for all N exams
                                      └─> Review results
                                            └─> [If conflicts] Rerun from Exam X
                                                  └─> 10–20 random trials per exam
                                                        └─> Save best result
```