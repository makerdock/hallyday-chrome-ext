import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";
// import { Tokens, getTokens } from "../../../utils/getTokens";
import { SupabaseClient } from "@supabase/supabase-js";
import { SpeakerType } from "../../../utils/speakerType";
import {
  areTokensSet,
  getMeetingUrl,
  isSameTab,
  getTokens,
  Tokens,
} from "../../../utils/recorderUtils";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import clsx from "clsx";

import { isDesktop } from "react-device-detect";

const SidePanel = () => {
  interface MeetingUrl {
    cur_meeting_url: string;
  }

  interface Message {
    speakerEmail?: string;
    speakerType: "rep" | "client";
    messageText: string;
    timestamp: string;
    aiInsight?: string;
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  const RECORDING = "Recording...";
  const NOT_RECORDING = "Not Recording";

  const DEFAULT_LISTENING_MSG = "Listening to the client...";
  const FAILED_LISTENING_MSG = "Couldn't determine the context :( Try again";

  // const [msgs, setMsgs] = useState([]);
  const [recordingState, setRecordingState] = useState(NOT_RECORDING);
  const [loggedIn, setLoggedIn] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient>();
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

  const supabaseClientRef = useRef<SupabaseClient>(null);

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
    console.log(
      "[UE - transcription, recordingState]: ",
      transcription,
      recordingState
    );

    console.log(
      "[UE - transcription, recordingState]: ",
      transcription.length === 0,
      NOT_RECORDING === recordingState
    );

    if (transcription.length === 0 && NOT_RECORDING === recordingState) {
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

    // setRecordingState(
    //   recordingState === RecordingStates.IN_PROGRESS ? RECORDING : NOT_RECORDING
    // );
  }

  useEffect(() => {
    // console.log(
    //   "[UE] supabaseClient, recordingState: ",
    //   supabaseClient,
    //   recordingState
    // );

    if (RECORDING === recordingState && supabaseClient) updateMeetingInfo();
    else if (NOT_RECORDING === recordingState && supabaseClient)
      handleEndMeeting();
  }, [supabaseClient, recordingState]);

  useEffect(() => {
    // console.log(
    //   "[UE] supabaseClient, transcription: ",
    //   supabaseClient,
    //   transcription
    // );

    if (transcription && supabaseClient) {
      console.log("<--- SHOULD UPDATE TRANSCRIPTION --->");
    }
  }, [supabaseClient, transcription]);

  useEffect(() => {
    console.log("[SIDE PANEL] Inside Use Effect ...");

    handleSupabaseClient();

    chrome.storage.local.get("recording_state", ({ recording_state }) => {
      updateRecordingState(recording_state);
    });

    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      console.log("[SIDE PANEL] add listener ", changes, namespace);

      for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(
          "$$$$ #### key: ",
          key,
          " - old: ",
          oldValue,
          " - new: ",
          newValue
        );

        if ("recording_state" === key) {
          updateRecordingState(newValue);
        } else if ("accessToken" === key || "refreshToken" === key) {
          handleTokens();
        }
      }
    });

    handleTokens();
    populateExistingTranscripts();

    console.log("===> window.innerWidth: ", window.innerWidth);
    console.log("===> window.innerHeight: ", window.innerHeight);

    console.log("===> document.innerWidth: ", document.body.clientWidth);
    console.log("===> document.innerHeight: ", document.body.clientHeight);

    console.log(
      "===> sidepanelRef.current.innerWidth: ",
      sidepanelRef.current.clientWidth
    );
    console.log(
      "===> sidepanelRef.current.innerHeight: ",
      sidepanelRef.current.clientHeight
    );

    console.log(
      "document width: ",
      document.querySelector("#sidepanel").clientWidth
    );
    console.log(
      "document height: ",
      document.querySelector("#sidepanel").clientHeight
    );
  }, []);

  useEffect(() => {
    console.log(">>> [UE] supabaseClient: ", supabaseClient);
    if (supabaseClient) {
      updateUserId();

      supabaseClientRef.current = supabaseClient;
    }
  }, [supabaseClient]);

  async function updateMeetingInfo() {
    console.log("Inside updateMeetingInfo, ", supabaseClient);
    if (!supabaseClient) return;

    const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

    console.log("==> Meeting Url: ", cur_meeting_url);

    const data = await supabaseClient.from("meeting").upsert([
      {
        meeting_url: cur_meeting_url,
      },
    ]);

    console.log("#### [UPSERT] Data: ", data);
    // console.log("[UPSERT] Error: ", error);

    populateExistingTranscripts();
  }

  async function populateExistingTranscripts() {
    if (!(await isSameTab())) return;

    const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

    if (!cur_meeting_url) return;

    const { data, error } = await supabaseClientRef.current
      .from("meeting")
      .select("transcription")
      .eq("meeting_url", cur_meeting_url)
      .single();

    const { transcription } = data;
    setTranscription(transcription || []);

    console.log("[populateExistingTranscripts] data: ", data);
    console.log("[populateExistingTranscripts] error: ", error);
  }

  async function handleEndMeeting() {
    console.log("#############################");
    console.log("<<<< Inside handleEndMeeting >>>>", supabaseClient);
    console.log("#############################");

    const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

    console.log("cur_meeting_url: ", cur_meeting_url);

    if (!cur_meeting_url) return;

    const { data, error } = await supabaseClient
      .from("meeting")
      .select("start_time")
      .eq("meeting_url", cur_meeting_url)
      .single();

    console.log("[handleEndMeeting] data: ", data);

    console.log("[handleEndMeeting] error: ", error);

    const start_time = data?.start_time || new Date().toISOString();
    const start_time_date: Date = new Date(start_time);
    const end_time: Date = new Date();
    const duration_in_sec =
      (end_time.getTime() - start_time_date.getTime()) / 1000;

    console.log("duration_in_sec: ", duration_in_sec);

    const { data: upsertData } = await supabaseClient.from("meeting").upsert([
      {
        meeting_url: cur_meeting_url,
        duration: duration_in_sec,
      },
    ]);

    console.log("#### [UPSERT] Data: ", upsertData);

    console.log("####################");
    console.log("[handleEndMeeting] SETTING CUR MEETING URL");
    console.log("####################");

    chrome.storage.local.set(
      {
        cur_meeting_url: "",
      },
      () => {
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("[handleEndMeeting]  cur_meeting_url");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
      }
    );
  }

  // async function getMeetingUrl() {
  //   return new Promise((resolve, reject) => {
  //     chrome.storage.local.get(["cur_meeting_url"], ({ cur_meeting_url }) => {
  //       resolve({ cur_meeting_url });
  //     });
  //   });
  // }

  function handleSupabaseClient() {
    const { createClient } = window.supabase;
    const _supabase = createClient(
      "https://fhkdrjttwyipealchxne.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa2RyanR0d3lpcGVhbGNoeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwODgyNDIsImV4cCI6MjAyMzY2NDI0Mn0.YMSvBR5BXRV1lfXI5j_z-Gd6v0cZNojONjf3YHTiHNY"
    );
    setSupabaseClient(_supabase);
  }

  async function updateUserId() {
    const { accessToken, refreshToken } = (await getTokens()) as Tokens;

    const resp = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    console.log("SUPABASE DATA: ", resp);
  }

  async function handleTokens() {
    // const { accessToken, refreshToken } = (await getTokens()) as Tokens;
    // if (accessToken && refreshToken) setLoggedIn(true);

    const isSet = await areTokensSet();
    if (isSet) setLoggedIn(true);
  }

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request.message.data: ", request.message.data);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          {
            const { aiInsight, messageText } = request.message.data;

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
              timestamp: new Date().toISOString(),
            };

            console.log("message: ", message);

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

        // case "HANDLE_END_MEETING":
        //   handleEndMeeting();
        //   break;
      }
    });
  }, []);

  async function updateTranscription(updatedTranscription) {
    const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

    console.log("[updateTranscription] cur_meeting_url: ", cur_meeting_url);
    console.log("[updateTranscription] supabaseClient: ", supabaseClient);

    console.log(
      "[updateTranscription] supabaseClientRef.current: ",
      supabaseClientRef.current
    );

    const { data, error } = await supabaseClientRef.current
      .from("meeting")
      .upsert([
        {
          meeting_url: cur_meeting_url,
          transcription: updatedTranscription,
        },
      ]);

    console.log("[updateTranscription] data: ", data);
    console.log("[updateTranscription] error: ", error);
  }

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

            <div
              className={clsx(
                "overflow-auto flex-grow p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#474848]",
                window.innerHeight > 700 ? "max-h-[1052px]" : "max-h-[442px]"
              )}
              ref={scrollRef}
            >
              {transcription.map(({ aiInsight }, index) => {
                return (
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

          {showWelcomeMsg && (
            <div className="p-4 bg-gray-300 m-4 absolute top-[50px]">
              Welcome to Hallyday AI assitant. Click the extension icon to
              &apos;start recording&apos; and let AI to take care of the rest !
            </div>
          )}
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
