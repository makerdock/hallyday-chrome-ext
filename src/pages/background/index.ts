import {
  areTokensSet,
  isRecordingInProgress,
  isSameTab,
} from "../../../utils/recorderUtils";
// import { Tokens, getTokens } from "../../../utils/getTokens";
import { RecordingStates } from "../../../utils/recordingState";

// import { createClient } from "@supabase/supabase-js";
// import { createRequire } from "module";
// const require = createRequire(import.meta.url);

// const createClient = require("@supabase/supabase-js").createClient;

/**
 * Path to the offscreen HTML document.
 * @type {string}
 */
const OFFSCREEN_DOCUMENT_PATH = "src/pages/offscreen/index.html";

/**
 * Reason for creating the offscreen document.
 * @type {string}
 */
enum Reason {
  USER_MEDIA = "USER_MEDIA",
  // Add other possible reasons here if needed
}

const OFFSCREEN_REASON: Reason = Reason.USER_MEDIA; // Use the appropriate Reason enum value

const HALLYDAY_WEBAPP = "https://hallyday-dashboard.vercel.app";

// let actionClicked = false;

// let isSidePanelFirstOpen = true;
let isSidePanelVisible = false;

// interface MeetingUrl {
//   cur_meeting_url: string;
// }

// interface RecordingState {
//   recording_state: string;
// }

/**
 * Listener for extension installation.
 */
chrome.runtime.onInstalled.addListener(handleInstall);

chrome.action.onClicked.addListener(async (tab) => {
  // console.log("Action clicked....", actionClicked);

  // 1. is User logged in?
  if (!(await areTokensSet())) return;

  // 2. Is another recording in progress?
  // will handle both tab refresh or starting a new meeting in a diff tab

  // 2.1 in the same tab? to toggle the start/stop (isRecordingInProgressInSameTab())
  // 2.2 in a different tab? (isRecordingInProgressInDifferentTab())
  // if (await isRecordingInProgress()) return;

  // FIRST TIME AFTER INSTALL
  // recording_state = ENDED, cur_meeting_url = '' --> Start recording (and turns into)
  // recording_state = IN_PROGRESS, cur_meeting_url = 'https://..'

  // RECORDING IN PROGRESS (Clicking icon in same tab)
  // recording_state = IN_PROGRESS, cur_meeting_url = 'https://..' --> Stops recording (and turns into)
  // recording_state = ENDED, cur_meeting_url = ''

  // recording_state | cur_meeting_url | status
  // ENDED           | EMPTY           | No recording in progress (new meeting)
  // ENDED           | NOT EMPTY       | ??
  // IN_PROGRESS     | EMPTY           | ??
  // IN_PROGRESS     | NOT EMPTY       | Recording in progress (stop meeting)

  // <== IGNORE FOR NOW ==>
  // RECORDING IN PROGRESS (Clicking icon in diff tab)
  // recording_state = IN_PROGRESS, cur_meeting_url = 'https://..' --> Pause recording

  if (await isRecordingInProgress()) {
    console.log("=== RECORDING IS IN PROGRESS ===");

    if (await isSameTab()) initateRecordingStop();
    // If user is trying to record from an another tab
    else {
      console.log("Recording is in progress in another tab");

      chrome.notifications.create({
        title: "Hallyday AI assistant",
        message: "Recording is in progress in another tab",
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon-34.png"),
      });
      return;
    }
  } else initateRecordingStart();

  // if (!actionClicked) initateRecordingStart();
  // else initateRecordingStop();

  // actionClicked = !actionClicked;
});

// async function isLoggedIn() {
//   const { accessToken, refreshToken } = (await getTokens()) as Tokens;

//   return accessToken && refreshToken;
// }

// async function isSameTab() {
//   // check whether cur_meeting_url is equal to the tab which is active
//   const tabs = await chrome.tabs.query({ active: true });
//   console.log("[isValidTab] tabs: ", tabs[0]);

//   const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;
//   console.log("[isValidTab] cur_meeting_url: ", cur_meeting_url);

//   return (
//     tabs[0].url &&
//     cur_meeting_url &&
//     new URL(tabs[0].url).pathname === new URL(cur_meeting_url).pathname
//   );
// }

// async function isRecordingInProgress() {
//   const { recording_state } = (await getRecordingState()) as RecordingState;
//   // const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

//   return (
//     RecordingStates.IN_PROGRESS === recording_state
//     // cur_meeting_url &&
//     // cur_meeting_url.length > 0 // Not empty
//   );

//   // Incase of clicking icon from a different tab check, need to verify the url as well
//   // instead of just non empty check
// }

// async function getMeetingUrl() {
//   return new Promise((resolve, reject) => {
//     chrome.storage.local.get(["cur_meeting_url"], ({ cur_meeting_url }) => {
//       resolve({ cur_meeting_url });
//     });
//   });
// }

