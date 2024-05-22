// supabase.ts
import { SupabaseClient, User, createClient } from "@supabase/supabase-js";
import {
  MeetingUrl,
  Message,
  areTokensSet,
  getMeetingUrl,
  getUserInfo,
  storeTokens,
} from "./recorderUtils";
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

    const currentTeamId = await getCurrentUserTeamId();
    if (!currentTeamId) {
      throw new Error("Team Id not found");
    }

    // console.log("User from getUserInfo: ", user);
    // // const currentUser = await getCurrentUser();
    // const { data: teamProfilesData, error: teamProfilesError } =
    //   await supabaseGlobal
    //     .from("team_profiles")
    //     .select("*,teams(*)")
    //     .eq("profile_id", user?.user?.id);
    // if (teamProfilesError)
    //   throw new Error("Error while fetching team profiles");

    // if (!teamProfilesData[0].teams.id) {
    //   throw new Error("Team Id not found");
    // }

    const { data, error } = await supabaseGlobal
      .from("meeting")
      .upsert([
        {
          meeting_url: cur_meeting_url,
          team: currentTeamId,
        },
      ])
      .select("id")
      .single();
    if (error) {
      throw new Error("Error while updating meeting: " + error.message);
    }

    console.log("#### [UPSERT] Data: ", data);
    return data;

    if (!error) return data;
  } catch (error) {
    console.error("Error in addAndGetMeetingInfo: ", error);
    return null;
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

//get current user Team Id
export async function getCurrentUserTeamId(): Promise<string | null> {
  try {
    const user = await getUserInfo();
    console.log("[Current User]", user);

    if (!user || !user.id) {
      throw new Error("User does not exist or is not authenticated");
    }

    const { data: teamProfilesData, error: teamProfilesError } =
      await supabaseGlobal
        .from("team_profiles")
        .select("*, teams(id)")
        .eq("profile_id", user.id);

    if (teamProfilesError) {
      throw new Error(
        "Error while fetching team profiles: " + teamProfilesError.message
      );
    }

    if (
      !teamProfilesData ||
      teamProfilesData.length === 0 ||
      !teamProfilesData[0].teams.id
    ) {
      throw new Error("Team ID not found for the user");
    }

    const teamId = teamProfilesData[0].teams.id;
    console.log("[Current User TeamId]", teamId);
    return teamId;
  } catch (error) {
    console.error("Error while getting current user team ID", error);
    return null;
  }
}

// session Refresh
export async function refreshTokens(refreshToken: string) {
  try {
    const { data, error } = await supabaseGlobal.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      const { access_token, refresh_token, expires_in } = data.session;
      const expiryTime = Date.now() + expires_in * 1000;

      storeTokens(access_token, refresh_token, expiryTime);

      return true;
    } else {
      throw new Error("Session refresh failed");
    }
  } catch (error) {
    console.error("Error refreshing Sessions: ", error);
    return false;
  }
}

// fetch Current User
export async function fetchUserInfo(accessToken: string) {
  try {
    const { data, error } = await supabaseGlobal.auth.getUser(accessToken);
    if (error) {
      throw error;
    }

    return data.user;
  } catch (error) {
    console.error("Error fetching user information: ", error);
    throw error;
  }
}

// export async function getCurrentUser(): Promise<null | User> {
//   return new Promise((resolve, reject) => {
//     chrome.storage.local.get(
//       ["accessToken", "refreshToken"],
//       async (result) => {
//         const authAccessToken = result["accessToken"];
//         const authRefreshToken = result["refreshToken"];
//         console.log("authAccessToken", authAccessToken);
//         console.log("authRefreshToken", authRefreshToken);
//         if (authRefreshToken && authAccessToken) {
//           try {
//             // set user session from access_token and refresh_token
//             const resp = await supabaseGlobal.auth.setSession({
//               access_token: authAccessToken,
//               refresh_token: authRefreshToken,
//             });
//             const user = resp.data?.user;
//             if (user) {
//               resolve(user);
//             } else {
//               resolve(null);
//             }
//           } catch (e: any) {
//             console.error("Error while getting current user", e);
//             reject(e);
//           }
//         } else {
//           resolve(null);
//         }
//       }
//     );
//   });
// }
