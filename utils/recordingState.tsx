export const RecordingStates = {
  IN_PROGRESS: "in_progress",
  ENDED: "ended",
} as const;

export type RecordingState =
  (typeof RecordingStates)[keyof typeof RecordingStates];
