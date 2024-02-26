export const SpeakerType = {
  REP: "rep",
  CLIENT: "client",
} as const;

export type RecordingState = (typeof SpeakerType)[keyof typeof SpeakerType];
