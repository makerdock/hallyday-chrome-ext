import { useEffect, useRef, useState } from "react";
import { RecordingStates } from "../../../utils/recordingState";
import { SpeakerType } from "../../../utils/speakerType";
import { Message, areTokensSet, isSameTab } from "../../../utils/recorderUtils";
import PlaybookDropdown from "./PlaybookDropdown";
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
import ActiveMeetingTab from "./ActiveMeetingTab";

const SidePanel = () => {
  const [isMeetingActive, setMeetingActive] = useState<boolean>(true);

  if (isMeetingActive) {
    return (
      <div>
        <PlaybookDropdown />
        <ActiveMeetingTab />
        <div className="max-w-full w-full fixed bottom-0 p-2">
          <button
            onClick={() => setMeetingActive(false)}
            className="bg-red-500 text-white py-2 rounded-lg w-full"
          >
            End meeting
          </button>
        </div>
      </div>
    );
  } else {
    return <JarvisScreen />;
  }
};

export default SidePanel;
