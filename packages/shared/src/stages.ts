import { z } from 'zod';

export const STAGES = [
  'applied',
  'recruiter_screen',
  'hm_screen',
  'technical_screen',
  'take_home',
  'onsite',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;

export type Stage = (typeof STAGES)[number];

export const StageSchema = z.enum(STAGES);

/** Human-readable labels for display */
export const STAGE_LABELS: Record<Stage, string> = {
  applied: 'Applied',
  recruiter_screen: 'Recruiter Screen',
  hm_screen: 'HM Screen',
  technical_screen: 'Technical Screen',
  take_home: 'Take-Home',
  onsite: 'Onsite',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
};

/** Terminal stages — no action expected */
export const TERMINAL_STAGES: ReadonlySet<Stage> = new Set([
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
]);

export function isTerminalStage(stage: Stage): boolean {
  return TERMINAL_STAGES.has(stage);
}
