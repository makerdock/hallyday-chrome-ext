import { useEffect, useRef, useState } from "react";
import { Message } from "../../../utils/recorderUtils";
import { SpeakerType } from "../../../utils/speakerType";



import {
  addTranscription
} from "../../../utils/supabase";

const JarvisScreen = () => {
  const meetingIdRef = useRef<number | null>(null);
  const [repText, setRepText] = useState<string>("")

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("12c2 request.message.data: ", request.message);

      switch (request.message.type) {
        case "REP_TRANSCRIPT":
          {
            const { message_text } = request.message.data;
            setRepText(m => m + message_text)

            const message: Message = {
              speaker_type: SpeakerType.REP,
              message_text,
              meeting_id: meetingIdRef.current,
            };

            // addTranscription(message);
          }
          break;

      }
    });
  }, []);


  return (
    <div className="h-full flex text-center place-items-center bg-red-200" id="JarvisScreen">
      <div className="w-full">
        <h2 className="w-full animate-pulse text-2xl font-bold">What would you like <br />me to do?</h2>
        {!!repText.length && <span>{repText}</span>}
      </div>
    </div>
  );
};

export default JarvisScreen;
