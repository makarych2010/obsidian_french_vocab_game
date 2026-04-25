export interface SRSData {
    id: string; // matches VocabularyItem.id
    repetition: number;
    interval: number;
    easeFactor: number;
    nextReviewDate: number; // timestamp
}

export class SRSEngine {
    // SM-2 Algorithm implementation
    
    // Quality of response:
    // 0: Complete blackout
    // 1: Incorrect response; the correct one remembered
    // 2: Incorrect response; where the correct one seemed easy to recall
    // 3: Correct response recalled with serious difficulty
    // 4: Correct response after a hesitation
    // 5: Perfect response

    public static processReview(item: SRSData | undefined, id: string, quality: number): SRSData {
        let repetition = item ? item.repetition : 0;
        let interval = item ? item.interval : 0;
        let easeFactor = item ? item.easeFactor : 2.5;

        if (quality >= 3) {
            // Correct response
            if (repetition === 0) {
                interval = 1;
            } else if (repetition === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easeFactor);
            }
            repetition += 1;
        } else {
            // Incorrect response
            repetition = 0;
            interval = 1;
        }

        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) {
            easeFactor = 1.3;
        }

        const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;

        return {
            id,
            repetition,
            interval,
            easeFactor,
            nextReviewDate
        };
    }
}