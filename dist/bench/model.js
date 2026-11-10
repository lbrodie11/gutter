import { wilsonInterval } from "../stats/wilson.js";
export const BENCH_SCHEMA_VERSION = 1;
export const BENCH_SCORING_VERSION = 1;
export const UNGATED_POLICY_LABEL = 'research: not product behavior';
export const SAMPLE_SIZE_FLOOR = 30;
export const DEFAULT_BOOTSTRAP_RESAMPLES = 1000;
export const DEFAULT_BOOTSTRAP_SEED = 20261108;
export function makeProportionMetric(numerator, denominator) {
    if (denominator <= 0) {
        return {
            numerator: 0,
            denominator: 0,
            rate: null,
            interval: null,
        };
    }
    const safeNum = Math.max(0, Math.min(numerator, denominator));
    return {
        numerator: safeNum,
        denominator,
        rate: Number((safeNum / denominator).toFixed(4)),
        interval: wilsonInterval(safeNum, denominator),
    };
}
export const MAX_RECORDED_CHANGED_FILES = 40;
export const OUTCOME_NAMES = ['followUp', 'sameAuthor', 'raSignal'];
