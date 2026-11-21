export type ChangelogTag = "New" | "Improved" | "Fixed";

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  tag: ChangelogTag;
  bullets: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    id: "2026-11-21-task-management-and-chat-updates",
    date: "2026-11-21",
    title: "Task Management & Chat Updates",
    tag: "Improved",
    bullets: [
      "Resolved an issue preventing Admins from taking up tasks directly.",
      "Added time information to task due dates for more precise deadline tracking.",
      "Investigated the chat issue caused by Vercel's limitations with persistent WebSocket connections; currently unresolved.",
    ],
  },
  {
    id: "2026-11-21-task-management-and-bug-fixes",
    date: "2026-11-21",
    title: "Task Management, Subscription & Stability Improvements",
    tag: "Improved",
    bullets: [
      "Enabled Admins to take up tasks directly, assign tasks to Co-Admins, or leave task ownership open for them to pick up.",
      "Fixed subscription-related bugs and improved subscription handling.",
      "Relaxed the two-step verification rate limit to prevent overly restrictive access.",
      "Fixed an issue where plans were not reloading correctly.",
      "Resolved an issue in non-finance mode where departments without budgets were unable to create tasks."
    ],
  },
  {
    id: "2026-10-20-individual-plan-overview",
    date: "2026-10-20",
    title: "Individual Plan Overview — Categorization & Bifurcation",
    tag: "New",
    bullets: [
      "Introduced an Individual Plan Overview section to provide a structured view of individual plans.",
      "Categorized plans into relevant sections for better organization and easier navigation.",
      "Bifurcated plan details into distinct categories to improve clarity and readability.",
      "Improved the presentation of individual plan information for easier tracking and comparison.",
    ],
  },
  {
    id: "2026-10-19-user-preferences",
    date: "2026-10-19",
    title: "User Preferences & Message Snackbar",
    tag: "New",
    bullets: [
      "Introduced a per-user preferences system backed by the database — settings now persist across devices and sessions.",
      "Added a message snackbar: a top-left toast notification when a new message arrives while you're elsewhere in the app.",
      "Snackbar is suppressed automatically when you're already on the Connections page.",
      "Toggle message notifications on or off from Settings → Connections.",
      "Removed the unread badge toggle — the sidebar badge now always reflects unread messages.",
    ],
  },
  {
    id: "2026-10-17-account-security",
    date: "2026-10-17",
    title: "Account Security & Verification",
    tag: "Improved",
    bullets: [
      "Added two-factor authentication (2FA) setup with backup codes.",
      "Enhanced account settings for improved account management and security.",
      "Added signup verification to help secure new accounts.",
      "SMS-based account recovery is currently in progress.",
    ],
  },
  {
    id: "2026-10-12-connections-fullscreen",
    date: "2026-10-12",
    title: "Connections Fullscreen & Mobile View",
    tag: "Improved",
    bullets: [
      "Toggle fullscreen mode for conversations on desktop and mobile.",
      "Optimized mobile layout to prevent right-side overflow and unwanted page scroll.",
      "Improved panel spacing and chat composer responsiveness across screen sizes.",
    ],
  },
  {
    id: "2026-10-12-chat-file-sharing",
    date: "2026-10-12",
    title: "Document Sharing in Chats",
    tag: "New",
    bullets: [
      "Share documents and files directly in chats.",
      "Preview shared files before opening them.",
      "View file names, types, and sizes in chat attachments.",
    ],
  },
  {
    id: "2026-10-12",
    date: "2026-10-12",
    title: "What's new dialog",
    tag: "New",
    bullets: [
      "See recent updates from the sidebar.",
      "A dot appears when there's something you haven't seen.",
    ],
  },
];

export const latestChangelogId = changelog[0]?.id ?? null;