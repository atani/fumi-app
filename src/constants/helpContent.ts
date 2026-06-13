// Structural definition of the help center. All user-facing text (category
// titles/descriptions and card titles/descriptions/steps) is resolved at
// render time via i18next under the "help" namespace, keyed by these ids:
//   help.categories.<categoryId>.{title,description}
//   help.cards.<cardId>.{title,description,steps}

export interface HelpCard {
  id: string;
  /** Whether this card has a localized ordered list of steps. */
  hasSteps?: boolean;
}

export interface HelpCategory {
  id: string;
  cards: HelpCard[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    cards: [
      { id: "gs-add-account", hasSteps: true },
      { id: "gs-navigation" },
      { id: "gs-theme" },
    ],
  },
  {
    id: "composing",
    cards: [
      { id: "comp-new" },
      { id: "comp-reply" },
      { id: "comp-schedule", hasSteps: true },
      { id: "comp-drafts" },
    ],
  },
  {
    id: "reading",
    cards: [
      { id: "read-thread" },
      { id: "read-archive" },
      { id: "read-snooze" },
      { id: "read-star" },
    ],
  },
  {
    id: "search",
    cards: [
      { id: "search-basic" },
      { id: "search-operators" },
      { id: "search-smart-folders" },
    ],
  },
  {
    id: "labels",
    cards: [
      { id: "label-create" },
      { id: "label-apply" },
      { id: "label-colors" },
    ],
  },
  {
    id: "shortcuts",
    cards: [
      { id: "sc-navigation" },
      { id: "sc-actions" },
      { id: "sc-customize" },
    ],
  },
  {
    id: "calendar",
    cards: [{ id: "cal-view" }, { id: "cal-create" }],
  },
  {
    id: "tasks",
    cards: [
      { id: "task-create" },
      { id: "task-filters" },
      { id: "task-recurring" },
    ],
  },
  {
    id: "ai-features",
    cards: [
      { id: "ai-summary" },
      { id: "ai-reply" },
      { id: "ai-compose" },
      { id: "ai-categorize" },
    ],
  },
  {
    id: "filters",
    cards: [{ id: "filter-create" }, { id: "filter-logic" }],
  },
  {
    id: "templates",
    cards: [{ id: "tpl-create" }, { id: "tpl-use" }],
  },
  {
    id: "security",
    cards: [
      { id: "sec-phishing" },
      { id: "sec-auth" },
      { id: "sec-images" },
    ],
  },
  {
    id: "settings",
    cards: [
      { id: "set-accounts" },
      { id: "set-appearance" },
      { id: "set-ai" },
      { id: "set-notifications" },
    ],
  },
];
