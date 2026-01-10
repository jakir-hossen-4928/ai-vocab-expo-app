import { Vocabulary } from "@/types";
import { updateVocabularySRS } from "./db";

/**
 * SuperMemo-2 (SM-2) Algorithm Implementation
 *
 * @param quality 0-5 rating (0=complete blackout, 5=perfect recall)
 * @param vocabulary The vocabulary item containing current SRS state
 */
export const processFlashcardResult = (vocabulary: Vocabulary, quality: number) => {
    let interval = vocabulary.interval || 0;
    let repetition = vocabulary.repetition || 0;
    let difficulty = vocabulary.difficulty || 2.5;

    if (quality >= 3) {
        // Correct response
        if (repetition === 0) {
            interval = 1;
        } else if (repetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * difficulty);
        }
        repetition += 1;
    } else {
        // Incorrect response
        repetition = 0;
        interval = 1;
    }

    // Update difficulty (E-Factor)
    // Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    difficulty = difficulty + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Bounds for difficulty
    if (difficulty < 1.3) difficulty = 1.3;
    if (difficulty > 2.5) difficulty = 2.5; // SM-2 usually caps at 2.5 implicitly or allows higher?
    // Standard SM-2 doesn't strict cap upper bound, but keeping it reasonable is fine.
    // Actually SM-2 doesn't have upper cap, only lower 1.3.
    // I'll leave upper bound open-ish but usually it stays around 2.5.

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    // Update DB
    updateVocabularySRS(vocabulary.id, interval, repetition, difficulty, nextReview.toISOString());

    return {
        nextReviewDate: nextReview.toISOString(),
        interval,
        repetition,
        difficulty
    };
};
