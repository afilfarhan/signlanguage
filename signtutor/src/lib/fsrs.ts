/**
 * FSRS (Free Spaced Repetition Scheduler) - TypeScript Implementation
 * Based on the FSRS algorithm by Jarrett Ye (https://github.com/open-spaced-repetition/fsrs4anki)
 * Simplified for SignTutor's use case
 */

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface FSRSParameters {
  requestRetention: number;
  maximumInterval: number;
  w: number[]; // 19 parameters
  enableFuzz: boolean;
}

export interface Card {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  lastReview?: Date;
}

export type State = 'new' | 'learning' | 'review' | 'relearning';

export interface SRSItem {
  id: string;           // e.g., "vocab-hello", "static-A"
  type: 'static' | 'dynamic' | 'vocabulary';
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  lastReview?: Date;
}

// Default FSRS parameters (from the reference implementation)
export const DEFAULT_PARAMETERS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 365,
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
    0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61, 0.1, 0.1
  ],
  enableFuzz: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextInterval(stability: number, requestRetention: number): number {
  return stability / requestRetention - stability;
}

export class FSRS {
  private params: FSRSParameters;

  constructor(params: Partial<FSRSParameters> = {}) {
    this.params = { ...DEFAULT_PARAMETERS, ...params };
  }

  /** Create a new card */
  newCard(): Card {
    return {
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
    };
  }

