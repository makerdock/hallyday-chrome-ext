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

let actionClicked = false;

/**
 * Listener for extension installation.
 */
chrome.runtime.onInstalled.addListener(handleInstall);

chrome.action.onClicked.addListener(() => {
  actionClicked = !actionClicked;

  console.log("Action clicked....", actionClicked);

  if (actionClicked) initateRecordingStart();
  else initateRecordingStop();
});

/**
 * Listener for messages from the extension.
 * @param {Object} request - The message request.
 * @param {Object} sender - The sender of the message.
 * @param {function} sendResponse - Callback function to send a response.
 */
chrome.runtime.onMessage.addListener((request) => {
  switch (request.message.type) {
    case "TOGGLE_RECORDING":
      switch (request.message.data) {
        case "START":
          // chrome.action.onClicked.dispatch();

          // chrome.ction.openPopup();

          initateRecordingStart();

          console.log("STARTING..", request);

          // openSidePanel(sender.tab.id);
          break;
        case "STOP":
          initateRecordingStop();
          break;
      }
      break;
    case "SHOW_SIDEPANEL":
      openSidePanel();
      break;
  }
});

async function openSidePanel() {
  // await chrome.sidePanel.open({ tabId });
  // await chrome.sidePanel.setOptions({
  //   tabId: sender.tab.id,
  //   path: "sidepanel-tab.html",
  //   enabled: true,
  // });

  console.log("<-- Inside openSidePanel -->");

  chrome.tabs.query(
    { active: true, lastFocusedWindow: true },
    async ([tab]) => {
      const tabId = tab.id;

      console.log("tabdId: ", tabId);

      await chrome.sidePanel.open({ tabId });

      await chrome.sidePanel.setOptions({
        tabId,
        path: "src/pages/sidepanel/index.html",
        enabled: true,
      });
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
  // console.log("[TAB ACTIVATED QUERY] tabs: ", tabs[0].url);

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
}

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
            console.log("Recording started at offscreen");

            // Get a MediaStream for the active tab.
            chrome.tabCapture.getMediaStreamId(
              {
                targetTabId: tab.id,
              },
              (streamId) => {
                console.log("STREAM ID: ", streamId);

                sendMessageToOffscreenDocument(
                  "START_OFFSCREEN_RECORDING",
                  streamId
                );
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
