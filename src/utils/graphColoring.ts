import { Point } from '../../pkg/p_dispersion';

export interface Student {
    id: string;
    name: string;
}

export interface Assignment {
    student: Student;
    point: Point;
    hasConflict?: boolean;
}

export interface ExamRecord {
    id: number;
    assignments: Assignment[];
}

export interface ExamConfig {
    examId: number;
    students: Student[];
    csvFileName: string;
}

export type ExamStatus = 'pending' | 'processing' | 'done' | 'conflict';

export interface ExamResult {
    examId: number;
    assignments: Assignment[];
    conflictCount: number;
    seatMap: Set<string>;
    status: ExamStatus;
}

export interface RerunState {
    running: boolean;
    fromExam: number;
    currentTrial: number;
    totalTrials: number;
}

export type PipelinePhase = 'setup' | 'upload' | 'processing' | 'review';

// 8-way neighbor check
const isNeighbor = (p1: Point, p2: Point): boolean => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
};

// Scan history for forbidden neighbor pairs
export const getForbiddenPairs = (
    history: ExamRecord[],
    retentionLimit: number,
): Set<string> => {
    const forbidden = new Set<string>();
    const validHistory = history.slice(-retentionLimit);

    validHistory.forEach(exam => {
        const assignments = exam.assignments;
        for (let i = 0; i < assignments.length; i++) {
            for (let j = i + 1; j < assignments.length; j++) {
                const a1 = assignments[i];
                const a2 = assignments[j];
                if (isNeighbor(a1.point, a2.point)) {
                    const key = [a1.student.id, a2.student.id].sort().join(':');
                    forbidden.add(key);
                }
            }
        }
    });

    return forbidden;
};

// Pre-compute forbidden pairs as a Map for O(1) lookup per student
const buildForbiddenMap = (
    students: Student[],
    forbiddenPairs: Set<string>,
): Map<number, Set<number>> => {
    const studentIdToIndex = new Map<string, number>();
    students.forEach((s, i) => studentIdToIndex.set(s.id, i));

    const forbiddenMap = new Map<number, Set<number>>();
    students.forEach((_, i) => forbiddenMap.set(i, new Set()));

    for (const pair of forbiddenPairs) {
        const [id1, id2] = pair.split(':');
        const idx1 = studentIdToIndex.get(id1);
        const idx2 = studentIdToIndex.get(id2);
        if (idx1 !== undefined && idx2 !== undefined) {
            forbiddenMap.get(idx1)!.add(idx2);
            forbiddenMap.get(idx2)!.add(idx1);
        }
    }

    return forbiddenMap;
};

// Build seat adjacency graph
const buildSeatGraph = (seats: Point[]): number[][] => {
    const seatGraph: number[][] = seats.map(() => []);
    for (let i = 0; i < seats.length; i++) {
        for (let j = i + 1; j < seats.length; j++) {
            if (isNeighbor(seats[i], seats[j])) {
                seatGraph[i].push(j);
                seatGraph[j].push(i);
            }
        }
    }
    return seatGraph;
};