// async function getRecordingState() {
//   return new Promise((resolve, reject) => {
//     chrome.storage.local.get(["recording_state"], ({ recording_state }) => {
//       resolve({ recording_state });
//     });
//   });
// }

/**
 * Listener for messages from the extension.
 * @param {Object} request - The message request.
 * @param {Object} sender - The sender of the message.
 * @param {function} sendResponse - Callback function to send a response.
 */
chrome.runtime.onMessage.addListener((request) => {
  switch (request.message.type) {
    // case "TOGGLE_RECORDING":
    //   switch (request.message.data) {
    //     case "START":
    //       initateRecordingStart();

    //       console.log("STARTING..", request);

    //       break;
    //     case "STOP":
    //       initateRecordingStop();
    //       break;
    //   }
    //   break;
    case "SHOW_SIDEPANEL":
      openSidePanel();
      break;
    case "LOGIN":
      login();
      break;
  }
});

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   switch (request.message.type) {
//     case "FETCH_CUR_URL":
//       console.log("RECEIVED msg - FETCH_CUR_URL, SENDER:", sender);

//       fetchCurUrl().then((data) => {
//         sendResponse(data);
//       });

//       break;
//   }

//   return true;
// });

// async function fetchCurUrl() {
//   const tabs = await chrome.tabs.query({ active: true });
//   console.log("[fetchCurUrl] tabs: ", tabs[0]);

//   return tabs[0].url;
// }

async function login() {
  // Store the current tab id
  const tabs = await chrome.tabs.query({ active: true });
  console.log("[LOGIN - TAB QUERY] tabs: ", tabs[0]);

  await chrome.storage.local.set({
    current_tab: tabs[0].id,
  });

  chrome.tabs.onUpdated.removeListener(setTokens);

  const authUrl =
    "https://fhkdrjttwyipealchxne.supabase.co/auth/v1/authorize?provider=google";

  // create new tab with that url
  chrome.tabs.create({ url: authUrl, active: true }, (tab) => {
    chrome.tabs.onUpdated.addListener(setTokens);
  });
}

const setTokens = async (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => {
  // once the tab is loaded
  if (tab.status === "complete") {
    if (!tab.url) return;

    // console.log("<--TAB LOAD COMPLETE -->", tab.url);

    const url = new URL(tab.url);

    if (url.origin === HALLYDAY_WEBAPP) {
      const params = new URLSearchParams(url.href.split("#")[1]);

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        if (!tab.id) return;

        // console.log("--> tokens: ", accessToken, refreshToken);

        // we can close that tab now
        await chrome.tabs.remove(tab.id);

        // Reopen google meet tab
        chrome.storage.local.get(["current_tab"], ({ current_tab }) => {
          chrome.tabs.update(current_tab, { highlighted: true });

          // Reset
          chrome.storage.local.set({
            current_tab: "",
          });
        });

        // store access_token and refresh_token in storage as these will be used to authenticate user in chrome extension
        await chrome.storage.local.set({
          accessToken,
        });
        await chrome.storage.local.set({
          refreshToken,
        });

        // remove tab listener as tokens are set
        chrome.tabs.onUpdated.removeListener(setTokens);
      }
    }
  }
};

async function openSidePanel() {
  console.log("<-- Inside openSidePanel -->", isSidePanelVisible);

  chrome.tabs.query(
    { active: true, lastFocusedWindow: true },
    async ([tab]) => {
      const tabId = tab.id;

      console.log("1 tabdId: ", tabId);

      try {
        if (!isSidePanelVisible) {
          chrome.sidePanel.setOptions({
            tabId,
            path: "src/pages/sidepanel/index.html",
            enabled: true,
          });

          await chrome.sidePanel.open({ tabId });
        } else {
          chrome.sidePanel.setOptions({
            tabId,
            enabled: false,
          });
        }

        isSidePanelVisible = !isSidePanelVisible;

        const options = await chrome.sidePanel.getOptions({ tabId });
        console.log("OPTIONS: ", options);
      } catch (error) {
        console.error("Error opening sidepanel: ", error);
      }
    }
  );
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // console.log("[TAB UPDATED] tab: ", tab);

  if (!tab.url) return;

  const url = new URL(tab.url);

  // console.log("url: ", url);

  if (url.origin === "https://meet.google.com") {
    chrome.sidePanel.setOptions({
      tabId,
      path: "src/pages/sidepanel/index.html",
      enabled: true,
    });
  } else {
    chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  // const resp = await chrome.sidePanel.getOptions({ tabId });

  // console.log("[TAB ACTIVATED] resp: ", resp);

  const tabs = await chrome.tabs.query({ active: true });
  // console.log("[TAB ACTIVATED QUERY] tabs: ", tabs[0]);

  if (!tabs[0].url) return;

  // TODO: Avoid duplicate code
  const url = new URL(tabs[0].url);
  if (url.origin !== "https://meet.google.com") {
    chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});

/**
 * Handles the installation of the extension.
 */
async function handleInstall() {
  chrome.storage.local.set({
    recording_state: RecordingStates.ENDED,
  });

  console.log("####################");
  console.log("[handleINstall] SETTING CUR MEETING URL");
  console.log("####################");

  chrome.storage.local.set(
    {
      cur_meeting_url: "",
    },
    () => {
      console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
      console.log("[handleINstall]  cur_meeting_url");
      console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    }
  );

  console.log("Extension installed...");
  if (!(await hasDocument())) {
    // create offscreen document
    await createOffscreenDocument();
  }
}

/**
 * Sends a message to the offscreen document.
 * @param {string} type - The type of the message.
 * @param {Object} data - The data to be sent with the message.
 */
async function sendMessageToOffscreenDocument(type: string, data?: any) {
  // Adjusted to make 'data' optional  // Create an offscreen document if one doesn't exist yet
  try {
    if (!(await hasDocument())) {
      await createOffscreenDocument();
    }
  } finally {
    // Now that we have an offscreen document, we can dispatch the message.
    chrome.runtime.sendMessage({
      message: {
        type: type,
        target: "offscreen",
        data: data,
      },
    });
  }
}

/**
 * Initiates the stop recording process.
 */
function initateRecordingStop() {
  console.log("Recording stopped at offscreen");
  sendMessageToOffscreenDocument("STOP_OFFSCREEN_RECORDING");

  // chrome.runtime.sendMessage({
  //   message: {
  //     type: "HANDLE_END_MEETING",
  //     target: "sidepanel",
  //   },
  // });

  chrome.storage.local.set({
    recording_state: RecordingStates.ENDED,
  });

  chrome.notifications.create({
    title: "Hallyday AI assistant",
    message: "Meeting ended",
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-34.png"),
  });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log("NOTIFICATION CLICKED: ", notificationId);

  chrome.tabs.create({ url: HALLYDAY_WEBAPP, active: true });
});

/**
 * Initiates the start recording process.
 */
function initateRecordingStart() {
  chrome.tabs.query(
    { active: true, lastFocusedWindow: true },
    async ([tab]) => {
      if (chrome.runtime.lastError || !tab) {
        console.error("No valid webpage or tab opened");
        return;
      }

      console.log("==> TAB: ", tab);

      chrome.tabs.sendMessage(
        tab.id,
        {
          // Send message to content script of the specific tab to check and/or prompt mic permissions
          message: { type: "PROMPT_MICROPHONE_PERMISSION" },
        },
        async (response) => {
          console.log("[PROMPT_MICROPHONE_PERMISSION] Resp: ", response);

          // If user allows the mic permissions, we continue the recording procedure.
          if (response.message.status === "success") {
            console.log("Recording started at offscreen.....", tab.id);

            // Get a MediaStream for the active tab.
            chrome.tabCapture.getMediaStreamId(
              {
                targetTabId: tab.id,
              },
              (streamId) => {
                console.log("1 STREAM ID: ", streamId);

                sendMessageToOffscreenDocument(
                  "START_OFFSCREEN_RECORDING",
                  streamId
                );

                chrome.storage.local.set({
                  recording_state: RecordingStates.IN_PROGRESS,
                });

                const url = new URL(tab.url);
                const meeting_url = url.origin + url.pathname;

                console.log("####################");
                console.log(
                  "[initateRecordingStart] SETTING CUR MEETING URL: ",
                  meeting_url
                );
                console.log("####################");

                chrome.storage.local.set(
                  {
                    cur_meeting_url: meeting_url,
                  },
                  () => {
                    console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
                    console.log("[initateRecordingStart]  cur_meeting_url");
                    console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
                  }
                );
              }
            );

            chrome.tabCapture.getMediaStreamId(
              { targetTabId: tab.id },
              (streamId) => {
                console.log("2 STREAM ID: ", streamId);
              }
            );
          }
        }
      );
    }
  );
}

/**
 * Checks if there is an offscreen document.
 * @returns {Promise<boolean>} - Promise that resolves to a boolean indicating if an offscreen document exists.
 */
async function hasDocument() {
  console.log("Inside hasDocument");

  const matchedClients = await clients.matchAll();

  console.log("matchedClients: ", matchedClients);

  for (const client of matchedClients) {
    if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
      return true;
    }
  }
  return false;
}

/**
 * Creates the offscreen document.
 * @returns {Promise<void>} - Promise that resolves when the offscreen document is created.
 */
async function createOffscreenDocument() {
  console.log("Inside createOffscreenDocument");

  const resp = await chrome.offscreen.hasDocument();
  console.log("1 has doc: ", resp);

  try {
    await chrome.offscreen.createDocument(
      {
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [OFFSCREEN_REASON],
        justification: "To interact with user media",
      },
      async () => {
        console.log("<=== OFFSCREEN DOC CREATED ===>");

        const resp = await chrome.offscreen.hasDocument();
        console.log("2 has doc: ", resp);
      }
    );
  } catch (error) {
    console.log("CREATE OFFSCREEN ERROR: ", error);
  }
}
