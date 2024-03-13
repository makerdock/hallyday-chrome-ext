import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";
import { SpeakerType } from "../../../utils/speakerType";
import { Message, areTokensSet, isSameTab } from "../../../utils/recorderUtils";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import clsx from "clsx";

import {
  getTranscript,
  updateEndTime,
  updateMeetingInfo,
  updateTranscription,
} from "../../../utils/supabase";

const SidePanel = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const RECORDING = "Recording...";
  const NOT_RECORDING = "Not Recording";

  const DEFAULT_LISTENING_MSG = "Listening to the client...";
  const FAILED_LISTENING_MSG = "Couldn't determine the context :( Try again";

  const [recordingState, setRecordingState] = useState(NOT_RECORDING);
  const [loggedIn, setLoggedIn] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([
    // {
    //   aiInsight:
    //     "**ShipFast** supports an array of components including a **FAQ** component and **UI-only components** like buttons and inputs as external libraries. More details can be found on the provided link below. \n\n[https://shipfa.st/docs/components/faq](https://shipfa.st/docs/components/faq)",
    //   timestamp: "2024-02-27T15:25:32.885Z",
    //   messageText:
    //     "what are the different components supported in and ship first",
    //   speakerType: "client",
    // },
    // {
    //   aiInsight:
    //     "**ShipFast** supports an array of components including a **FAQ** component and **UI-only components** like buttons and inputs as external libraries. More details can be found on the provided link below. \n\n[https://shipfa.st/docs/components/faq](https://shipfa.st/docs/components/faq)",
    //   timestamp: "2024-02-27T15:25:32.885Z",
    //   messageText:
    //     "what are the different components supported in and ship first",
    //   speakerType: "client",
    // },
    // {
    //   aiInsight:
    //     "**ShipFast** supports an array of components including a **FAQ** component and **UI-only components** like buttons and inputs as external libraries. More details can be found on the provided link below. \n\n[https://shipfa.st/docs/components/faq](https://shipfa.st/docs/components/faq)",
    //   timestamp: "2024-02-27T15:25:32.885Z",
    //   messageText:
    //     "what are the different components supported in and ship first",
    //   speakerType: "client",
    // },
  ]);

  const [showWelcomeMsg, setShowWelcomeMsg] = useState<boolean>(true);

  const [showListeningMsg, setShowListeningMsg] = useState<boolean>(false);
  const [listeningMsg, setListeningMsg] = useState<string>(
    DEFAULT_LISTENING_MSG
  );

  const [query, setQuery] = useState<string>("");

  const showListeningMsgRef = useRef<boolean>(null);
  const sidepanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("=> transcription: ", transcription);

    if (scrollRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcription]);

  useEffect(() => {
    if (NOT_RECORDING === recordingState) {
      console.log("### SHOW WELCOME MSG ###");
      setShowWelcomeMsg(true);
      setShowListeningMsg(false);
    } else {
      setShowWelcomeMsg(false);
      setShowListeningMsg(true);
    }
  }, [transcription, recordingState]);

  useEffect(() => {
    console.log("===> [UE - showListeningMsg]: ", showListeningMsg);
    showListeningMsgRef.current = showListeningMsg;
  }, [showListeningMsg]);

  async function updateRecordingState(recordingState) {
    const isSame = await isSameTab();
    console.log(
      "[UPDATE STATE] recordingState: ",
      recordingState,
      " - isSame: ",
      isSame
    );

    if (recordingState === RecordingStates.IN_PROGRESS && isSame) {
      setRecordingState(RECORDING);
    } else {
      setRecordingState(NOT_RECORDING);
    }
  }

  useEffect(() => {
    if (RECORDING === recordingState) {
      updateMeetingInfo();
      populateExistingTranscripts();
    }
  }, [recordingState]);

  useEffect(() => {
    console.log("[SIDE PANEL] Inside Use Effect ...");

    chrome.storage.local.get("recording_state", ({ recording_state }) => {
      updateRecordingState(recording_state);
    });

    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      console.log("[SIDE PANEL] add listener ", changes, namespace);

      for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
        if ("recording_state" === key) {
          updateRecordingState(newValue);
        } else if ("accessToken" === key || "refreshToken" === key) {
          handleTokens();
        }
      }
    });

    handleTokens();
    populateExistingTranscripts();
  }, []);

  async function populateExistingTranscripts() {
    if (!(await isSameTab())) return;

    const transcription = await getTranscript();
    setTranscription(transcription || []);
  }

  async function handleEndMeeting() {
    updateEndTime();

    chrome.storage.local.set({
      cur_meeting_url: "",
    });
  }

  async function handleTokens() {
    const isSet = await areTokensSet();
    if (isSet) setLoggedIn(true);
  }

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request.message.data: ", request.message.data);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          {
            const { aiInsight, messageText, userRequestContent } =
              request.message.data;

            if (!aiInsight && !messageText) {
              setListeningMsg(FAILED_LISTENING_MSG);

              const interval = setInterval(() => {
                console.log("Setting default msg after 2 secs");
                setListeningMsg(DEFAULT_LISTENING_MSG);

                clearInterval(interval);
              }, 2000);

              return;
            }

            // if (aiInsight && aiInsight.length > 0)
            //   setMsgs((prev) => [...prev, aiInsight]);

            const message: Message = {
              speakerType: SpeakerType.CLIENT,
              messageText,
              aiInsight,
              userRequestContent,
              timestamp: new Date().toISOString(),
            };

            // updateTranscription(message);
            setTranscription((prev) => {
              const updatedTranscription = [...prev, message];
              updateTranscription(updatedTranscription);
              return updatedTranscription;
            });

            setListeningMsg(DEFAULT_LISTENING_MSG);
          }
          break;

        case "CLIENT_TRANSCRIPT":
          {
            console.log(
              "[CLIENT_TRANSCRIPT] showListeningMsg: ",
              showListeningMsg,
              showListeningMsgRef.current
            );

            if (showListeningMsgRef.current) {
              console.log(
                "[CLIENT_TRANSCRIPT] request.message.data: ",
                request.message.data
              );
              setListeningMsg(request.message.data);
            }
          }
          break;

        case "HANDLE_END_MEETING":
          handleEndMeeting();
          break;
      }
    });
  }, []);

  function handleLogin() {
    chrome.runtime.sendMessage({
      message: {
        type: "LOGIN",
        target: "background",
      },
    });
  }

  function handleClick() {
    setListeningMsg(query);

    chrome.runtime.sendMessage({
      message: {
        type: "TRANSCRIPTION_USER_INPUT",
        target: "offscreen",
        data: query,
      },
    });
  }

  return (
    <div className="h-full" ref={sidepanelRef} id="sidepanel">
      {loggedIn ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 bg-gray-300">
            <h2>Hallyday AI</h2>
            <p>{recordingState}</p>
          </div>

          <div className="h-full flex flex-col">
            {showListeningMsg && (
              <div className="p-4 bg-gray-300 m-4 mb-0 relative">
                <span>{listeningMsg}</span>
                <span className="animate-ping absolute top-0 right-0 h-[10px] w-[10px] rounded-full bg-red-800 opacity-95"></span>
              </div>
            )}

            {showWelcomeMsg && (
              <div className="p-4 bg-gray-300 m-4 relative">
                Welcome to Hallyday AI assitant. Click the extension icon to
                &apos;start recording&apos; and let AI to take care of the rest
                !
              </div>
            )}

            <div
              className={clsx(
                "overflow-auto flex-grow p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#474848]",
                window.innerHeight > 700 ? "max-h-[1052px]" : "max-h-[442px]"
              )}
              ref={scrollRef}
            >
              {transcription.map(({ userRequestContent, aiInsight }, index) => {
                return (
                  <div key={index}>
                    <span className="text-xscode">{userRequestContent}</span>
                    <p
                      className="bg-white rounded-md mb-4 p-2 shadow-lg min-h-[80px]"
                      key={index}
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ul: ({ node, ...props }) => (
                            <ul
                              style={{
                                padding: "10px 20px",
                              }}
                              {...props}
                            ></ul>
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              style={{
                                padding: "10px 20px",
                              }}
                              {...props}
                            ></ol>
                          ),
                          li: ({ node, ...props }) => (
                            <li
                              style={{
                                marginBottom: "10px",
                                listStyle: "auto",
                              }}
                              {...props}
                            ></li>
                          ),
                          a: ({ node, ...props }) => (
                            <a style={{ color: "blue" }} {...props}></a>
                          ),
                        }}
                      >
                        {aiInsight}
                      </Markdown>
                    </p>
                  </div>
                );
              })}
            </div>

            {showListeningMsg && (
              <div className="w-full p-4">
                <input
                  type="text"
                  className="input w-full p-4 bg-[#F3F4F6]"
                  placeholder="Enter your query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.code === "Enter" || e.code === "NumpadEnter") {
                      e.preventDefault();
                      handleClick();
                      setQuery("");
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full flex mt-4">
          <button
            className="p-2 px-4 bg-gray-500 rounded-md mx-auto"
            onClick={handleLogin}
          >
            LogIn
          </button>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
