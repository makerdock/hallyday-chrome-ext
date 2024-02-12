const Offscreen = () => {
  /**
   * MediaRecorder instance for audio recording.
   * @type {MediaRecorder}
   */
  let client_mediaRecorder;
  let rep_mediaRecorder;
  let data = [];

  let client_socket;
  let rep_socket;
  const apiKey = "bd7d01faf4086045f8f1e7ff4f0c06983d608352";

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
    }
  }

  async function handleRecording(streamId) {
    // chrome.runtime.sendMessage({
    //   message: {
    //     type: "SHOW_SIDEPANEL",
    //     target: "background",
    //   },
    // });

    getAudioInputDevices().then((audioInputDevices) => {
      const deviceId = audioInputDevices[0].deviceId;

      console.log("DEVICE ID: ", deviceId);

      // navigator.mediaDevices.enumerateDevices().then((devices) => {
      //   // Filter the devices to include only audio input devices
      //   // const audioInputDevices = devices.filter(
      //   //   (device) => device.kind === "audioinput"
      //   // );

      //   devices.forEach((device) => {
      //     console.log("--> device: ", device);
      //   });
      // });

      navigator.mediaDevices
        .getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
          },
        })
        .then(async (audioStream) => {
          console.log("AUDIO STREAM: ", audioStream);

          try {
            const media = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "tab",
                  chromeMediaSourceId: streamId,
                },
              },
            });

            console.log("MEDIA: ", media);

            // Continue to play the captured audio to the user.
            const output = new AudioContext();
            const source = output.createMediaStreamSource(media);
            source.connect(output.destination);

            console.log("audioStream.getTracks(): ", audioStream.getTracks());

            // const combinedStream = mix(output, [media, audioStream]);

            client_mediaRecorder = new MediaRecorder(audioStream, {
              mimeType: "video/webm",
            });

            rep_mediaRecorder = new MediaRecorder(media, {
              mimeType: "video/webm",
            });

            client_socket = new WebSocket(
              "wss://api.deepgram.com/v1/listen?model=general-enhanced",
              ["token", apiKey]
            );

            rep_socket = new WebSocket(
              "wss://api.deepgram.com/v1/listen?model=general-enhanced",
              ["token", apiKey]
            );

            client_socket.onopen = () => {
              client_mediaRecorder.start(250);
            };

            rep_socket.onopen = () => {
              rep_mediaRecorder.start(250);
            };

            client_socket.onmessage = (msg) => {
              const { transcript } = JSON.parse(msg.data).channel
                .alternatives[0];
              if (transcript) {
                console.log(
                  "\x1b[31m[CLIENT] transcript ->",
                  transcript,
                  "\x1b"
                );

                chrome.runtime.sendMessage({
                  message: {
                    type: "CLIENT_TRANSCRIPT",
                    target: "sidepanel",
                    data: transcript,
                  },
                });
              }
            };

            rep_socket.onmessage = (msg) => {
              const { transcript } = JSON.parse(msg.data).channel
                .alternatives[0];
              if (transcript) {
                console.log("\x1b[32m[REP] transcript ->", transcript, "\x1b");

                chrome.runtime.sendMessage({
                  message: {
                    type: "REP_TRANSCRIPT",
                    target: "sidepanel",
                    data: transcript,
                  },
                });
              }
            };

            client_mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && client_socket.readyState == 1)
                client_socket.send(event.data);
            };

            rep_mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && rep_socket.readyState == 1)
                rep_socket.send(event.data);
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

  // https://github.com/deepgram-devs/transcription-chrome-extension/blob/37d34f4b0b2a38ef10ced0f9c02d794dae961407/mic-and-tab/content-script.js#L47

  // https://stackoverflow.com/a/47071576
  function mix(audioContext, streams) {
    const dest = audioContext.createMediaStreamDestination();
    streams.forEach((stream) => {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(dest);
    });
    return dest.stream;
  }

  /**
   * Saves audio chunks captured by MediaRecorder.
   * @param {Blob[]} chunkData - Array of audio chunks in Blob format.
   */
  function saveAudioChunks(chunkData) {
    console.log("Chunk captured from MediaRecorder");
    // Manage audio chunks accordingly as per your needs
    data.push(chunkData);
  }

  /**
   * Event handler for when MediaRecorder is stopped.
   */
  function handleStopRecording() {
    // Handle cases when MediaRecorder is stopped if needed
    console.log("<--- Inside handleStopRecording --->", data);

    const blob = new Blob(data, { type: "video/webm" });
    window.open(URL.createObjectURL(blob), "_blank");

    data = [];
  }

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
