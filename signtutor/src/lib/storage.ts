import { SRSItem, Card, createSRSItem, reviewItem, fsrs, FSRS } from "./fsrs";
import { Badge, EarnedBadge, BadgeProgress, getAllBadges, checkBadges, getBadgeProgress, UserStats } from "./badges";

export interface Prefs {
  language: string;
  handedness: "left" | "right";
  mirror: boolean;
  completedAt?: string;
}

const STORAGE_KEY = "signtutor.prefs";
const PROGRESS_KEY = "signtutor.progress";
const STATS_KEY = "signtutor.stats";
const BADGES_KEY = "signtutor.badges";
const STREAK_KEY = "signtutor.streak";

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

/**
 * SRS Item - extends the FSRS SRSItem with additional metadata
 */
export interface SRSItemExtended extends SRSItem {
  signId: string;
  type: "static" | "dynamic" | "vocabulary";
  label: string;           // Display label (e.g., "A", "HELLO", "GOODBYE")
  category?: string;       // For vocabulary (e.g., "Greetings", "Food")
  attempts: number;
  correct: number;
  bestStreak: number;      // Best consecutive correct in a session
  lastSessionAt?: string;  // ISO date of last session
}

/**
 * Convert SRSItemExtended to FSRS Card for algorithm
 */
function toBaseItem(item: SRSItemExtended): Card {
  return {
    due: item.due,
    stability: item.stability,
    difficulty: item.difficulty,
    elapsedDays: item.elapsedDays,
    scheduledDays: item.scheduledDays,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state,
    lastReview: item.lastReview,
  };
}

/**
 * Convert FSRS Card back to extended (preserving metadata)
 */
function fromBaseItem(base: Card, extended: SRSItemExtended): SRSItemExtended {
  return {
    ...extended,
    due: base.due,
    stability: base.stability,
    difficulty: base.difficulty,
    elapsedDays: base.elapsedDays,
    scheduledDays: base.scheduledDays,
    reps: base.reps,
    lapses: base.lapses,
    state: base.state,
    lastReview: base.lastReview,
  };
}

const DEFAULT_STATS: UserStats = {
  lessonsCompleted: 0,
  staticMastered: 0,
  dynamicMastered: 0,
  vocabMastered: 0,
  totalMastered: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalSessions: 0,
  perfectSessions: 0,
  sessionsAfter10pm: 0,
  sessionsBefore6am: 0,
  overallAccuracy: 0,
  bestAccuracy: 0,
  totalPracticeTimeMs: 0,
  averageSessionTimeMs: 0,
  dueCount: 0,
  overdueCount: 0,
  avgStability: 0,
  avgDifficulty: 0,
};

export function loadStats(): UserStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATS;
}

export function saveStats(stats: UserStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

export function loadBadges(): EarnedBadge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (raw) return JSON.parse(raw) as EarnedBadge[];
  } catch {}
  return [];
}

export function saveBadges(badges: EarnedBadge[]): void {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
  } catch {}
}

/**
 * Load all SRS progress items
 */
export function loadProgress(): Record<string, SRSItemExtended> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, SRSItemExtended>;
      // Convert date strings back to Date objects
      Object.values(parsed).forEach(item => {
        item.due = new Date(item.due);
        if (item.lastReview) item.lastReview = new Date(item.lastReview);
      });
      return parsed;
    }
  } catch {}
  return {};
}

