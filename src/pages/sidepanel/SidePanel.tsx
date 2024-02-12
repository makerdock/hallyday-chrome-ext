// import React from "react";
// import logo from "@assets/img/logo.svg";
// import "@pages/sidepanel/SidePanel.css";
// import useStorage from "@src/shared/hooks/useStorage";
// import exampleThemeStorage from "@src/shared/storages/exampleThemeStorage";
// import withSuspense from "@src/shared/hoc/withSuspense";
// import withErrorBoundary from "@src/shared/hoc/withErrorBoundary";

import { useEffect, useState } from "react";

const SidePanel = () => {
  // const theme = useStorage(exampleThemeStorage);

  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    console.log("=> msgs: ", msgs);
  }, [msgs]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      console.log("request.message.data: ", request.message.data);

      switch (request.message.type) {
        case "CLIENT_TRANSCRIPT":
          // updateSidePanel("</br>[CLIENT]--> " + request.message.data);
          setMsgs((prev) => [...prev, "[CLIENT]--> " + request.message.data]);
          break;

        case "REP_TRANSCRIPT":
          // updateSidePanel("</br>[REP]--> " + request.message.data);
          setMsgs((prev) => [...prev, "[REP]--> " + request.message.data]);
          break;
      }
    });
  }, []);

  return (
    <div>
      {msgs.map((msg, index) => {
        return <p key={index}>{msg}</p>;
      })}
    </div>
  );
};

export default SidePanel;
