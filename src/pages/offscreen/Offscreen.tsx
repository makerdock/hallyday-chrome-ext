const Offscreen = () => {
  /**
   * MediaRecorder instance for audio recording.
   * @type {MediaRecorder}
   */
  let client_mediaRecorder;
  let rep_mediaRecorder;
  const data = [];

  let old_transcript = "";
  let client_socket;
  let rep_socket;
  const apiKey = "bd7d01faf4086045f8f1e7ff4f0c06983d608352";

  let source: MediaStreamAudioSourceNode;
  let audioCtx: AudioContext;
  let media: MediaStream;

  /**
   * Event listener for messages from the extension.
   * @param {Object} request - The message request.
   * @param {Object} sender - The sender of the message.
   * @param {function} sendResponse - Callback function to send a response.
   * @returns {boolean} - Indicates whether the response should be asynchronous.
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log("[OFFSCREEN] MSG LISTENER: ", request);

    if (request.message.target !== "offscreen") {
      return;
    }

    switch (request.message.type) {
      case "START_OFFSCREEN_RECORDING":
        // Start recording
        handleRecording(request.message.data);
        sendResponse({});
        break;
      case "STOP_OFFSCREEN_RECORDING":
        // Stop recording
        stopRecording();
        sendResponse({});
        break;
      case "CHECK_PERMISSIONS":
        console.log("<--- Inside offscreen -->");

        checkAudioPermissions()
          .then((data) => sendResponse(data))
          .catch((errorData) => sendResponse(errorData));
        break;
      case "TRANSCRIPTION_USER_INPUT":
        handleTranscription(request.message.data);
        sendResponse({});
        break;
      default:
        break;
    }

    return true;
  });

  /**
   * Stops the recording if the MediaRecorder is in the recording state.
   */
  function stopRecording() {
    if (
      client_mediaRecorder &&
      client_mediaRecorder.state === "recording" &&
      rep_mediaRecorder &&
      rep_mediaRecorder.state === "recording"
    ) {
      console.log("Stopped recording in offscreen...");
      // handleStopRecording();
      client_mediaRecorder.stop();
      rep_mediaRecorder.stop();

      source.disconnect(audioCtx.destination);
      audioCtx.close();
      media.getAudioTracks()[0].stop();
    }
  }

  async function handleRecording(streamId) {
    getAudioInputDevices().then((audioInputDevices) => {
      const deviceId = audioInputDevices[0].deviceId;

      console.log("DEVICE ID: ", deviceId);

      navigator.mediaDevices
        .getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
          },
        })
        .then(async (audioStream) => {
          console.log("AUDIO STREAM: ", audioStream);

          try {
            console.log("--------> Befre getUserMedia <--------", streamId);

            media = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "tab",
                  chromeMediaSourceId: streamId,
                },
              },
            });

            console.log("MEDIA: ", media);

            // Continue to play the captured audio to the user.
            audioCtx = new AudioContext();
            source = audioCtx.createMediaStreamSource(media);
            source.connect(audioCtx.destination);

            console.log("audioStream.getTracks(): ", audioStream.getTracks());

            // const combinedStream = mix(output, [media, audioStream]);

            client_mediaRecorder = new MediaRecorder(media, {
              mimeType: "video/webm",
            });

            rep_mediaRecorder = new MediaRecorder(audioStream, {
              mimeType: "video/webm",
            });

            client_socket = new WebSocket(
              "wss://api.deepgram.com/v1/listen?model=nova-2-meeting",
              ["token", apiKey]
            );

            rep_socket = new WebSocket(
              "wss://api.deepgram.com/v1/listen?model=nova-2-meeting",
              ["token", apiKey]
            );

            client_socket.onopen = () => {
              client_mediaRecorder.start(1000);
            };

            rep_socket.onopen = () => {
              rep_mediaRecorder.start(1000);
            };

            client_socket.onmessage = async (msg) => {
              let msgData;
              try {
                msgData = JSON.parse(msg.data);
              } catch {}

              if (msgData.type !== "Results") return;

              console.log("msgData: ", msgData);

              const { transcript } = msgData?.channel.alternatives[0] || {};
              console.log(
                "🚀 ~ client_socket.onmessage= ~ msgData?.channel.alternatives:",
                msgData?.channel.alternatives
              );

              if (transcript) {
                //sending Current transcript
                chrome.runtime.sendMessage({
                  message: {
                    type: "CLIENT_TRANSCRIPT_CURRENT",
                    target: "sidepanel",
                    data: transcript,
                  },
                });
                console.log("---> old_transcript: ", old_transcript);
                console.log(
                  "\x1b[31m[CLIENT] transcript ->",
                  transcript,
                  "\x1b"
                );

                old_transcript = old_transcript
                  ? old_transcript + " " + transcript
                  : transcript;

                console.log(
                  "\x1b[31m[RESOLVED CLIENT] transcript ->",
                  old_transcript,
                  "\x1b"
                );

                // get the last 100 words from the old_transcript
                const transcriptionWithThreshold = old_transcript
                  ?.split(" ")
                  .slice(-50)
                  .join(" ");

                console.log(
                  "🚀 ~ client_socket.onmessage= ~ transcriptionWithThreshold:",
                  transcriptionWithThreshold
                );

                chrome.runtime.sendMessage({
                  message: {
                    type: "CLIENT_TRANSCRIPT",
                    target: "sidepanel",
                    data: transcriptionWithThreshold,
                  },
                });

                handleTranscription(transcriptionWithThreshold);
              }
            };

            rep_socket.onmessage = (msg) => {
              if (JSON.parse(msg.data).type !== "Results") return;

              const { transcript } = JSON.parse(msg.data).channel
                .alternatives[0];
              if (transcript) {
                console.log("\x1b[32m[REP] transcript ->", transcript, "\x1b");

                chrome.runtime.sendMessage({
                  message: {
                    type: "REP_TRANSCRIPT",
                    target: "sidepanel",
                    data: {
                      message_text: transcript,
                    },
                  },
                });
              }
            };

            const client_data = [];
            const rep_data = [];

            client_mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && client_socket.readyState == 1) {
                // client_socket.send(event.data);
                client_data.push(event.data);

                console.log("[on data] event.data: ", event.data);
              }
            };

            // https://stackoverflow.com/a/51355276
            setInterval(() => {
              if (client_data.length > 0) {
                console.log("<-- SENDING DATA -->");
                client_socket.send(
                  new Blob(client_data.splice(0, client_data.length))
                );
              }

              if (rep_data.length > 0) {
                console.log("<-- SENDING DATA -->");
                rep_socket.send(new Blob(rep_data.splice(0, rep_data.length)));
              }
            }, 5000);

            rep_mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && rep_socket.readyState == 1)
                // rep_socket.send(event.data);
                rep_data.push(event.data);
            };

            console.log("Started recording in offscreen...");
          } catch (error) {
            console.error(
              "Unable to initiate MediaRecorder and/or streams",
              error
            );
          }
        });
    });
  }

  async function handleTranscription(transcription) {
    let data;
    try {
      const response = await fetch("http://localhost:3000/api/ai/reply", {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          transcription,
        }),
      });

      data = await response.json();
    } catch (error) {
      console.error(error);
    }

    if (data?.error) {
      chrome.runtime.sendMessage({
        message: {
          type: "CLIENT_TRANSCRIPT_CONTEXT",
          target: "sidepanel",
          data: {
            ai_insight: "",
            user_request_content: "",
            message_text: data.transcription,
          },
        },
      });
      return;
    }

    chrome.runtime.sendMessage({
      message: {
        type: "CLIENT_TRANSCRIPT_CONTEXT",
        target: "sidepanel",
        data: {
          ai_insight:
            data?.aiResponseContent === "" ? "" : data?.aiResponseContent,
          user_request_content:
            data.userRequestContent === "" ? "" : data.userRequestContent,
          message_text: data.transcription,
        },
      },
    });

    if (data.aiResponseContent !== "") {
      old_transcript = "";
    } else {
      // old_transcript = old_transcript + " " + transcription;
      console.log(
        "\x1b[33m[OLD TRANSCRIPT] transcript ->",
        old_transcript,
        "\x1b"
      );
    }

    // if (
    //   data.aiResponseContent &&
    //   data.aiResponseContent.length > 0 &&
    //   data.aiResponseContent !== '""'
    // ) {
    //   chrome.runtime.sendMessage({
    //     message: {
    //       type: "CLIENT_TRANSCRIPT_CONTEXT",
    //       target: "sidepanel",
    //       data: {
    //         ai_insight: data.aiResponseContent,
    //         user_request_content: data.userRequestContent,
    //         message_text: transcription,
    //       },
    //     },
    //   });

    //   // Reset the old data
    //   old_transcript = "";
    // } else {
    //   // Set the old transcript so that it can be appended with the next api call
    //   // old_transcript = old_transcript + " " + transcript;

    //   console.log(
    //     "\x1b[33m[OLD TRANSCRIPT] transcript ->",
    //     old_transcript,
    //     "\x1b"
    //   );

    //   chrome.runtime.sendMessage({
    //     message: {
    //       type: "CLIENT_TRANSCRIPT_CONTEXT",
    //       target: "sidepanel",
    //       data: {
    //         ai_insight:
    //           data?.aiResponseContent === "" ? "" : data?.aiResponseContent,
    //         user_request_content:
    //           data.userRequestContent === "" ? "" : data.userRequestContent,
    //         message_text: data.transcription,
    //       },
    //     },
    //   });
    // }
  }

  // https://github.com/deepgram-devs/transcription-chrome-extension/blob/37d34f4b0b2a38ef10ced0f9c02d794dae961407/mic-and-tab/content-script.js#L47

  /**
   * Fetches audio input devices using the `navigator.mediaDevices.enumerateDevices` API.
   * @returns {Promise<Object[]>} - Promise that resolves to an array of audio input devices.
   */
  function getAudioInputDevices() {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          // Filter the devices to include only audio input devices
          const audioInputDevices = devices.filter(
            (device) => device.kind === "audioinput"
          );
          resolve(audioInputDevices);
        })
        .catch((error) => {
          console.log("Error getting audio input devices", error);
          reject(error);
        });
    });
  }

  /**
   * Checks microphone permissions using the `navigator.permissions.query` API.
   * @returns {Promise<Object>} - Promise that resolves to an object containing permission status.
   */
  function checkAudioPermissions() {
    console.log("--> INside checkAudioPermissions");

    return new Promise((resolve, reject) => {
      navigator.permissions
        .query({ name: "microphone" })
        .then((result) => {
          if (result.state === "granted") {
            console.log("Mic permissions granted");
            resolve({ message: { status: "success" } });
          } else {
            console.log("Mic permissions missing", result.state);
            reject({
              message: { status: "error", data: result.state },
            });
          }
        })
        .catch((error) => {
          console.warn("Permissions error", error);
          reject({
            message: { status: "error", data: { error: error } },
          });
        });
    });
  }

  return <></>;
};

export default Offscreen;
