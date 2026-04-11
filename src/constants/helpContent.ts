export interface HelpCard {
  id: string;
  title: string;
  description: string;
  steps?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  cards: HelpCard[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Set up your account and learn the basics of Fumi.",
    cards: [
      {
        id: "gs-add-account",
        title: "Add your email account",
        description: "Connect a Gmail or IMAP account to start using Fumi.",
        steps: [
          "Open Settings from the sidebar.",
          "Click Add Account.",
          "Sign in with Google or enter your IMAP server details.",
          "Fumi will sync your recent emails automatically.",
        ],
      },
      {
        id: "gs-navigation",
        title: "Navigate the interface",
        description:
          "The sidebar lists your folders and labels. Click a folder to view its threads. Select a thread to read it in the reading pane.",
      },
      {
        id: "gs-theme",
        title: "Switch themes",
        description:
          "Toggle between light, dark, and system themes using the theme button at the bottom of the sidebar.",
      },
    ],
  },
  {
    id: "composing",
    title: "Composing",
    description: "Write and send emails with the rich text composer.",
    cards: [
      {
        id: "comp-new",
        title: "Compose a new email",
        description:
          "Click the Compose button in the sidebar or press C to open a new message.",
      },
      {
        id: "comp-reply",
        title: "Reply and forward",
        description:
          "Press R to reply, A to reply all, or F to forward the selected thread.",
      },
      {
        id: "comp-schedule",
        title: "Schedule send",
        description:
          "Choose a future date and time to send your email automatically.",
        steps: [
          "Open the composer.",
          "Click the clock icon next to the Send button.",
          "Pick a date and time, then confirm.",
        ],
      },
      {
        id: "comp-drafts",
        title: "Auto-saved drafts",
        description:
          "Drafts are saved automatically every 3 seconds. If the app closes unexpectedly, you will be prompted to restore your draft on next launch.",
      },
    ],
  },
  {
    id: "reading",
    title: "Reading",
    description: "Read, organize, and act on your emails.",
    cards: [
      {
        id: "read-thread",
        title: "Thread view",
        description:
          "Emails are grouped into conversation threads. Open a thread to see all messages in order.",
      },
      {
        id: "read-archive",
        title: "Archive and trash",
        description:
          "Press E to archive or # to trash the selected thread. Trashing a thread already in Trash deletes it permanently.",
      },
      {
        id: "read-snooze",
        title: "Snooze emails",
        description:
          "Snooze a thread to temporarily remove it from your inbox. It will reappear at the time you choose.",
      },
      {
        id: "read-star",
        title: "Star and pin",
        description:
          "Press S to star or P to pin a thread for quick access later.",
      },
    ],
  },
  {
    id: "search",
    title: "Search",
    description: "Find emails quickly with powerful search operators.",
    cards: [
      {
        id: "search-basic",
        title: "Basic search",
        description:
          "Press / or Ctrl+K to open the command palette. Type any keyword to search across all your emails.",
      },
      {
        id: "search-operators",
        title: "Search operators",
        description:
          "Use Gmail-style operators for precise results: from:, to:, subject:, has:attachment, is:unread, before:, after:, label:.",
      },
      {
        id: "search-smart-folders",
        title: "Smart folders",
        description:
          "Save frequently used searches as smart folders for one-click access from the sidebar.",
      },
    ],
  },
  {
    id: "labels",
    title: "Labels",
    description: "Organize your emails with custom labels.",
    cards: [
      {
        id: "label-create",
        title: "Create a label",
        description:
          "Click the + icon in the Labels section of the sidebar, or right-click an existing label to edit or delete it.",
      },
      {
        id: "label-apply",
        title: "Apply labels to threads",
        description:
          "Press V to move a thread to a folder or label. You can also drag and drop threads onto sidebar labels.",
      },
      {
        id: "label-colors",
        title: "Label colors",
        description:
          "Assign a color to each label so you can spot categories at a glance in the thread list.",
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Shortcuts",
    description: "Navigate and act on emails without leaving the keyboard.",
    cards: [
      {
        id: "sc-navigation",
        title: "Navigation shortcuts",
        description:
          "J/K to move between threads, O or Enter to open, Escape to go back. G then I for Inbox, G then S for Starred, and more.",
      },
      {
        id: "sc-actions",
        title: "Action shortcuts",
        description:
          "E to archive, S to star, # to trash, R to reply, A to reply all, F to forward, C to compose.",
      },
      {
        id: "sc-customize",
        title: "Customize shortcuts",
        description:
          "Remap any keyboard shortcut in Settings to match your preferred workflow.",
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "View and manage your Google Calendar events.",
    cards: [
      {
        id: "cal-view",
        title: "Calendar views",
        description:
          "Switch between day, week, and month views. Navigate forward and backward with the toolbar buttons.",
      },
      {
        id: "cal-create",
        title: "Create events",
        description:
          "Click on an empty time slot or use the create button to add a new calendar event.",
      },
    ],
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Track to-dos extracted from emails or created manually.",
    cards: [
      {
        id: "task-create",
        title: "Create tasks",
        description:
          "Add tasks manually from the Tasks page, or press T on a thread to extract tasks with AI.",
      },
      {
        id: "task-filters",
        title: "Filter tasks",
        description:
          "View all tasks, today's tasks, upcoming tasks, or completed tasks using the filter tabs.",
      },
      {
        id: "task-recurring",
        title: "Recurring tasks",
        description:
          "Set a recurrence rule (daily, weekly, monthly, yearly) and Fumi will create the next occurrence automatically when you complete one.",
      },
    ],
  },
  {
    id: "ai-features",
    title: "AI Features",
    description: "Use AI to summarize, reply, compose, and categorize emails.",
    cards: [
      {
        id: "ai-summary",
        title: "Thread summaries",
        description:
          "Get a quick AI-generated summary of long email threads so you can catch up in seconds.",
      },
      {
        id: "ai-reply",
        title: "Smart replies",
        description:
          "AI suggests short reply options based on the thread context. Click one to insert it into the composer.",
      },
      {
        id: "ai-compose",
        title: "AI compose and rewrite",
        description:
          "Let AI draft an email from a prompt, or transform selected text (shorten, expand, fix grammar, change tone).",
      },
      {
        id: "ai-categorize",
        title: "Auto-categorization",
        description:
          "Fumi sorts incoming mail into Primary, Updates, Promotions, Social, and Newsletters using AI and rule-based heuristics.",
      },
    ],
  },
  {
    id: "filters",
    title: "Filters",
    description: "Automate actions on incoming emails with filter rules.",
    cards: [
      {
        id: "filter-create",
        title: "Create a filter",
        description:
          "Go to Settings and open Filters. Define criteria (sender, subject, keywords) and choose actions (label, archive, star, mark read, trash).",
      },
      {
        id: "filter-logic",
        title: "How filters work",
        description:
          "Filter criteria use AND logic: all conditions must match. When multiple filters match the same message, their actions are merged.",
      },
    ],
  },
  {
    id: "templates",
    title: "Templates",
    description: "Save reusable email templates for common replies.",
    cards: [
      {
        id: "tpl-create",
        title: "Create a template",
        description:
          "Open Settings, go to Templates, and add a new template with a name, subject, and body.",
      },
      {
        id: "tpl-use",
        title: "Use a template",
        description:
          "In the composer, click the template picker to insert a saved template. You can also assign a keyboard shortcut to each template.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Stay safe with phishing detection and authentication checks.",
    cards: [
      {
        id: "sec-phishing",
        title: "Phishing detection",
        description:
          "Fumi scans links in emails for suspicious patterns (IP URLs, homograph attacks, URL shorteners, brand impersonation) and warns you before you click.",
      },
      {
        id: "sec-auth",
        title: "Authentication results",
        description:
          "SPF, DKIM, and DMARC results are parsed from email headers and shown as a badge on each message so you can verify sender authenticity.",
      },
      {
        id: "sec-images",
        title: "Remote image blocking",
        description:
          "Remote images are blocked by default to protect your privacy. Allow images from trusted senders via the allowlist.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Customize Fumi to fit your workflow.",
    cards: [
      {
        id: "set-accounts",
        title: "Manage accounts",
        description:
          "Add or remove email accounts, configure OAuth client IDs, and manage send-as aliases.",
      },
      {
        id: "set-appearance",
        title: "Appearance",
        description:
          "Choose a color theme, adjust font scale, change email density, and toggle the reading pane position.",
      },
      {
        id: "set-ai",
        title: "AI provider settings",
        description:
          "Configure API keys for Claude, OpenAI, or Gemini. Select which provider to use for each AI feature.",
      },
      {
        id: "set-notifications",
        title: "Notifications",
        description:
          "Enable desktop notifications and add VIP senders to get notified only for the emails that matter.",
      },
    ],
  },
];
