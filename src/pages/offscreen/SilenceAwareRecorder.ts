export type OnVolumeChange = (volume: number) => void;
export type OnDataAvailable = (data: Blob) => void | undefined;

export interface SilenceAwareRecorderOptions {
  deviceId?: string;
  minDecibels?: number;
  onDataAvailable?: OnDataAvailable;

  onVolumeChange?: OnVolumeChange;
  setDeviceId?: (deviceId: string) => void;

  silenceDuration?: number;

  silentThreshold?: number;
}

class SilenceAwareRecorder {
  private audioContext: AudioContext | null;

  private mediaStreamSource: MediaStreamAudioSourceNode | null;

  private analyser: AnalyserNode | null;

  private mediaRecorder: MediaRecorder | null;

  private silenceTimeout: ReturnType<typeof setTimeout> | null;

  private readonly silenceThreshold: number;

  private readonly silenceDuration: number;

  private readonly minDecibels: number;

  private readonly onVolumeChange?: OnVolumeChange;

  private readonly onDataAvailable?: OnDataAvailable;

  private isSilence: boolean;

  private hasSoundStarted: boolean;

  public deviceId: string | null;

  public isRecording: boolean;

  public interval = null;

  constructor({
    onVolumeChange,
    onDataAvailable,
    silenceDuration = 2500,
    silentThreshold = -50,
    minDecibels = -100,
    deviceId = "default",
  }: SilenceAwareRecorderOptions) {
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.silenceTimeout = null;
    this.silenceThreshold = silentThreshold;
    this.silenceDuration = silenceDuration;
    this.minDecibels = minDecibels;
    this.onVolumeChange = onVolumeChange;
    this.onDataAvailable = onDataAvailable;
    this.isSilence = false;
    this.hasSoundStarted = false;
    this.deviceId = deviceId;
    this.isRecording = false;
  }

  async startRecording(): Promise<void> {
    console.log("[SAR] inside start recording...");

    if (this.isRecording) {
      return;
    }

    try {
      const stream = await this.getAudioStream();
      this.setupAudioContext(stream);
      this.setupMediaRecorder(stream);
      this.isRecording = true;
      this.checkForSilence();
    } catch (err) {
      console.error("Error getting audio stream:", err);
    }
  }

  private async getAudioStream(): Promise<MediaStream> {
    // eslint-disable-next-line no-undef
    const constraints: MediaStreamConstraints = {
      audio: this.deviceId ? { deviceId: { exact: this.deviceId } } : true,
      video: false,
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private setupAudioContext(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.minDecibels = this.minDecibels;
    this.mediaStreamSource.connect(this.analyser);
  }

  private setupMediaRecorder(stream: MediaStream): void {
    console.log("[SAR] inside setupMediaRecorder...");

    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (event) => {
      console.log(
        "@@@@@@@@@@@@@ [SAR] on data available....",
        event.data,
        this.hasSoundStarted
      );
      if (event.data.size > 0 && this.hasSoundStarted) {
        this.onDataAvailable?.(event.data);
      }
    };

    this.mediaRecorder.start(1000);

    console.log("[SAR] after recorder start...", this.mediaRecorder);
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices;
  }

  setDevice(deviceId: string): void {
    if (this.deviceId !== deviceId) {
      this.deviceId = deviceId;
      if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
        // If the recording is running, stop it before switching devices
        this.stopRecording();
      }
    }
  }

  stopRecording(): void {
    if (!this.isRecording) {
      return;
    }

    if (
      this.mediaRecorder &&
      this.hasSoundStarted &&
      this.mediaRecorder.state === "recording"
    ) {
      this.mediaRecorder.requestData();
      setTimeout(() => {
        this.cleanUp();
      }, 100); // adjust this delay as necessary
    } else {
      this.cleanUp();
    }

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private cleanUp(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder?.stop();
    }
    this.mediaRecorder?.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close();
    this.hasSoundStarted = false;
    this.isRecording = false;
  }

  private checkForSilence(): void {
    if (!this.mediaRecorder) {
      throw new Error("MediaRecorder is not available");
    }

    if (!this.analyser) {
      throw new Error("Analyser is not available");
    }

    const bufferLength = this.analyser.fftSize;
    const amplitudeArray = new Float32Array(bufferLength || 0);
    this.analyser.getFloatTimeDomainData(amplitudeArray);

    const volume = this.computeVolume(amplitudeArray);

    this.onVolumeChange?.(volume);

    console.log(
      "\x1b[35m-------> [SAR] check for silence: ",
      volume,
      this.silenceThreshold,
      this.mediaRecorder.state,
      "\x1b"
    );

    // console.log(
    //   "-------> [SAR] check for silence: ",
    //   volume,
    //   this.silenceThreshold,
    //   this.mediaRecorder.state
    // );

    if (volume < this.silenceThreshold) {
      console.log("\x1b[36m[SAR] volume < this.silenceThreshold....", "\x1b");

      // console.log("++++ [SAR] volume < this.silenceThreshold....");

      if (!this.silenceTimeout && this.mediaRecorder.state !== "inactive") {
        console.log("[SAR] creating timeout");

        this.silenceTimeout = setTimeout(() => {
          console.log("[SAR] timout reached...");

          this.mediaRecorder?.stop();
          this.isSilence = true;
          this.silenceTimeout = null;

          if (this.interval) return;

          this.interval = setInterval(() => {
            console.log("[SAR] setInterval...");

            this.checkForSilence();
          }, 2000);
        }, this.silenceDuration);
      }
    } else {
      // console.log("---- [SAR] volume cond false....");
      console.log("\x1b[31m[SAR] volume cond false....", "\x1b");

      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      if (this.isSilence && this.mediaRecorder.state !== "recording") {
        this.mediaRecorder.start();
        this.isSilence = false;
        this.interval = null;
        clearInterval(this.interval);
      }
      if (!this.hasSoundStarted) {
        this.hasSoundStarted = true;
      }
    }

    // console.log("[SAR] this.interval 1: ", this.interval);
    // console.log("[SAR] this.interval 2: ", this.interval !== null);

    // if (this.interval) return;

    // this.interval = setInterval(() => {
    //   console.log("[SAR] setInterval...");

    //   this.checkForSilence();
    // }, 2000);
  }

  private computeVolume(amplitudeArray: Float32Array): number {
    const values = amplitudeArray.reduce(
      (sum, value) => sum + value * value,
      0
    );
    const average = Math.sqrt(values / amplitudeArray.length); // calculate rms
    const volume = 20 * Math.log10(average); // convert to dB
    return volume;
  }
}

export default SilenceAwareRecorder;
