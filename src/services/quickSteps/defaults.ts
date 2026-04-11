import type { QuickStepAction } from "../../types";

export interface QuickStepPreset {
  name: string;
  icon: string;
  actions: QuickStepAction[];
}

export const QUICK_STEP_PRESETS: QuickStepPreset[] = [
  {
    name: "Archive & Mark Read",
    icon: "archive",
    actions: [
      { type: "markRead" },
      { type: "archive" },
    ],
  },
  {
    name: "Star & Move to Important",
    icon: "star",
    actions: [
      { type: "star" },
      { type: "applyLabel", params: { labelId: "IMPORTANT" } },
    ],
  },
  {
    name: "Trash & Mark Read",
    icon: "trash",
    actions: [
      { type: "markRead" },
      { type: "trash" },
    ],
  },
  {
    name: "Mute & Archive",
    icon: "volume-x",
    actions: [
      { type: "mute" },
      { type: "archive" },
    ],
  },
  {
    name: "Mark Unread & Star",
    icon: "eye-off",
    actions: [
      { type: "markUnread" },
      { type: "star" },
    ],
  },
];
