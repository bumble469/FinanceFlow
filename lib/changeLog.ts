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