// DSatur Algorithm (Degree of Saturation)
export const assignStudentsToSeatsDSatur = (
    seats: Point[],
    students: Student[],
    forbiddenPairs: Set<string>,
): Assignment[] => {
    const numSeats = Math.min(seats.length, students.length);
    if (numSeats === 0) return [];

    const seatGraph = buildSeatGraph(seats);
    const forbiddenMap = buildForbiddenMap(students, forbiddenPairs);

    const result: Assignment[] = new Array(numSeats);
    const seatToStudent: (number | null)[] = new Array(numSeats).fill(null);
    const usedStudents = new Set<number>();

    const saturation: number[] = new Array(numSeats).fill(0);
    const adjacentStudents: Set<number>[] = seats.map(() => new Set());
    const uncolored = new Set<number>();
    for (let i = 0; i < numSeats; i++) uncolored.add(i);

    const selectNextSeat = (): number => {
        let bestSeat = -1;
        let bestSaturation = -1;
        let bestDegree = -1;

        for (const seat of uncolored) {
            const sat = saturation[seat];
            const deg = seatGraph[seat].length;
            if (sat > bestSaturation || (sat === bestSaturation && deg > bestDegree)) {
                bestSaturation = sat;
                bestDegree = deg;
                bestSeat = seat;
            }
        }

        return bestSeat;
    };

    const getValidStudents = (seatIndex: number): number[] => {
        const valid: number[] = [];
        for (let studentIdx = 0; studentIdx < students.length; studentIdx++) {
            if (usedStudents.has(studentIdx)) continue;
            let isValid = true;
            const studentForbidden = forbiddenMap.get(studentIdx)!;
            for (const neighborSeat of seatGraph[seatIndex]) {
                const neighborStudent = seatToStudent[neighborSeat];
                if (neighborStudent !== null && studentForbidden.has(neighborStudent)) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) valid.push(studentIdx);
        }
        return valid;
    };

    while (uncolored.size > 0) {
        const seatIndex = selectNextSeat();
        if (seatIndex === -1) break;
        uncolored.delete(seatIndex);

        const validStudents = getValidStudents(seatIndex);

        if (validStudents.length > 0) {
            const studentIdx = validStudents[0];
            seatToStudent[seatIndex] = studentIdx;
            usedStudents.add(studentIdx);
            result[seatIndex] = {
                student: students[studentIdx],
                point: seats[seatIndex],
                hasConflict: false,
            };
            for (const neighborSeat of seatGraph[seatIndex]) {
                if (uncolored.has(neighborSeat)) {
                    if (!adjacentStudents[neighborSeat].has(studentIdx)) {
                        adjacentStudents[neighborSeat].add(studentIdx);
                        saturation[neighborSeat]++;
                    }
                }
            }
        } else {
            let bestStudent = -1;
            let minConflicts = Infinity;
            for (let studentIdx = 0; studentIdx < students.length; studentIdx++) {
                if (usedStudents.has(studentIdx)) continue;
                let conflicts = 0;
                const studentForbidden = forbiddenMap.get(studentIdx)!;
                for (const neighborSeat of seatGraph[seatIndex]) {
                    const neighborStudent = seatToStudent[neighborSeat];
                    if (neighborStudent !== null && studentForbidden.has(neighborStudent)) {
                        conflicts++;
                    }
                }
                if (conflicts < minConflicts) {
                    minConflicts = conflicts;
                    bestStudent = studentIdx;
                }
            }
            if (bestStudent >= 0) {
                seatToStudent[seatIndex] = bestStudent;
                usedStudents.add(bestStudent);
                result[seatIndex] = {
                    student: students[bestStudent],
                    point: seats[seatIndex],
                    hasConflict: minConflicts > 0,
                };
                for (const neighborSeat of seatGraph[seatIndex]) {
                    if (uncolored.has(neighborSeat)) {
                        if (!adjacentStudents[neighborSeat].has(bestStudent)) {
                            adjacentStudents[neighborSeat].add(bestStudent);
                            saturation[neighborSeat]++;
                        }
                    }
                }
            }
        }
    }

    return result.filter(Boolean);
};

