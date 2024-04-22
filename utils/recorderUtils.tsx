import { RecordingStates } from "./recordingState";

export interface MeetingUrl {
  cur_meeting_url: string;
}

export interface RecordingState {
  recording_state: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Message {
  user_request_content?: string;
  speaker_type: "rep" | "client";
  message_text: string;
  ai_insight?: string;
  meeting_id?: number;
}

export async function isSameTab() {
  // check whether cur_meeting_url is equal to the tab which is active
  const tabs = await chrome.tabs.query({ active: true });
  console.log("[isSameTab] tabs: ", tabs.length, tabs);

  const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;
  console.log("[isSameTab] cur_meeting_url: ", cur_meeting_url);

  // if (cur_meeting_url !== )

  return (
    tabs[0].url &&
    cur_meeting_url &&
    new URL(tabs[0].url).pathname === new URL(cur_meeting_url).pathname
  );
}

export async function getMeetingUrl() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["cur_meeting_url"], ({ cur_meeting_url }) => {
      resolve({ cur_meeting_url });
    });
  });
}

export async function getRecordingState() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["recording_state"], ({ recording_state }) => {
      resolve({ recording_state });
    });
  });
}

export async function isRecordingInProgress() {
  const { recording_state } = (await getRecordingState()) as RecordingState;

  console.log("IS RECORDING IN PROGRESS: ", recording_state);

  return RecordingStates.IN_PROGRESS === recording_state;
}

// These tokens are set while authentication.
export async function areTokensSet() {
  const { accessToken, refreshToken } = (await getTokens()) as Tokens;
  return accessToken && refreshToken;
}

export async function getTokens() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["accessToken", "refreshToken"],
      ({ accessToken, refreshToken }) => {
        resolve({ accessToken, refreshToken });
      }
    );
  });
}
