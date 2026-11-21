/**
 * Badge & Achievement System for SignTutor
 * All badges are earned locally and stored in IndexedDB/localStorage
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or SVG path
  category: 'milestone' | 'streak' | 'mastery' | 'special' | 'social';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  criteria: (stats: UserStats) => boolean;
}

export interface UserStats {
  // Lesson progress
  lessonsCompleted: number;
  staticMastered: number;    // Letters A-Z mastered (state === 'review' with stability > threshold)
  dynamicMastered: number;   // Dynamic signs mastered
  vocabMastered: number;     // Vocabulary words mastered
  totalMastered: number;
  
  // Streaks
  currentStreak: number;     // Consecutive days with practice
  longestStreak: number;
  lastPracticeDate: string | null; // ISO date string
  
  // Session stats
  totalSessions: number;
  perfectSessions: number;   // Sessions with 100% accuracy
  sessionsAfter10pm: number;
  sessionsBefore6am: number;
  
  // Accuracy
  overallAccuracy: number;
  bestAccuracy: number;
  
  // Time
  totalPracticeTimeMs: number;
  averageSessionTimeMs: number;
  
  // SRS
  dueCount: number;
  overdueCount: number;
  avgStability: number;
  avgDifficulty: number;
}

export interface EarnedBadge extends Badge {
  earnedAt: string; // ISO date string
  progress?: number; // 0-1 for progress badges
}

export interface BadgeProgress {
  badgeId: string;
  progress: number; // 0-1
  currentValue: number;
  targetValue: number;
}

// Badge definitions
export const BADGES: Badge[] = [
  // === MILESTONE BADGES ===
  {
    id: 'first-lesson',
    name: 'First Steps',
    description: 'Complete your first lesson',
    icon: '👶',
    category: 'milestone',
    tier: 'bronze',
    criteria: (stats) => stats.lessonsCompleted >= 1,
  },
  {
    id: 'ten-lessons',
    name: 'Getting Started',
    description: 'Complete 10 lessons',
    icon: '🌱',
    category: 'milestone',
    tier: 'bronze',
    criteria: (stats) => stats.lessonsCompleted >= 10,
  },
  {
    id: 'fifty-lessons',
    name: 'Dedicated Learner',
    description: 'Complete 50 lessons',
    icon: '📚',
    category: 'milestone',
    tier: 'silver',
    criteria: (stats) => stats.lessonsCompleted >= 50,
  },
  {
    id: 'hundred-lessons',
    name: 'Centurion',
    description: 'Complete 100 lessons',
    icon: '💯',
    category: 'milestone',
    tier: 'gold',
    criteria: (stats) => stats.lessonsCompleted >= 100,
  },

  // === STREAK BADGES ===
  {
    id: 'three-day-streak',
    name: 'Three-Peat',
    description: 'Practice 3 days in a row',
    icon: '🔥',
    category: 'streak',
    tier: 'bronze',
    criteria: (stats) => stats.currentStreak >= 3,
  },
  {
    id: 'week-streak',
    name: 'Week Warrior',
    description: 'Practice 7 days in a row',
    icon: '🗓️',
    category: 'streak',
    tier: 'silver',
    criteria: (stats) => stats.currentStreak >= 7,
  },
  {
    id: 'two-week-streak',
    name: 'Fortnight Fighter',
    description: 'Practice 14 days in a row',
    icon: '📅',
    category: 'streak',
    tier: 'gold',
    criteria: (stats) => stats.currentStreak >= 14,
  },
  {
    id: 'month-streak',
    name: 'Monthly Master',
    description: 'Practice 30 days in a row',
    icon: '🏆',
    category: 'streak',
    tier: 'platinum',
    criteria: (stats) => stats.currentStreak >= 30,
  },
  {
    id: 'hundred-day-streak',
    name: 'Century Club',
    description: 'Practice 100 days in a row',
    icon: '💎',
    category: 'streak',
    tier: 'platinum',
    criteria: (stats) => stats.currentStreak >= 100,
  },

  // === MASTERY BADGES (Alphabet) ===
  {
    id: 'alphabet-5',
    name: 'First Five',
    description: 'Master 5 letters of the alphabet',
    icon: '✋',
    category: 'mastery',
    tier: 'bronze',
    criteria: (stats) => stats.staticMastered >= 5,
  },
  {
    id: 'alphabet-13',
    name: 'Halfway There',
    description: 'Master half the alphabet (13 letters)',
    icon: '🤝',
    category: 'mastery',
    tier: 'silver',
    criteria: (stats) => stats.staticMastered >= 13,
  },
  {
    id: 'alphabet-master',
    name: 'Alphabet Master',
    description: 'Master all 24 letters of the ASL alphabet',
    icon: '🎓',
    category: 'mastery',
    tier: 'gold',
    criteria: (stats) => stats.staticMastered >= 24,
  },

  // === MASTERY BADGES (Dynamic Signs) ===
  {
    id: 'dynamic-3',
    name: 'Dynamic Duo',
    description: 'Master 3 dynamic signs',
    icon: '👋',
    category: 'mastery',
    tier: 'bronze',
    criteria: (stats) => stats.dynamicMastered >= 3,
  },
  {
    id: 'dynamic-8',
    name: 'Dynamic Pro',
    description: 'Master all 8 dynamic signs',
    icon: '🎭',
    category: 'mastery',
    tier: 'gold',
    criteria: (stats) => stats.dynamicMastered >= 8,
  },

  // === MASTERY BADGES (Vocabulary) ===
  {
    id: 'vocab-10',
    name: 'Vocab Starter',
    description: 'Master 10 vocabulary words',
    icon: '📖',
    category: 'mastery',
    tier: 'bronze',
    criteria: (stats) => stats.vocabMastered >= 10,
  },
  {
    id: 'vocab-25',
    name: 'Word Collector',
    description: 'Master 25 vocabulary words',
    icon: '📝',
    category: 'mastery',
    tier: 'silver',
    criteria: (stats) => stats.vocabMastered >= 25,
  },
  {
    id: 'vocab-50',
    name: 'Polyglot',
    description: 'Master 50 vocabulary words',
    icon: '🗣️',
    category: 'mastery',
    tier: 'gold',
    criteria: (stats) => stats.vocabMastered >= 50,
  },
  {
    id: 'vocab-100',
    name: 'Centurion',
    description: 'Master 100 vocabulary words',
    icon: '💯',
    category: 'mastery',
    tier: 'platinum',
    criteria: (stats) => stats.vocabMastered >= 100,
  },

  // === PERFECT SESSION BADGES ===
  {
    id: 'perfect-session',
    name: 'Flawless',
    description: 'Complete a session with 100% accuracy',
    icon: '✨',
    category: 'special',
    tier: 'silver',
    criteria: (stats) => stats.perfectSessions >= 1,
  },
  {
    id: 'perfect-5',
    name: 'Perfectionist',
    description: 'Complete 5 perfect sessions',
    icon: '💎',
    category: 'special',
    tier: 'gold',
    criteria: (stats) => stats.perfectSessions >= 5,
  },
  {
    id: 'perfect-10',
    name: 'Untouchable',
    description: 'Complete 10 perfect sessions',
    icon: '🏅',
    category: 'special',
    tier: 'platinum',
    criteria: (stats) => stats.perfectSessions >= 10,
  },

  // === TIME-BASED BADGES ===
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Practice 10 sessions after 10 PM',
    icon: '🦉',
    category: 'special',
    tier: 'bronze',
    criteria: (stats) => stats.sessionsAfter10pm >= 10,
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Practice 10 sessions before 6 AM',
    icon: '🐦',
    category: 'special',
    tier: 'bronze',
    criteria: (stats) => stats.sessionsBefore6am >= 10,
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Practice on 10 weekends',
    icon: '🏖️',
    category: 'special',
    tier: 'silver',
    criteria: (stats) => {
      // This would need weekend session tracking
      return false; // Placeholder
    },
  },

  // === ACCURACY BADGES ===
  {
    id: 'accuracy-90',
    name: 'Sharp Shooter',
    description: 'Achieve 90% overall accuracy',
    icon: '🎯',
    category: 'special',
    tier: 'silver',
    criteria: (stats) => stats.overallAccuracy >= 0.9,
  },
  {
    id: 'accuracy-95',
    name: 'Sniper',
    description: 'Achieve 95% overall accuracy',
    icon: '🎯',
    category: 'special',
    tier: 'gold',
    criteria: (stats) => stats.overallAccuracy >= 0.95,
  },
  {
    id: 'accuracy-99',
    name: 'Virtuoso',
    description: 'Achieve 99% overall accuracy',
    icon: '🎯',
    category: 'special',
    tier: 'platinum',
    criteria: (stats) => stats.overallAccuracy >= 0.99,
  },

  // === SPECIAL BADGES ===
  {
    id: 'jz-master',
    name: 'Motion Master',
    description: 'Master both J and Z (motion letters)',
    icon: '🌀',
    category: 'special',
    tier: 'gold',
    criteria: (stats) => {
      // Would check specific letter mastery
      return stats.staticMastered >= 24; // Placeholder
    },
  },
  {
    id: 'all-categories',
    name: 'Polyglot',
    description: 'Master at least 5 words in 5 different categories',
    icon: '🌈',
    category: 'mastery',
    tier: 'platinum',
    criteria: (stats) => stats.vocabMastered >= 25, // Placeholder
  },
];

/** Get all badges sorted by category and tier */
export function getAllBadges(): Badge[] {
  const tierOrder = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
  return [...BADGES].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return tierOrder[a.tier] - tierOrder[b.tier];
  });
}