export function saveProgress(progress: Record<string, SRSItemExtended>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

/**
 * Initialize SRS item for a sign if not exists
 */
export function initSRSItem(signId: string, type: "static" | "dynamic" | "vocabulary", label: string, category?: string): SRSItemExtended {
  const base = createSRSItem(signId, type);
  return {
    ...base,
    signId,
    type,
    label,
    category,
    attempts: 0,
    correct: 0,
    bestStreak: 0,
  };
}

/**
 * Get or create SRS item
 */
export function getOrCreateSRSItem(
  progress: Record<string, SRSItemExtended>,
  signId: string,
  type: "static" | "dynamic" | "vocabulary",
  label: string,
  category?: string
): SRSItemExtended {
  if (progress[signId]) return progress[signId];
  return initSRSItem(signId, type, label, category);
}

/**
 * Record an attempt using FSRS algorithm
 * Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
 * For binary correct/incorrect: correct -> Good (3), incorrect -> Again (1)
 */
export function recordAttempt(
  progress: Record<string, SRSItemExtended>,
  signId: string,
  type: "static" | "dynamic" | "vocabulary",
  label: string,
  correct: boolean,
  category?: string,
  rating?: 1 | 2 | 3 | 4
): Record<string, SRSItemExtended> {
  const now = new Date();
  const item = getOrCreateSRSItem(progress, signId, type, label, category);
  
  // Update attempt counters
  item.attempts++;
  if (correct) item.correct++;
  item.lastSessionAt = now.toISOString();
  
  // Determine FSRS rating
  let fsrsRating: 1 | 2 | 3 | 4;
  if (rating) {
    fsrsRating = rating;
  } else if (correct) {
    // Correct: could be Good (3) or Easy (4) based on confidence
    // For now use Good (3) - could be enhanced with confidence scoring
    fsrsRating = 3;
  } else {
    // Incorrect: Again (1)
    fsrsRating = 1;
  }
  
  // Apply FSRS review
  const baseItem = toBaseItem(item);
  const reviewedBase = fsrs.review(baseItem, fsrsRating, now);
  const updatedItem = fromBaseItem(reviewedBase, item);
  
  // Update streak
  if (correct) {
    updatedItem.bestStreak = Math.max(updatedItem.bestStreak, (updatedItem.bestStreak || 0) + 1);
  } else {
    updatedItem.bestStreak = 0;
  }
  
  return { ...progress, [signId]: updatedItem };
}

/**
 * Get review queue using FSRS due dates
 */
export function getReviewQueue(
  progress: Record<string, SRSItemExtended>,
  allSigns: { id: string; type: "static" | "dynamic" | "vocabulary"; label: string; category?: string }[],
  limit = 20
): SRSItemExtended[] {
  const now = new Date();
  
  // Get all items that are due
  const dueItems: SRSItemExtended[] = [];
  const newItems: SRSItemExtended[] = [];
  
  for (const sign of allSigns) {
    const item = progress[sign.id];
    if (!item) {
      // Never tried - add to new items
      newItems.push(initSRSItem(sign.id, sign.type, sign.label, sign.category));
    } else if (item.due <= now) {
      dueItems.push(item);
    }
  }
  
  // Sort due items by due date (most overdue first)
  dueItems.sort((a, b) => a.due.getTime() - b.due.getTime());
  
  // Return due items first, then new items up to limit
  const result = [...dueItems, ...newItems];
  return result.slice(0, limit);
}

/**
 * Get statistics from progress
 */
export function getProgressStats(progress: Record<string, SRSItemExtended>): {
  total: number;
  byType: Record<string, { total: number; mastered: number; learning: number; due: number }>;
  overallAccuracy: number;
  avgStability: number;
} {
  const items = Object.values(progress);
  const now = new Date();
  
  const byType: Record<string, { total: number; mastered: number; learning: number; due: number }> = {
    static: { total: 0, mastered: 0, learning: 0, due: 0 },
    dynamic: { total: 0, mastered: 0, learning: 0, due: 0 },
    vocabulary: { total: 0, mastered: 0, learning: 0, due: 0 },
  };
  
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalStability = 0;
  let stabilityCount = 0;
  
  for (const item of items) {
    const type = item.type;
    byType[type].total++;
    
    if (item.attempts > 0) {
      totalAttempts += item.attempts;
      totalCorrect += item.correct;
    }
    
    if (item.state === "review" && item.stability > 30) { // Mastered threshold
      byType[type].mastered++;
    } else if (item.state === "learning" || item.state === "new") {
      byType[type].learning++;
    }
    
    if (item.due <= now) {
      byType[type].due++;
    }
    
    if (item.stability > 0) {
      totalStability += item.stability;
      stabilityCount++;
    }
  }
  
  return {
    total: items.length,
    byType,
    overallAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
    avgStability: stabilityCount > 0 ? totalStability / stabilityCount : 0,
  };
}

/**
 * Streak management
 */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null; // YYYY-MM-DD
  practiceDates: string[]; // YYYY-MM-DD
}

export function loadStreak(): StreakData {
  if (typeof window === "undefined") {
    return { currentStreak: 0, longestStreak: 0, lastPracticeDate: null, practiceDates: [] };
  }
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch {}
  return { currentStreak: 0, longestStreak: 0, lastPracticeDate: null, practiceDates: [] };
}

export function saveStreak(streak: StreakData): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch {}
}

/**
 * Record a practice session and update streak
 * Returns updated streak data
 */
