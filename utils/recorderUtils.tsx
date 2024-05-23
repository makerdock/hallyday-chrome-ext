import { RecordingStates } from "./recordingState";
import { fetchUserInfo, refreshTokens } from "./supabase";

export interface MeetingUrl {
  cur_meeting_url: string;
}

export interface RecordingState {
  recording_state: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiryTime: number;
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
  const { accessToken, refreshToken, expiryTime } =
    (await getTokens()) as Tokens;
  if (!accessToken || !refreshToken) {
    return false;
  }
  if (Date.now() > expiryTime) {
    // Token expired, try to refresh

    return await refreshTokens(refreshToken);
  }
  return true;
}

export async function getTokens() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["accessToken", "refreshToken", "expiryTime"],
      ({ accessToken, refreshToken, expiryTime }) => {
        resolve({ accessToken, refreshToken, expiryTime });
      }
    );
  });
}

// Function to store tokens and expiry time
export async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiryTime: number
) {
  await chrome.storage.local.set({
    accessToken,
    refreshToken,
    expiryTime,
  });
}

export async function getUserInfo() {
  const tokensValid = await areTokensSet();
  if (!tokensValid) {
    throw new Error("User is not authenticated");
  }

  const { accessToken } = (await getTokens()) as Tokens;
  return fetchUserInfo(accessToken);
}