  /** Convert SRSItem to Card for algorithm */
  private toCard(item: SRSItem): Card {
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

  /** Convert Card back to SRSItem */
  private toItem(card: Card, id: string, type: SRSItem['type']): SRSItem {
    return {
      id,
      type,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.lastReview,
    };
  }

  /** Get interval for a given rating */
  getInterval(card: Card, rating: Rating): number {
    const { w } = this.params;
    
    if (rating === 1) { // Again
      if (card.state === 'learning' || card.state === 'relearning') {
        return 1 / 1440; // 1 minute
      }
      return 10 / 1440; // 10 minutes
    }
    
    if (card.state === 'new' || card.state === 'learning') {
      const intervals = [1, 6]; // 1 day, 6 days
      return intervals[rating - 2];
    }
    
    if (card.state === 'review') {
      const interval = nextInterval(card.stability, this.params.requestRetention);
      return Math.round(interval);
    }
    
    if (card.state === 'relearning') {
      const intervals = [1, 3]; // 1 day, 3 days
      return intervals[rating - 2];
    }
    
    return 1;
  }

  /** Review a card and return updated card */
  review(card: Card, rating: Rating, now: Date = new Date()): Card {
    const { w, maximumInterval, enableFuzz } = this.params;
    const newCard = { ...card, lastReview: now };
    
    // Calculate elapsed days since last review
    if (card.lastReview) {
      const diffMs = now.getTime() - card.lastReview.getTime();
      newCard.elapsedDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    } else {
      newCard.elapsedDays = 0;
    }

    if (rating === 1) { // Again - reset
      newCard.lapses += 1;
      newCard.reps = 0;
      newCard.state = card.state === 'review' ? 'relearning' : 'learning';
      newCard.scheduledDays = this.getInterval(newCard, rating);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
      
      // Update difficulty
      newCard.difficulty = clamp(
        newCard.difficulty + w[6] * (1 - Math.exp(-w[7] * (newCard.difficulty - 1))),
        1, 10
      );
      
      // Reset stability for relearning
      if (newCard.state === 'relearning') {
        newCard.stability = w[11] * Math.exp(-w[12] * newCard.difficulty);
      } else {
        newCard.stability = 0;
      }
      return newCard;
    }

    // Successful review (rating 2, 3, 4)
    newCard.reps += 1;
    
    if (newCard.state === 'new' || newCard.state === 'learning') {
      // Learning steps
      if (rating === 2) { // Hard
        newCard.scheduledDays = 1;
        newCard.state = 'learning';
      } else if (rating === 3) { // Good
        newCard.scheduledDays = 6;
        newCard.state = 'review';
      } else { // Easy
        newCard.scheduledDays = 6;
        newCard.state = 'review';
      }
      
      // Initial stability/difficulty
      if (newCard.state === 'review' && newCard.reps === 1) {
        newCard.difficulty = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
        newCard.stability = w[0] * Math.exp(w[1] * (rating - 1));
      }
    } else if (newCard.state === 'review') {
      // Review state - FSRS core algorithm
      const R = Math.exp(-newCard.elapsedDays / newCard.stability);
      
      // Update difficulty
      newCard.difficulty = clamp(
        newCard.difficulty + w[6] * (1 - Math.exp(-w[7] * (newCard.difficulty - 1))) * (4 - rating) / 3,
        1, 10
      );
      
      // Update stability
      const difficultyFactor = Math.exp(w[8] * (10 - newCard.difficulty));
      const stabilityFactor = Math.pow(R, w[9]);
      const ratingFactor = rating === 2 ? w[10] : (rating === 3 ? w[11] : w[12]);
      
      newCard.stability = newCard.stability * difficultyFactor * stabilityFactor * ratingFactor;
      newCard.stability = clamp(newCard.stability, 0.001, maximumInterval);
      
      // Calculate interval
      newCard.scheduledDays = Math.round(nextInterval(newCard.stability, this.params.requestRetention));
      newCard.scheduledDays = clamp(newCard.scheduledDays, 1, maximumInterval);
      
      // Apply fuzz (jitter) to prevent cards from clumping
      if (enableFuzz && newCard.scheduledDays > 1) {
        const fuzzRange = Math.max(1, Math.floor(newCard.scheduledDays * 0.05));
        const fuzz = Math.floor(Math.random() * (2 * fuzzRange + 1)) - fuzzRange;
        newCard.scheduledDays = clamp(newCard.scheduledDays + fuzz, 1, maximumInterval);
      }
    } else if (newCard.state === 'relearning') {
      // Relearning steps
      if (rating === 2) { // Hard
        newCard.scheduledDays = 1;
        newCard.state = 'relearning';
      } else if (rating === 3) { // Good
        newCard.scheduledDays = 3;
        newCard.state = 'review';
      } else { // Easy
        newCard.scheduledDays = 3;
        newCard.state = 'review';
      }
    }

    newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    return newCard;
  }

  /** Review an SRSItem */
  reviewItem(item: SRSItem, rating: Rating): SRSItem {
    const card = this.toCard(item);
    const newCard = this.review(card, rating);
    return this.toItem(newCard, item.id, item.type);
  }

  /** Get cards due for review */
  getDueCards(items: SRSItem[], now: Date = new Date()): SRSItem[] {
    return items.filter(item => item.due <= now);
  }

  /** Get cards due today or overdue */
  getDueCount(items: SRSItem[], now: Date = new Date()): number {
    return this.getDueCards(items, now).length;
  }

  /** Get cards by state */
  getCardsByState(items: SRSItem[], state: State): SRSItem[] {
    return items.filter(item => item.state === state);
  }

  /** Get statistics */
  getStats(items: SRSItem[]): {
    total: number;
    new: number;
    learning: number;
    review: number;
    relearning: number;
    due: number;
    overdue: number;
    avgStability: number;
    avgDifficulty: number;
  } {
    const now = new Date();
    const due = this.getDueCards(items, now);
    const overdue = due.filter(d => d.due < new Date(now.getTime() - 24 * 60 * 60 * 1000));
    
    const states = ['new', 'learning', 'review', 'relearning'] as State[];
    const counts = states.map(s => items.filter(i => i.state === s).length);
    
    const reviewCards = items.filter(i => i.state === 'review' && i.stability > 0);
    const avgStability = reviewCards.length > 0
      ? reviewCards.reduce((sum, c) => sum + c.stability, 0) / reviewCards.length
      : 0;
    const avgDifficulty = items.length > 0
      ? items.reduce((sum, c) => sum + c.difficulty, 0) / items.length
      : 0;

    return {
      total: items.length,
      new: counts[0],
      learning: counts[1],
      review: counts[2],
      relearning: counts[3],
      due: due.length,
      overdue: overdue.length,
      avgStability,
      avgDifficulty,
    };
  }
}

// Singleton instance
export const fsrs = new FSRS();

/** Helper to review an item with rating enum */
export function reviewItem(item: SRSItem, rating: 'again' | 'hard' | 'good' | 'easy'): SRSItem {
  const ratingMap: Record<string, Rating> = {
    again: 1,
    hard: 2,
    good: 3,
    easy: 4,
  };
  return fsrs.reviewItem(item, ratingMap[rating]);
}

/** Initialize a new SRS item */
export function createSRSItem(id: string, type: SRSItem['type']): SRSItem {
  const card = fsrs.newCard();
  return {
    id,
    type,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
}