import { useEffect, useRef, useState } from "react";
import { Message } from "../../../utils/recorderUtils";
import { SpeakerType } from "../../../utils/speakerType";
import {
  addAndGetMeetingInfo,
  addTranscription,
} from "../../../utils/supabase";
import axios from "axios";
import { Toaster, toast } from "sonner";

const JarvisScreen = () => {
  const meetingIdRef = useRef<number | null>(null);
  const [repText, setRepText] = useState<string>("");
  const [endMeetingAction, setEndMeetingAction] = useState<string>();
  const [asanaTask, setAsanaTask] = useState<string[]>([]);
  const [taskCompleteFlag, setTaskCompleteFlag] = useState<boolean>(false);
  const [slackSummary, setSlackSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const messageListener = (request: any) => {
      if (
        request.message.type === "REP_TRANSCRIPT" &&
        !loading &&
        !taskCompleteFlag
      ) {
        const { message_text } = request.message.data;
        setRepText((prevText) => prevText + message_text);
        if (!meetingIdRef.current) {
          startRecording().then(() => {
            saveTranscription(message_text);
          });
        } else {
          saveTranscription(message_text);
        }
      }
    };

    const startRecording = async () => {
      try {
        const { id } = await addAndGetMeetingInfo();
        meetingIdRef.current = id;
      } catch (error) {
        console.error("Error starting recording:", error);
        toast.error("Error starting recording.");
      }
    };

    const saveTranscription = async (message_text: string) => {
      const message: Message = {
        speaker_type: SpeakerType.REP,
        message_text,
        meeting_id: meetingIdRef.current,
      };
      try {
        if (!loading) {
          await addTranscription(message);
          await callAIAssistantAPI(meetingIdRef.current);
        }
      } catch (error) {
        console.error("Error saving transcription:", error);
        toast.error("Error saving transcription.");
      }
    };

    const callAIAssistantAPI = async (meeting_id: number | null) => {
      setLoading(true);
      try {
        if (!meeting_id) throw new Error("Meeting ID required");

        const postData = { meetingId: meeting_id, asanaTask, slackSummary };

        const response = await axios.post(
          "http://localhost:3000/api/ai/assistant",
          postData,
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        const responseData = response.data;

        if (response.status !== 200 || responseData.error) {
          throw new Error(responseData.error || "An error occurred");
        }

        const { data, type, message, error } = responseData;

        if (error) {
          throw new Error(error);
        }

        if (message) {
          setTaskCompleteFlag(true);
          toast.success(message);
        }

        if (type === "create_asana_tasks" && data) {
          setEndMeetingAction(type);
          setAsanaTask(data);
        } else if (type === "send_summary_to_slack" && data) {
          setEndMeetingAction(type);
          setSlackSummary(data);
        }
      } catch (error) {
        toast.error(error.message);
        console.error("Error sending transcript:", error);
      } finally {
        setRepText("");
        setLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [asanaTask, slackSummary, repText, loading, taskCompleteFlag]);

  return (
    <div
      className="h-full flex text-center place-items-center bg-red-200"
      id="JarvisScreen"
    >
      <Toaster />
      <div className="w-full">
        <h2 className="w-full animate-pulse text-2xl font-bold">
          What would you like <br />
          me to do?
        </h2>
        {!!repText.length && <span className="text-lg">{repText}</span>}
        <div className="flex flex-col gap-1 ml-2 mt-2">
          {endMeetingAction === "create_asana_tasks" &&
            asanaTask &&
            asanaTask.map((task, index) => (
              <div className="flex gap-2 p-1" key={index}>
                <span>{index + 1}</span>
                <p className="text-sm text-start font-medium text-gray-900">
                  {task}
                </p>
              </div>
            ))}
        </div>
        <div className="flex flex-col gap-1 ml-2 mt-2">
          {endMeetingAction === "send_summary_to_slack" && slackSummary && (
            <p className="text-sm text-start font-medium text-gray-900">
              {slackSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JarvisScreen;
