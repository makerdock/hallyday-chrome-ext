import { createRoot } from "react-dom/client";
import App from "@pages/content/ui/app";
import refreshOnUpdate from "virtual:reload-on-update-in-view";
// import { createClient } from "@supabase/supabase-js";

refreshOnUpdate("pages/content");

console.log("<============= INSIDE UI INDEX.TSX =============>");

// const _supabase = createClient(
//   "https://fhkdrjttwyipealchxne.supabase.co",
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa2RyanR0d3lpcGVhbGNoeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwODgyNDIsImV4cCI6MjAyMzY2NDI0Mn0.YMSvBR5BXRV1lfXI5j_z-Gd6v0cZNojONjf3YHTiHNY"
// );
// console.log("SUPABASE: ", _supabase);

const root = document.createElement("div");
root.id = "chrome-extension-boilerplate-react-vite-content-view-root";

document.body.append(root);

const rootIntoShadow = document.createElement("div");
rootIntoShadow.id = "shadow-root";

const shadowRoot = root.attachShadow({ mode: "open" });
shadowRoot.appendChild(rootIntoShadow);

/**
 * https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite/pull/174
 *
 * In the firefox environment, the adoptedStyleSheets bug may prevent contentStyle from being applied properly.
 * Please refer to the PR link above and go back to the contentStyle.css implementation, or raise a PR if you have a better way to improve it.
 */

createRoot(rootIntoShadow).render(<App />);
