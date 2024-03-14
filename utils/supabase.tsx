// supabase.ts
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { MeetingUrl, Message, getMeetingUrl } from "./recorderUtils";

export const SUPABASE_URL = "https://fhkdrjttwyipealchxne.supabase.co"; // Replace with your Supabase URL
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa2RyanR0d3lpcGVhbGNoeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwODgyNDIsImV4cCI6MjAyMzY2NDI0Mn0.YMSvBR5BXRV1lfXI5j_z-Gd6v0cZNojONjf3YHTiHNY"; // Replace with your Supabase ANON key

export const supabaseGlobal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function addTranscription(message: Message) {
  console.log("[addtranscription] message: ", message);

  const { message_text, speaker_type, ai_insight, meeting_id } = message;

  const { data, error } = await supabaseGlobal.from("transcription").upsert([
    {
      message_text,
      speaker_type,
      meeting_id,
      ai_insight,
    },
  ]);

  console.log("[addtranscription] data: ", data);
  console.log("[addtranscription] error: ", error);
}

export async function addAndGetMeetingInfo() {
  console.log("Inside updateMeetingInfo, ");

  const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

  console.log("==> Meeting Url: ", cur_meeting_url);

  const { data, error } = await supabaseGlobal
    .from("meeting")
    .upsert([
      {
        meeting_url: cur_meeting_url,
      },
    ])
    .select("id")
    .single();

  console.log("#### [UPSERT] Data: ", data);
  // console.log("[UPSERT] Error: ", error);

  if (!error) return data;
}

export async function getTranscript() {
  const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

  console.log("==> Meeting Url: ", cur_meeting_url);

  const { data, error } = await supabaseGlobal
    .from("meeting")
    .select("transcription")
    .eq("meeting_url", cur_meeting_url)
    .single();

  const { transcription } = data;
  return transcription;
}

export async function _getTranscript(meeting_id: number) {
  const { data, error } = await supabaseGlobal
    .from("transcription")
    .select()
    .eq("meeting_id", meeting_id)
    .order("created_at");

  console.log("[_getTranscript] data: ", data);
  return data;
}

export async function updateEndTime() {
  const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

  console.log("cur_meeting_url: ", cur_meeting_url);

  if (!cur_meeting_url) return;

  const { data, error } = await supabaseGlobal
    .from("meeting")
    .select("start_time")
    .eq("meeting_url", cur_meeting_url)
    .single();

  console.log("[handleEndMeeting] data: ", data);

  console.log("[handleEndMeeting] error: ", error);

  const start_time = data?.start_time || new Date().toISOString();
  const start_time_date: Date = new Date(start_time);
  const end_time: Date = new Date();
  const duration_in_sec =
    (end_time.getTime() - start_time_date.getTime()) / 1000;

  console.log("duration_in_sec: ", duration_in_sec);

  const { data: upsertData } = await supabaseGlobal.from("meeting").upsert([
    {
      meeting_url: cur_meeting_url,
      duration: 9999.99,
    },
  ]);
}

export async function updateTranscription(transcription) {
  const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

  console.log("cur_meeting_url: ", cur_meeting_url);

  const { data, error } = await supabaseGlobal.from("meeting").upsert([
    {
      meeting_url: cur_meeting_url,
      transcription,
    },
  ]);
}
