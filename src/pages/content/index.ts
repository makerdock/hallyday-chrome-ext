console.log("<=== content loaded ===>");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message.type) {
    case "PROMPT_MICROPHONE_PERMISSION":
      // Check for mic permissions. If not found, prompt
      checkMicPermissions()
        .then(() => {
          sendResponse({ message: { status: "success" } });
        })
        .catch(() => {
          promptMicPermissions();

          const iframe = document.getElementById(
            "PERMISSION_IFRAME_ID"
          ) as HTMLIFrameElement;

          // Create a closure to keep track of the response
          const responseCallback = (event) => {
            if (event.source === iframe.contentWindow && event.data) {
              if (event.data.type === "permissionsGranted") {
                sendResponse({
                  message: { status: "success" },
                });
              } else {
                sendResponse({
                  message: {
                    status: "failure",
                  },
                });
              }
              document.body.removeChild(iframe);
              // Remove the event listener after handling the response
              window.removeEventListener("message", responseCallback);
            }
          };

          window.addEventListener("message", responseCallback);
        });
      // Return true to indicate that a response will be sent asynchronously
      return true;

    default:
      // Do nothing for other message types
      break;
  }
});

/**
 * Checks microphone permissions using a message to the background script.
 * @returns {Promise<void>} - Promise that resolves if permissions are granted, rejects otherwise.
 */
async function checkMicPermissions() {
  console.log("....Inside checkMicPermissions....");

  return new Promise<void>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        message: {
          type: "CHECK_PERMISSIONS",
          target: "offscreen",
        },
      },
      (response) => {
        console.log("[CHECK_PERMISSIONS] reponse: ", response);

        if (response.message.status === "success") {
          resolve();
        } else {
          reject(response.message.data);
        }
      }
    );
  });
}

/**
 * Prompts the user for microphone permissions using an iframe.
 */
function promptMicPermissions() {
  console.log("... Inside promptMicPermissions ...");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("hidden", "hidden");
  iframe.setAttribute("allow", "microphone");
  iframe.setAttribute("id", "PERMISSION_IFRAME_ID");
  iframe.src = chrome.runtime.getURL("requestPermissions.html");
  document.body.appendChild(iframe);
}

console.log("<----- INSIDE G MEEET ---->");

const eleFound = setInterval(async function () {
  if (document.querySelectorAll(".u6vdEc.ouH3xe").length > 0) {
    clearInterval(eleFound);

    console.log("<--- MEETING STARTED --->");

    addBtn();

    // Side panel can only be opened thro user actions, hence adding this hack here to mimic btn click
    // https://developer.chrome.com/docs/extensions/reference/api/sidePanel#open

    const btnPanel = document.querySelector(".btn-panel") as HTMLElement; // Type assertion
    if (btnPanel) {
      btnPanel.click(); // Now TypeScript recognizes click property
    }
  }
}, 100); // check every 100ms

function addBtn() {
  const button = new DOMParser().parseFromString(
    "<button>Click to open side panel</button>",
    "text/html"
  ).body.firstElementChild as HTMLElement;

  button.classList.add("btn-panel");
  button.style.visibility = "hidden";
  button.style.position = "absolute";

  document.body.append(button);

  button.addEventListener("click", function () {
    chrome.runtime.sendMessage({
      message: {
        type: "SHOW_SIDEPANEL",
        target: "background",
      },
    });
  });
}
