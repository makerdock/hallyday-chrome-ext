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
  getCurrentUser,
} from "../../../utils/supabase";
import JarvisScreen from "./JarvisScreen";
import ActiveMeetingTab from "./ActiveMeetingTab";

const SidePanel = () => {
  const [isMeetingActive, setMeetingActive] = useState<boolean>(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    handleTokens();
  }, []);

  async function handleTokens() {
    const userFound = await getCurrentUser();
    const isSet = await areTokensSet();
    if (isSet && userFound) setLoggedIn(true);
  }

  if (isMeetingActive) {
    return (
      <div>
        {loggedIn ? <PlaybookDropdown /> : null}
        <ActiveMeetingTab />
        <div className="max-w-full w-full fixed bottom-0 p-2">
          {loggedIn ? (
            <button
              onClick={() => setMeetingActive(false)}
              className="bg-red-500 text-white py-2 rounded-lg w-full"
            >
              End meeting
            </button>
          ) : null}
        </div>
      </div>
    );
  } else {
    return <JarvisScreen />;
  }
};

export default SidePanel;
