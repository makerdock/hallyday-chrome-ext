import { useEffect, useState } from "react";

const SidePanel = () => {
  const [msgs, setMsgs] = useState([
    "- The customer wants to know: What does KPI mean?",
    "-The customer wants to know: Why the pricing looks so high.",
  ]);

  useEffect(() => {
    console.log("=> msgs: ", msgs);
  }, [msgs]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request.message.data: ", request.message.data);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT_CONTEXT":
          setMsgs((prev) => [...prev, request.message.data]);
          break;
      }
    });
  }, []);

  return (
    <div className="h-full pb-8">
      <h2 className="p-4 bg-gray-300">Hallyday AI</h2>
      <div className="overflow-auto h-full p-4">
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
  );
};

export default SidePanel;
