import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";

const SidePanel = () => {
  interface Tokens {
    accessToken: string;
    refreshToken: string;
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  const [msgs, setMsgs] = useState([]);
  const [recordingState, setRecordingState] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    console.log("=> msgs: ", msgs);

    if (scrollRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [msgs]);

  function updateState(recordingState) {
    console.log("[UPDATE STATE] recordingState: ", recordingState);

    setRecordingState(
      recordingState === RecordingStates.IN_PROGRESS
        ? "Recording..."
        : "Not recording"
    );
  }

  useEffect(() => {
    console.log("[SIDE PANEL] Inside Use Effect ...");

    chrome.storage.local.get("recording_state", ({ recording_state }) => {
      console.log("[SIDE PANEL] setting recording state ", recording_state);
      console.log(
        "[SIDE PANEL] RecordingStates.IN_PROGRESS ",
        RecordingStates.IN_PROGRESS
      );
      console.log("[SIDE PANEL] RecordingStates.ENDED ", RecordingStates.ENDED);

      console.log(
        "[SIDE PANEL] RecordingStates.IN_PROGRESS ",
        recording_state === RecordingStates.IN_PROGRESS
      );

      updateState(recording_state);
    });

    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      console.log("[SIDE PANEL] add listener ", changes, namespace);

      for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log("key: ", key, " - old: ", oldValue, " - new: ", newValue);

        if ("recording_state" === key) {
          updateState(newValue);
        } else if ("accessToken" === key || "refreshToken" === key) {
          const tokens = (await getTokens()) as Tokens;

          const { accessToken, refreshToken } = tokens;
          if (accessToken && refreshToken) setLoggedIn(true);
        }
      }
    });
  }, []);

  function getTokens() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(
        ["accessToken", "refreshToken"],
        ({ accessToken, refreshToken }) => {
          resolve({ accessToken, refreshToken });
        }
      );
    });
  }

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request.message.data: ", request.message.data);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          {
            const transcript = request.message.data;

            if (transcript && transcript.length > 0)
              setMsgs((prev) => [...prev, transcript]);
          }
          break;
      }
    });
  }, []);

  return (
    <div>
      {loggedIn ? (
        <div className="h-full pb-8">
          <div className="flex items-center justify-between p-4 bg-gray-300">
            <h2>Hallyday AI</h2>
            <p>{recordingState}</p>
          </div>
          <div className="overflow-auto h-full p-4" ref={scrollRef}>
            {msgs.map((msg, index) => {
              return (
                <p
                  className="bg-white rounded-md mb-4 p-2 shadow-lg min-h-[80px]"
                  key={index}
                >
                  {msg}
                </p>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <button className="p-2 px-4 bg-gray-500 rounded-md">LogIn</button>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