// Backtracking with forward checking (falls back to DSatur)
export const assignStudentsToSeats = (
    seats: Point[],
    students: Student[],
    forbiddenPairs: Set<string>,
): Assignment[] => {
    const numSeats = Math.min(seats.length, students.length);
    if (numSeats === 0) return [];

    const seatGraph = buildSeatGraph(seats);
    const forbiddenMap = buildForbiddenMap(students, forbiddenPairs);

    const seatOrder = Array.from({ length: numSeats }, (_, i) => i)
        .sort((a, b) => seatGraph[b].length - seatGraph[a].length);

    const seatPosition = new Array(numSeats);
    seatOrder.forEach((seat, pos) => (seatPosition[seat] = pos));

    const result: (Assignment | null)[] = new Array(numSeats).fill(null);
    const seatToStudent: (number | null)[] = new Array(numSeats).fill(null);
    const usedStudents = new Set<number>();

    const validStudentsForSeat: Set<number>[] = seatOrder.map(() => {
        const set = new Set<number>();
        for (let i = 0; i < students.length; i++) set.add(i);
        return set;
    });

    const canPlace = (seatIndex: number, studentIdx: number): boolean => {
        const studentForbidden = forbiddenMap.get(studentIdx)!;
        for (const neighbor of seatGraph[seatIndex]) {
            const neighborStudent = seatToStudent[neighbor];
            if (neighborStudent !== null && studentForbidden.has(neighborStudent)) {
                return false;
            }
        }
        return true;
    };

    const backtrack = (orderPos: number): boolean => {
        if (orderPos >= numSeats) return true;

        const seatIndex = seatOrder[orderPos];
        const candidates = [...validStudentsForSeat[orderPos]].filter(
            s => !usedStudents.has(s),
        );

        for (const studentIdx of candidates) {
            if (!canPlace(seatIndex, studentIdx)) continue;

            seatToStudent[seatIndex] = studentIdx;
            usedStudents.add(studentIdx);
            result[seatIndex] = {
                student: students[studentIdx],
                point: seats[seatIndex],
                hasConflict: false,
            };

            const removedFromSeats: Map<number, number[]> = new Map();
            let domainWipeout = false;

            for (const neighborSeat of seatGraph[seatIndex]) {
                const neighborPos = seatPosition[neighborSeat];
                if (neighborPos > orderPos) {
                    const removed: number[] = [];
                    const studentForbidden = forbiddenMap.get(studentIdx)!;
                    for (const otherStudent of validStudentsForSeat[neighborPos]) {
                        if (studentForbidden.has(otherStudent)) {
                            removed.push(otherStudent);
                        }
                    }
                    removed.forEach(s => validStudentsForSeat[neighborPos].delete(s));
                    removedFromSeats.set(neighborPos, removed);
                    const remaining = [...validStudentsForSeat[neighborPos]].filter(
                        s => !usedStudents.has(s) && s !== studentIdx,
                    );
                    if (remaining.length === 0 && neighborPos < numSeats) {
                        domainWipeout = true;
                    }
                }
            }

            for (let pos = orderPos + 1; pos < numSeats; pos++) {
                validStudentsForSeat[pos].delete(studentIdx);
            }

            if (!domainWipeout && backtrack(orderPos + 1)) {
                return true;
            }

            // Undo
            seatToStudent[seatIndex] = null;
            usedStudents.delete(studentIdx);
            result[seatIndex] = null;

            for (const [pos, removed] of removedFromSeats) {
                removed.forEach(s => validStudentsForSeat[pos].add(s));
            }
            for (let pos = orderPos + 1; pos < numSeats; pos++) {
                validStudentsForSeat[pos].add(studentIdx);
            }
        }

        return false;
    };

    if (backtrack(0)) {
        return result.filter((r): r is Assignment => r !== null);
    }

    // Fallback to DSatur
    return assignStudentsToSeatsDSatur(seats, students, forbiddenPairs);
};

// Seeded pseudo-random number generator (mulberry32)
const seededRng = (seed: number) => {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Fisher-Yates shuffle using a seeded RNG
const shuffleArray = <T,>(arr: T[], rng: () => number): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Randomized assignment: shuffles student order by seed for varied exploration
export const assignStudentsToSeatsRandomized = (
    seats: Point[],
    students: Student[],
    forbiddenPairs: Set<string>,
    seed: number,
): Assignment[] => {
    const rng = seededRng(seed);
    const shuffled = shuffleArray(students, rng);

    // Build a mapping from shuffled back to original for consistent IDs
    const assignments = assignStudentsToSeats(seats, shuffled, forbiddenPairs);
    return assignments;
};

// Count conflicts in an assignment list
export const countConflicts = (assignments: Assignment[]): number =>
    assignments.filter(a => a.hasConflict).length;