export function recordPracticeSession(streak: StreakData): StreakData {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Already recorded today?
  if (streak.lastPracticeDate === today) {
    return streak;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let newStreak = streak.currentStreak;
  
  if (streak.lastPracticeDate === yesterdayStr) {
    // Continued streak
    newStreak += 1;
  } else if (streak.lastPracticeDate !== null) {
    // Streak broken
    newStreak = 1;
  } else {
    // First practice
    newStreak = 1;
  }
  
  const newLongest = Math.max(streak.longestStreak, newStreak);
  const newDates = [...streak.practiceDates, today];
  
  // Keep only last 365 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const filteredDates = newDates.filter(d => new Date(d) >= cutoff);
  
  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastPracticeDate: today,
    practiceDates: filteredDates,
  };
}

/**
 * Update user stats after a session
 */
export function updateStatsAfterSession(
  stats: UserStats,
  sessionData: {
    correct: number;
    total: number;
    durationMs: number;
    isPerfect: boolean;
    hour: number;
    masteredCounts: { static: number; dynamic: number; vocabulary: number };
  }
): UserStats {
  const newStats = { ...stats };
  
  newStats.lessonsCompleted += 1;
  newStats.totalSessions += 1;
  newStats.totalPracticeTimeMs += sessionData.durationMs;
  newStats.averageSessionTimeMs = Math.round(newStats.totalPracticeTimeMs / newStats.totalSessions);
  
  if (sessionData.isPerfect) {
    newStats.perfectSessions += 1;
  }
  
  if (sessionData.hour >= 22 || sessionData.hour < 6) {
    newStats.sessionsAfter10pm += 1;
  }
  if (sessionData.hour >= 0 && sessionData.hour < 6) {
    newStats.sessionsBefore6am += 1;
  }
  
  const sessionAccuracy = sessionData.total > 0 ? sessionData.correct / sessionData.total : 0;
  const totalAttempts = (stats.overallAccuracy * (newStats.totalSessions - 1)) + sessionAccuracy;
  newStats.overallAccuracy = totalAttempts / newStats.totalSessions;
  newStats.bestAccuracy = Math.max(newStats.bestAccuracy, sessionAccuracy);
  
  newStats.staticMastered = sessionData.masteredCounts.static;
  newStats.dynamicMastered = sessionData.masteredCounts.dynamic;
  newStats.vocabMastered = sessionData.masteredCounts.vocabulary;
  newStats.totalMastered = newStats.staticMastered + newStats.dynamicMastered + newStats.vocabMastered;
  
  return newStats;
}

/**
 * Check and award new badges
 * Returns array of newly earned badges
 */
export function checkAndAwardBadges(
  currentBadges: EarnedBadge[],
  stats: UserStats
): EarnedBadge[] {
  const earnedBadges = checkBadges(stats);
  const currentIds = new Set(currentBadges.map(b => b.id));
  const newBadges = earnedBadges.filter(b => !currentIds.has(b.id));
  
  if (newBadges.length > 0) {
    const updated = [...currentBadges, ...newBadges];
    saveBadges(updated);
  }
  
  return newBadges;
}

/**
 * Get badge progress for UI
 */
export function getBadgesWithProgress(stats: UserStats): Array<Badge & { earned: boolean; progress?: BadgeProgress }> {
  const earned = loadBadges();
  const earnedIds = new Set(earned.map(b => b.id));
  const progressList = getBadgeProgress(stats);
  const progressMap = new Map(progressList.map(p => [p.badgeId, p]));
  
  return getAllBadges().map(badge => ({
    ...badge,
    earned: earnedIds.has(badge.id),
    progress: progressMap.get(badge.id),
    earnedAt: earned.find(e => e.id === badge.id)?.earnedAt,
  }));
}

/**
 * Export all data for backup
 */
export function exportAllData(): {
  prefs: Prefs;
  progress: Record<string, SRSItemExtended>;
  stats: UserStats;
  badges: EarnedBadge[];
  streak: StreakData;
  exportedAt: string;
} {
  return {
    prefs: loadPrefs(),
    progress: loadProgress(),
    stats: loadStats(),
    badges: loadBadges(),
    streak: loadStreak(),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Import data from backup
 */
export function importAllData(data: {
  prefs?: Prefs;
  progress?: Record<string, SRSItemExtended>;
  stats?: UserStats;
  badges?: EarnedBadge[];
  streak?: StreakData;
}): void {
  if (data.prefs) savePrefs(data.prefs);
  if (data.progress) saveProgress(data.progress);
  if (data.stats) saveStats(data.stats);
  if (data.badges) saveBadges(data.badges);
  if (data.streak) saveStreak(data.streak);
}

/**
 * Clear all data (for testing/reset)
 */
export function clearAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(BADGES_KEY);
  localStorage.removeItem(STREAK_KEY);
}