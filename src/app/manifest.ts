import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadTracker by Elivate",
    short_name: "LeadTracker",
    description:
      "Lead management for freelancers. Track leads, get reminders, close deals.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfaf3",
    theme_color: "#ff7f4f",
    icons: [
      {
        src: "/elivate-logo-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