/** Check which badges are earned */
export function checkBadges(stats: UserStats): EarnedBadge[] {
  return BADGES.filter(badge => badge.criteria(stats))
    .map(badge => ({ ...badge, earnedAt: new Date().toISOString() }));
}

/** Get progress towards unearned badges */
export function getBadgeProgress(stats: UserStats): BadgeProgress[] {
  return BADGES
    .filter(badge => !badge.criteria(stats))
    .map(badge => {
      // Calculate progress based on badge type
      let currentValue = 0;
      let targetValue = 1;
      
      if (badge.id.includes('lesson')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.lessonsCompleted;
        }
      } else if (badge.id.includes('streak')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.currentStreak;
        }
      } else if (badge.id.startsWith('alphabet-')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.staticMastered;
        }
      } else if (badge.id.startsWith('dynamic-')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.dynamicMastered;
        }
      } else if (badge.id.startsWith('vocab-')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.vocabMastered;
        }
      } else if (badge.id.startsWith('perfect-')) {
        const match = badge.id.match(/(\d+)/);
        if (match) {
          targetValue = parseInt(match[1]);
          currentValue = stats.perfectSessions;
        } else {
          targetValue = 1;
          currentValue = stats.perfectSessions > 0 ? 1 : 0;
        }
      } else if (badge.id === 'night-owl') {
        targetValue = 10;
        currentValue = stats.sessionsAfter10pm;
      } else if (badge.id === 'early-bird') {
        targetValue = 10;
        currentValue = stats.sessionsBefore6am;
      } else if (badge.id === 'accuracy-90') {
        targetValue = 0.9;
        currentValue = stats.overallAccuracy;
      } else if (badge.id === 'accuracy-95') {
        targetValue = 0.95;
        currentValue = stats.overallAccuracy;
      } else if (badge.id === 'accuracy-99') {
        targetValue = 0.99;
        currentValue = stats.overallAccuracy;
      }
      
      return {
        badgeId: badge.id,
        progress: Math.min(1, currentValue / targetValue),
        currentValue,
        targetValue,
      };
    })
    .filter(p => p.progress > 0)
    .sort((a, b) => b.progress - a.progress);
}

/** Get badge by ID */
export function getBadge(id: string): Badge | undefined {
  return BADGES.find(b => b.id === id);
}

/** Get badge tier color */
export function getBadgeTierColor(tier: Badge['tier']): string {
  switch (tier) {
    case 'bronze': return '#cd7f32';
    case 'silver': return '#c0c0c0';
    case 'gold': return '#ffd700';
    case 'platinum': return '#e5e4e2';
  }
}

/** Get badge category label */
export function getBadgeCategoryLabel(category: Badge['category']): string {
  switch (category) {
    case 'milestone': return 'Milestones';
    case 'streak': return 'Streaks';
    case 'mastery': return 'Mastery';
    case 'special': return 'Special';
    case 'social': return 'Social';
  }
}