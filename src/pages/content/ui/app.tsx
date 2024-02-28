import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function App() {
  // const _supabase = createClient(
  //   "https://fhkdrjttwyipealchxne.supabase.co",
  //   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa2RyanR0d3lpcGVhbGNoeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwODgyNDIsImV4cCI6MjAyMzY2NDI0Mn0.YMSvBR5BXRV1lfXI5j_z-Gd6v0cZNojONjf3YHTiHNY"
  // );
  // console.log("SUPABASE: ", _supabase);

  useEffect(() => {
    console.log("content view loaded");
  }, []);

  return <div className="">content view</div>;
}
