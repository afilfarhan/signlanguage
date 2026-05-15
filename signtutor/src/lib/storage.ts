export interface Prefs {
  language: string;
  handedness: "left" | "right";
  mirror: boolean;
  completedAt?: string;
}

const STORAGE_KEY = "signtutor.prefs";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") {
    return { language: "asl", handedness: "right", mirror: true };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Prefs;
  } catch {}
  return { language: "asl", handedness: "right", mirror: true };
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export interface ProgressEntry {
  signId: string;
  type: "static" | "dynamic";
  attempts: number;
  correct: number;
  lastAttempt: number;
  nextReview: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
}

const PROGRESS_KEY = "signtutor.progress";

export function loadProgress(): Record<string, ProgressEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, ProgressEntry>;
  } catch {}
  return {};
}

export function saveProgress(progress: Record<string, ProgressEntry>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

export function recordAttempt(
  progress: Record<string, ProgressEntry>,
  signId: string,
  type: "static" | "dynamic",
  correct: boolean,
): Record<string, ProgressEntry> {
  const now = Date.now();
  const entry = progress[signId] || {
    signId,
    type,
    attempts: 0,
    correct: 0,
    lastAttempt: now,
    nextReview: now,
    stability: 0,
    difficulty: 0.3,
    elapsed_days: 0,
    scheduled_days: 1,
    reps: 0,
    lapses: 0,
    state: "new" as const,
  };

  entry.attempts++;
  entry.lastAttempt = now;

  if (correct) {
    entry.correct++;
    entry.reps++;
    if (entry.state === "new" || entry.state === "learning") {
      entry.state = "learning";
      entry.stability = Math.min(1, entry.stability + 0.2);
    } else if (entry.state === "review") {
      entry.stability = Math.min(10, entry.stability * 2.1);
    } else if (entry.state === "relearning") {
      entry.state = "review";
      entry.stability = Math.min(1, entry.stability + 0.3);
    }
  } else {
    entry.lapses++;
    if (entry.state === "review") {
      entry.state = "relearning";
      entry.stability = Math.max(0.1, entry.stability * 0.5);
    }
  }

  const intervalMs = entry.stability * 24 * 60 * 60 * 1000;
  entry.nextReview = now + Math.max(intervalMs, 60 * 1000);
  entry.scheduled_days = Math.max(1, Math.round(entry.stability));

  return { ...progress, [signId]: entry };
}

export function getReviewQueue(
  progress: Record<string, ProgressEntry>,
  allSigns: string[],
): string[] {
  const now = Date.now();
  const untried = allSigns.filter((s) => !progress[s]);
  const due = allSigns.filter((s) => progress[s] && progress[s].nextReview <= now);
  due.sort((a, b) => (progress[a].nextReview ?? 0) - (progress[b].nextReview ?? 0));
  return [...due, ...untried.slice(0, 5)];
}
