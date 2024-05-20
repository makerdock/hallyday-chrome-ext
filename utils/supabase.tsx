// supabase.ts
import { SupabaseClient, User, createClient } from "@supabase/supabase-js";
import { MeetingUrl, Message, getMeetingUrl } from "./recorderUtils";
import axios from "axios";
import { SpeakerType } from "./speakerType";

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
  try {
    console.log("Inside updateMeetingInfo, ");

    const { cur_meeting_url } = (await getMeetingUrl()) as MeetingUrl;

    console.log("==> Meeting Url: ", cur_meeting_url);

    const currentUser = await getCurrentUser();
    console.log(
      "currentUser----------------------------------------------------------------",
      currentUser
    );
    // if (!user || !accessToken) {
    //   throw new Error("Access token or user is not found");
    // }
    const { data: teamProfilesData, error: teamProfilesError } =
      await supabaseGlobal
        .from("team_profiles")
        .select("*,teams(*)")
        .eq("profile_id", currentUser.id);
    if (teamProfilesError)
      throw new Error("Error while fetching team profiles");

    if (!teamProfilesData[0].teams.id) {
      throw new Error("Team Id not found");
    }

    const { data, error } = await supabaseGlobal
      .from("meeting")
      .upsert([
        {
          meeting_url: cur_meeting_url,
          team: teamProfilesData[0].teams.id,
        },
      ])
      .select("id")
      .single();
    if (error) {
      throw new Error("Error while updating meeting");
    }

    console.log("#### [UPSERT] Data: ", data);
    // console.log("[UPSERT] Error: ", error);

    if (!error) return data;
  } catch (error) {
    console.error(error);
  }
}

export async function getClientTranscript(meeting_id: number) {
  const { data, error } = await supabaseGlobal
    .from("transcription")
    .select()
    .eq("meeting_id", meeting_id)
    .eq("speaker_type", SpeakerType.CLIENT)
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
      duration: duration_in_sec,
    },
  ]);
}

export async function getCurrentUser(): Promise<null | User> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["accessToken", "refreshToken"],
      async (result) => {
        const authAccessToken = result["accessToken"];
        const authRefreshToken = result["refreshToken"];
        console.log("authAccessToken", authAccessToken);
        console.log("authRefreshToken", authRefreshToken);
        if (authRefreshToken && authAccessToken) {
          try {
            // set user session from access_token and refresh_token
            const resp = await supabaseGlobal.auth.setSession({
              access_token: authAccessToken,
              refresh_token: authRefreshToken,
            });
            const user = resp.data?.user;
            if (user) {
              resolve(user);
            } else {
              resolve(null);
            }
          } catch (e: any) {
            console.error("Error while getting current user", e);
            reject(e);
          }
        } else {
          resolve(null);
        }
      }
    );
  });
}

export async function getCurrentUserTeamId() {
  try {
    const currentUser = await getCurrentUser();
    const { data: teamProfilesData, error: teamProfilesError } =
      await supabaseGlobal
        .from("team_profiles")
        .select("*,teams(*)")
        .eq("profile_id", currentUser.id);
    if (teamProfilesError) {
      throw new Error("Error while fetching team profiles");
    }

    if (!teamProfilesData[0].teams.id) {
      throw new Error("Team Id not found");
    }
    return teamProfilesData[0].teams.id;
  } catch (error) {
    return null;
    console.error("Error while getting current user team id", error);
  }
}
