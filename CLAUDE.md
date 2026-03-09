# Exam Seating Allocation System — Claude Instructions

## Overview

You are building an **exam seating allocation system** that uses **p-dispersion** and **graph coloring** to assign students to seats across multiple exams in a semester, ensuring no two students with conflicts (e.g. same class, same subject) sit adjacent to each other. The algorith and UI have been done. However the current pipeline processes exams in unlimited number of turns and does not have dynamic number of students per exam. The user also cannot review the previous exam's seat map while processing the next one, and there is no option to rerun specific exams with conflicts. Read the instructions below to implement the new features and workflow.

---

## Step 1 — Select Number of Exams

At the start of the session, prompt the user to select the number of exams in the semester (e.g. 5 or 6 exams). This determines how many CSV files will be uploaded and how many seat maps need to be generated.

---

## Step 2 — Upload CSV Files

- Ask the user to upload one CSV file per exam.
- The number of CSV files must match the number of exams selected in Step 1.
- **Copy rule:** If two exams share the same number of students (e.g. Exam 1 and Exam 2 have identical rosters), the user may copy the CSV from Exam 1 to Exam 2 instead of uploading a separate file.
- Each CSV should contain student information (student ID, name, class/subject group, etc.) needed for conflict detection.

---

## Step 3 — Sequential Processing with State Persistence

Process the seat maps **one exam at a time**, in order (Exam 1 → Exam 2 → Exam 3 → ...).

### Core Behavior

- **After processing Exam N**, save the **graph coloring state/constraints** from that exam so they can be carried forward as initial conditions for Exam N+1.
- **While processing Exam N+1**, display the completed seat map of Exam N in the UI so the user can review the previous result in parallel.

### Why carry state forward?

Students who were adjacent in Exam 1 should ideally not be adjacent again in Exam 2. The graph coloring constraints accumulate across exams to maximize overall separation across the semester.

---

## Step 3.1 — Memory / Retry Logic

Define a **memory window** (default: 3 turns/attempts) per exam.

- Run the graph coloring algorithm up to the memory limit.
- If **conflicts still exist at the final turn**, do **not stop** — continue running additional turns (Turn 4, Turn 5, etc.) carrying forward the conflicts from the last turn.
- Keep running until either a conflict-free solution is found, or the user manually stops.

---

## Step 3.1.2 — Partial Conflict Resolution & Rerun

After all exams have been processed, evaluate the results:

- **Exams with zero conflicts** → Mark as ✅ Clear. Lock their seat maps.
- **Exams with conflicts** → Mark as ⚠️ Has Conflicts.

### Rerun Button

Provide a **"Rerun from Exam X"** button that lets the user restart distribution from any exam that has conflicts (e.g. "Rerun from Exam 3").

### Rerun Behavior per Exam

When rerunning a conflicted exam:

1. **Run 10–20 independent random trials** of the seat allocation algorithm for that exam.
2. **If any trial produces a conflict-free seat map** → immediately stop, save that map for the exam, and move on to the next exam.
3. **If no trial produces a conflict-free map** → save the trial with the **fewest conflicts** as the best available result for that exam, then proceed to the next exam.
4. Continue this process for all remaining exams in sequence (e.g. Exam 3 → Exam 4 → Exam 5).

---

## UI Requirements

| Element | Description |
|---|---|
| Exam selector | Dropdown or number input for selecting total exam count |
| CSV upload panel | One upload slot per exam; supports copy/clone from a previous exam |
| Seat map display | Visual grid showing student-to-seat assignments |
| Progress indicator | Shows which exam is currently being processed |
| Previous map viewer | Displays the last completed seat map while the next one processes |
| Conflict badge | Shows number of conflicts per exam (0 = ✅, >0 = ⚠️) |
| Rerun button | Appears after full run; lets user restart from any conflicted exam |
| Trial counter | Shows progress during rerun (e.g. "Trial 7 / 20") |

---

## Algorithm Notes

- Use **graph coloring** as the core constraint-satisfaction method.
- Each student is a node; edges represent conflicts (same class, same subject, or previously adjacent in a prior exam).
- The coloring assigns seats (colors) such that no two connected nodes share adjacent seats.
- Carry the **edge set** (conflict graph) forward between exams to encode historical adjacency constraints.
- For rerun trials, vary the random seed or heuristic order to explore different solutions.

---

## Summary Flow

```
Select N exams
  └─> Upload N CSVs (with optional copy)
        └─> Process Exam 1
              └─> Save graph state
                    └─> Display Exam 1 map → Process Exam 2
                          └─> Save graph state
                                └─> ... repeat for all N exams
                                      └─> Review results
                                            └─> [If conflicts] Rerun from Exam X
                                                  └─> 10–20 trials per conflicted exam
                                                        └─> Save best result (0 conflicts or fewest)
```