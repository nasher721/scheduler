/**
 * Policy and rollout config for optimization and apply.
 * Edit this file to change policy names, weights, and auto-apply thresholds.
 */

export const POLICY_PROFILES = {
  balanced: {
    coverageCompletion: 0.35,
    fatigueRiskMinimization: 0.2,
    fairnessEquityDistribution: 0.2,
    preferenceSatisfaction: 0.15,
    continuityOfCare: 0.1,
  },
  safety_first: {
    coverageCompletion: 0.45,
    fatigueRiskMinimization: 0.25,
    fairnessEquityDistribution: 0.15,
    preferenceSatisfaction: 0.05,
    continuityOfCare: 0.1,
  },
  fairness_first: {
    coverageCompletion: 0.3,
    fatigueRiskMinimization: 0.15,
    fairnessEquityDistribution: 0.35,
    preferenceSatisfaction: 0.1,
    continuityOfCare: 0.1,
  },
};

export const ROLLOUT_MODES = {
  SHADOW: "shadow",
  HUMAN_REVIEW: "human_review",
  AUTO_APPLY: "auto_apply",
};

/** Min score (0–100) per profile to allow auto-apply. */
export const POLICY_AUTO_APPLY_THRESHOLD = {
  balanced: 88,
  safety_first: 92,
  fairness_first: 90,
};
