import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";
import { SpeakerType } from "../../../utils/speakerType";
import { Message, areTokensSet, isSameTab } from "../../../utils/recorderUtils";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import clsx from "clsx";

import {
  addTranscription,
  updateEndTime,
  addAndGetMeetingInfo,
  getClientTranscript,
  getCurrentUser,
} from "../../../utils/supabase";
import JarvisScreen from "./JarvisScreen";

const ActiveMeetingTab = () => {
  const HALLYDAY_WEBAPP = "https://hallyday-dashboard.vercel.app";

  const scrollRef = useRef<HTMLDivElement>(null);

  const RECORDING = "Recording...";
  const NOT_RECORDING = "Not Recording";

  const DEFAULT_LISTENING_MSG = "Listening to the client...";
  const FAILED_LISTENING_MSG = "Couldn't determine the context :( Try again";

  const [recordingState, setRecordingState] = useState(NOT_RECORDING);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isMeetingActive, setMeetingActive] = useState<boolean>(true);
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
  const ActiveMeetingTabRef = useRef<HTMLDivElement>(null);
  const meetingIdRef = useRef<number>(-1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcription]);

  useEffect(() => {
    if (NOT_RECORDING === recordingState) {
      setShowWelcomeMsg(true);
      setShowListeningMsg(false);
    } else {
      setShowWelcomeMsg(false);
      setShowListeningMsg(true);
    }
  }, [transcription, recordingState]);

  useEffect(() => {
    showListeningMsgRef.current = showListeningMsg;
  }, [showListeningMsg]);

  async function updateRecordingState(recordingState) {
    const isSame = await isSameTab();

    if (recordingState === RecordingStates.IN_PROGRESS && isSame) {
      setRecordingState(RECORDING);
    } else {
      setRecordingState(NOT_RECORDING);
    }
  }

  async function handleRecordingStart() {
    const { id } = await addAndGetMeetingInfo();

    meetingIdRef.current = id;

    populateExistingTranscripts();
  }

  useEffect(() => {
    if (RECORDING === recordingState) {
      handleRecordingStart();
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

    const transcription = await getClientTranscript(meetingIdRef.current);

    // const transcription = await getTranscript();
    setTranscription(transcription || []);
  }

  async function handleEndMeeting() {
    updateEndTime();

    chrome.storage.local.set({
      cur_meeting_url: "",
    });

    chrome.tabs.create({
      url: `${HALLYDAY_WEBAPP}/meeting/${meetingIdRef.current}`,
      active: true,
    });
  }

  async function handleTokens() {
    const userFound = await getCurrentUser();
    const isSet = await areTokensSet();
    if (isSet && userFound) setLoggedIn(true);
  }

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("12c2 request.message.data: ", request.message);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          {
            const { ai_insight, message_text, user_request_content } =
              request.message.data;
            // console.log("🚀 ~ chrome.runtime.onMessage.addListener ~ user_request_content:", user_request_content)

            if (!ai_insight && !message_text) {
              setListeningMsg(FAILED_LISTENING_MSG);

              const interval = setInterval(() => {
                console.log("Setting default msg after 2 secs");
                setListeningMsg(DEFAULT_LISTENING_MSG);

                clearInterval(interval);
              }, 2000);

              return;
            }

            const message: Message = {
              speaker_type: SpeakerType.CLIENT,
              message_text,
              ai_insight,
              meeting_id: meetingIdRef.current,
            };

            setTranscription((prev) => {
              const updatedTranscription = [...prev, message];

              addTranscription(message);
              return updatedTranscription;
            });

            setListeningMsg(DEFAULT_LISTENING_MSG);
          }
          break;

        case "REP_TRANSCRIPT":
          {
            const { message_text } = request.message.data;

            const message: Message = {
              speaker_type: SpeakerType.REP,
              message_text,
              meeting_id: meetingIdRef.current,
            };

            console.log("===> befre sending: ", meetingIdRef.current);

            addTranscription(message);
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

  const handleEndMeetingClick = () => {
    setMeetingActive(false);
  };

  if (!isMeetingActive) {
    return <JarvisScreen />;
  }

  return (
    <div className="h-full" ref={ActiveMeetingTabRef} id="ActiveMeetingTab">
      {loggedIn ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 bg-gray-300">
            <h2>Hallyday AI</h2>
            <p>{recordingState}</p>
          </div>

          <div className="flex flex-col flex-grow max-h-[calc(100%_-_54px)]">
            {showListeningMsg && (
              <div className="p-4 bg-gray-300 m-4 relative">
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
                "overflow-auto flex-1 flex-grow p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#474848]"
              )}
              ref={scrollRef}
            >
              {transcription.map(({ message_text, ai_insight }, index) => {
                return (
                  <div key={index}>
                    <span className="text-xscode">{message_text}</span>
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
                        {ai_insight}
                      </Markdown>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* {showListeningMsg && (
              <div className="w-full p-4 mt-auto">
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
            )} */}
          </div>
        </div>
      ) : (
        <div className="w-full flex">
          <button
            className="p-2 px-4 m-2 bg-gray-500 rounded-md mx-auto"
            onClick={handleLogin}
          >
            LogIn
          </button>
        </div>
      )}
    </div>
  );
};

export default ActiveMeetingTab;
