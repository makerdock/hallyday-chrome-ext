/* eslint-disable prettier/prettier */
import { useEffect, useRef, useState } from "react";
import { Message } from "../../../utils/recorderUtils";
import { SpeakerType } from "../../../utils/speakerType";
import { addTranscription } from "../../../utils/supabase";

const JarvisScreen = () => {
  const meetingIdRef = useRef<number | null>(null);
  const [repText, setRepText] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null); // Reference to the timeout
  const [apiCallingStart, setAPICallingStart] = useState<boolean>(false);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request------------------------------------->", request);
      console.log("12c2 request.message.data: ", request.message);

      switch (request.message.type) {
        case "REP_TRANSCRIPT":
          {
            if (!apiCallingStart) {
              const { message_text } = request.message.data;
              setRepText((m) => m + message_text);
              const message: Message = {
                speaker_type: SpeakerType.REP,
                message_text,
                meeting_id: meetingIdRef.current,
              };
              // addTranscription(message);
            }
          }
          break;
      }
    });
  }, []);

  useEffect(() => {
    // Start or reset the timer when repText changes
    console.log("REP TEXT=====================>>>>>>>>>", repText);

    if (repText.length) {
      if (timerRef.current) clearTimeout(timerRef.current); // Reset the timer if already set
      timerRef.current = setTimeout(() => {
        // Call the API after 4 seconds if repText hasn't changed
        setAPICallingStart(true);
        sendTranscriptToBackend(repText)
        console.log("API call after 4 seconds");
      }, 4000);
    }
  }, [repText]);

  async function sendTranscriptToBackend(transcriptionArg: string) {
    const postData = {
      transcription: transcriptionArg,
      teamID: "",
    };
  
    try {
      // Make the POST request
      const response = await fetch("http://localhost:3000/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });
  
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
  
      const data = await response.json();
      console.log("API call Response after 4 seconds", data);
    } catch (error) {
      console.error("Error sending transcript to backend:", error);
    }
  }
  
  return (
    <div
      className="h-full flex text-center place-items-center bg-red-200"
      id="JarvisScreen"
    >
      <div className="w-full">
        <h2 className="w-full animate-pulse text-2xl font-bold">
          What would you like <br />
          me to do?
        </h2>
        {!!repText.length && <span>{repText}</span>}
      </div>
    </div>
  );
};

export default JarvisScreen;
