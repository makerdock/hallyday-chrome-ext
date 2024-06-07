import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";
import { SpeakerType } from "../../../utils/speakerType";
import {
  Message,
  MessageForPlayBook,
  areTokensSet,
  isSameTab,
} from "../../../utils/recorderUtils";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import {
  addTranscription,
  updateEndTime,
  addAndGetMeetingInfo,
  getClientTranscript,
} from "../../../utils/supabase";
import JarvisScreen from "./JarvisScreen";
import PlaybookDropdown from "./PlaybookDropdown";
import axios from "axios";

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
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [transcriptionPlayBook, setTranscriptionPlayBook] = useState<
    MessageForPlayBook[]
  >([]);
  const [nextPlayBookMessage, setNextPlayBookMessage] = useState<string>();
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
    await updateEndTime();

    await chrome.storage.local.set({
      cur_meeting_url: "",
    });

    await chrome.tabs.create({
      url: `${HALLYDAY_WEBAPP}/meeting/${meetingIdRef.current}`,
      active: true,
    });
  }

  async function handleTokens() {
    const isSet = await areTokensSet();
    if (isSet) setLoggedIn(true);
  }

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("Received request:", request);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          {
            // If JarvisScreen showing
            if (!isMeetingActive) return;
            const { ai_insight, message_text, user_request_content } =
              request.message.data;
            console.log("[CLIENT_TRANSCRIPT_CONTEXT] Data:", {
              ai_insight,
              message_text,
              user_request_content,
            });

            if (!ai_insight && !message_text) {
              setListeningMsg(FAILED_LISTENING_MSG);

              const interval = setInterval(() => {
                console.log(
                  "Setting default listening message after 2 seconds."
                );
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
              console.log(
                "Updated client transcription:",
                updatedTranscription
              );
              addTranscription(message);
              return updatedTranscription;
            });

            setTranscriptionPlayBook((prev) => {
              const updatedTranscription = [...prev, message];
              console.log(
                "Updated current client transcription playbook:",
                updatedTranscription
              );
              return updatedTranscription;
            });
            setListeningMsg(DEFAULT_LISTENING_MSG);
          }
          break;

        case "REP_TRANSCRIPT":
          {
            // If JarvisScreen showing
            if (!isMeetingActive) return;

            const { message_text } = request.message.data;
            console.log("[REP_TRANSCRIPT] Message text:", message_text);

            const message: Message = {
              speaker_type: SpeakerType.REP,
              message_text,
              meeting_id: meetingIdRef.current,
            };

            console.log(
              "===> Before adding REP transcription, meeting ID:",
              meetingIdRef.current
            );
            addTranscription(message);
            setTranscriptionPlayBook((prev) => {
              const updatedTranscription = [...prev, message];
              console.log(
                "Updated REP transcription playbook:",
                updatedTranscription
              );
              return updatedTranscription;
            });
          }
          break;

        case "CLIENT_TRANSCRIPT":
          {
            console.log(
              "[CLIENT_TRANSCRIPT] showListeningMsg:",
              showListeningMsg,
              showListeningMsgRef.current
            );
            // If jarvisScreen showing
            if (!isMeetingActive) return;

            if (showListeningMsgRef.current) {
              console.log(
                "[CLIENT_TRANSCRIPT] Listening message data:",
                request.message.data
              );
              setListeningMsg(request.message.data);
            }
          }
          break;

        case "CLIENT_TRANSCRIPT_CURRENT":
          {
            const { data } = request.message;
            console.log("[CLIENT_TRANSCRIPT_CURRENT] Data:", data);

            // const message: Message = {
            //   speaker_type: SpeakerType.CLIENT,
            //   message_text: data,
            //   meeting_id: meetingIdRef.current,
            // };
            // addTranscription(message);
            // setTranscriptionPlayBook((prev) => {
            //   const updatedTranscription = [...prev, message];
            //   console.log(
            //     "Updated current client transcription playbook:",
            //     updatedTranscription
            //   );
            //   return updatedTranscription;
            // });
          }
          break;

        case "HANDLE_END_MEETING":
          console.log("Handling end meeting.");
          handleEndMeeting();
          break;

        default:
          console.warn("Unknown message type:", request.message.type);
      }
    });
  }, []);

  const checkLastTwoMessages = async (messages: MessageForPlayBook[]) => {
    if (messages?.length < 2) return;

    const lastTwoMessages = messages.slice(-2);
    const speakerTypes = lastTwoMessages.map((message) => message.speaker_type);

    if (
      speakerTypes.includes(SpeakerType.REP) &&
      speakerTypes.includes(SpeakerType.CLIENT)
    ) {
      await callAIPlaybookAPI(meetingIdRef?.current);
    }
  };

  useEffect(() => {
    console.log("[transcriptionPlayBook]:", transcriptionPlayBook);
    checkLastTwoMessages(transcriptionPlayBook);
  }, [transcriptionPlayBook]);

  const callAIPlaybookAPI = async (meeting_id: number | null) => {
    try {
      if (!meeting_id) throw new Error("Meeting ID required");
      const selectedPlaybookId = await loadSelectedPlaybookId();
      if (!selectedPlaybookId) throw new Error("Playbook ID required");

      const postData = {
        meetingId: meeting_id,
        playbookId: selectedPlaybookId,
      };

      const response = await axios.post(
        "http://localhost:3000/api/ai/playbook",
        postData,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const responseData = response.data;

      if (response.status !== 200 || responseData.error) {
        throw new Error(responseData.error || "An error occurred");
      }

      const { nextStep } = responseData;
      setNextPlayBookMessage(nextStep);
    } catch (error) {
      console.error("Error sending playbook:", error);
    }
  };

  const loadSelectedPlaybookId = () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("selectedPlaybookId", (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result.selectedPlaybookId);
      });
    });
  };

  function handleLogin() {
    chrome.runtime.sendMessage({
      message: {
        type: "LOGIN",
        target: "background",
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
      {loggedIn && <PlaybookDropdown />}
      {loggedIn &&
        (nextPlayBookMessage ? (
          <div className="p-4 m-4 relative bg-white border border-gray-300 rounded-lg shadow">
            <h2 className="text-lg font-bold">Next Action</h2>
            {nextPlayBookMessage}
          </div>
        ) : (
          <div className="p-4 m-4 relative bg-white border border-gray-300 rounded-lg shadow">
            <h2 className="text-lg font-bold">Next Action</h2>
            No new messages. Prepare for the next question.
          </div>
        ))}
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
                "overflow-auto flex-1 flex-grow p-4 scrollbar-t hin scrollbar-track-transparent scrollbar-thumb-[#474848]"
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
          </div>
        </div>
      ) : (
        <div className="w-full flex">
          <button
            className="p-2 px-4 m-2 bg-gray-500 rounded-md mx-auto"
            onClick={handleLogin}
          >
            Login
          </button>
        </div>
      )}
      <div className="max-w-full w-full fixed bottom-0 p-2">
        {loggedIn && (
          <button
            onClick={handleEndMeetingClick}
            className="bg-red-500 text-white py-2 rounded-lg w-full"
          >
            End meeting
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveMeetingTab;
