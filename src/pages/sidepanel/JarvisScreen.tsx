/* eslint-disable prettier/prettier */
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [endMeetingResponseType, setEndMeetingResponseType] =
    useState<string>();
  const [asanaTask, setAsanaTask] = useState<string[]>();
  const [slackSummary, setSummarySlack] = useState<string>();
  const [apiCallingStart, setAPICallingStart] = useState<boolean>(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request------------------------------------->", request);
      console.log("12c2 request.message.data: ", request.message);
      switch (request.message.type) {
        case "REP_TRANSCRIPT":
          {
            const { message_text } = request.message.data;
            setRepText((m) => m + message_text);
            const message: Message = {
              speaker_type: SpeakerType.REP,
              message_text,
              meeting_id: meetingIdRef.current,
            };
            addTranscription(message);
          }
          break;
      }
    });
  }, []);

  useEffect(() => {
    // Start or reset the timer when repText changes
    if (repText.length) {
      if (timerRef.current) clearTimeout(timerRef.current); // Reset the timer if already set
      timerRef.current = setTimeout(() => {
        // Call the API after 4 seconds if repText hasn't changed
        setAPICallingStart(true);
        console.log("API call after 4 seconds");
      }, 4000);
    }
  }, [repText]);

  useEffect(() => {
    if (apiCallingStart && !endMeetingResponseType) {
      handleRecordingStart().then(() => {
        sendTranscriptToBackend(meetingIdRef.current);
      });
    } else if (
      apiCallingStart &&
      endMeetingResponseType === "create_asana_tasks"
    ) {
      handleCreateAsanaTask().then(() => {
        console.log("asana task created successfully");
      });
    }
  }, [apiCallingStart, endMeetingResponseType]);

  async function handleRecordingStart() {
    const { id } = await addAndGetMeetingInfo();
    meetingIdRef.current = id;
  }

  async function sendTranscriptToBackend(meeting_id: number) {
    try {
      if (!meeting_id) throw new Error("meetingId required");

      const postData = {
        meetingId: meeting_id,
      };

      // Make the POST request using Axios
      const response = await axios.post(
        "http://localhost:3000/api/ai/assistant",
        postData,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      const { data, type } = response.data;

      if (type === "create_asana_tasks" && data) {
        setEndMeetingResponseType(type);
        setAsanaTask(data);
      } else if (type === "send_summary_to_slack") {
        setEndMeetingResponseType(type);
        setSummarySlack(data);
      }
    } catch (error) {
      toast.error(error.message);
      console.error("Error Failed Sending Transcript:", error);
    } finally {
      setRepText("");
    }
  }

  const handleCheckboxChange = (task: string) => {
    setSelectedTasks((prevSelectedTasks) =>
      prevSelectedTasks.includes(task)
        ? prevSelectedTasks.filter((t) => t !== task)
        : [...prevSelectedTasks, task]
    );
  };

  const handleCreateAsanaTask = async () => {
    try {
      if (!meetingIdRef.current) throw new Error("meetingId required");
      if (!asanaTask || asanaTask.length === 0) {
        toast.error("Tasks and MeetingId are required");
        throw new Error("task required and meetingId required");
      }

      const postData = {
        meetingId: meetingIdRef.current,
        tasks: asanaTask,
      };

      // Make the POST request using Axios
      const response = await axios.post(
        "http://localhost:3000/api/asana",
        postData,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }
      toast.success("Successfully Created Task");
    } catch (error) {
      toast.error("Failed");
      console.error("Error Failed Create Asana API", error);
    } 
  };

  const handleSendSlackSummary = async () => {
    try {
      setLoading(true);
      if (!meetingIdRef.current) {
        throw new Error("meetingId required");
      }
      if (!slackSummary) {
        throw new Error("slack summary required");
      }
      const postData = {
        meetingId: meetingIdRef.current,
        transcription: selectedTasks,
      };

      // Make the POST request using Axios
      const response = await axios.post(
        "http://localhost:3000/api/slack",
        postData,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      toast.success("Successfully send message to slack");
    } catch (error) {
      toast.error("Failed");
      console.error("Error Failed Send Slack Summary", error);
    } finally {
      setLoading(false);
    }
  };

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
        {!!repText.length && <span>{repText}</span>}
        <div className="flex flex-col gap-1 ml-2 mt-2">
          {endMeetingResponseType === "create_asana_tasks" &&
            asanaTask &&
            asanaTask.map((task, index) => (
              <div className="flex gap-2 p-1" key={index}>
                {/* <input
                  type="checkbox"
                  value={task}
                  checked={selectedTasks.includes(task)}
                  onChange={() => handleCheckboxChange(task)}
                  className="text-black  rounded"
                /> */}
                <span>{index + 1}</span>
                <p className="text-sm text-start font-medium text-gray-900">
                  {task}
                </p>
              </div>
            ))}
          {/* {endMeetingResponseType === "create_asana_tasks" && (
            <button
              onClick={handleCreateAsanaTask}
              className="m-2 px-2 py-2 flex justify-center bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? <Loader /> : "Create Asana Task"}
            </button>
          )} */}
        </div>
        <div className="flex flex-col gap-1 ml-2 mt-2">
          {endMeetingResponseType === "send_summary_to_slack" &&
            slackSummary && (
              <p className="text-sm text-start font-medium text-gray-900">
                {slackSummary}
              </p>
            )}
          {endMeetingResponseType === "send_summary_to_slack" && (
            <button
              onClick={handleSendSlackSummary}
              className="m-2 px-2 py-2 flex justify-center bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? <Loader /> : "Send Slack Summary"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Loader = () => {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default JarvisScreen;
