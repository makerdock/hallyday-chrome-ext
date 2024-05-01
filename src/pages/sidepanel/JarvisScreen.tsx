/* eslint-disable prettier/prettier */
import { useEffect, useRef, useState } from "react";
import { Message } from "../../../utils/recorderUtils";
import { SpeakerType } from "../../../utils/speakerType";
import { addTranscription } from "../../../utils/supabase";
import axios from "axios";
const JarvisScreen = () => {
  const meetingIdRef = useRef<number | null>(null);
  const [repText, setRepText] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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
    console.log("rep Text changing-------------------------------->",repText);
    // Start or reset the timer when repText changes
    if (repText.length) {
      if (timerRef.current) clearTimeout(timerRef.current); // Reset the timer if already set
      timerRef.current = setTimeout(() => {
        // Call the API after 4 seconds if repText hasn't changed
        setAPICallingStart(true);
        console.log("API call after 4 seconds");
        sendTranscriptToBackend();
      }, 4000);
    }
  }, [repText]);


  async function sendTranscriptToBackend() {
    try {
      if (!meetingIdRef) {
        throw new Error("Meeting ID not found");
      }
  
      const postData = {
        meetingId: meetingIdRef,
      };
  
      // Make the POST request using Axios
      const response = await axios.post("http://localhost:3000/api/ai/assistant", postData, {
        method:"POST",
        headers: {
          "Content-Type": "application/json",

        }
      });
  
      console.log("API call Response after 4 seconds", response.data);
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
