import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Core namespaces (common UI, login, core settings, navigation).
import enCore from "./locales/en.json";
import jaCore from "./locales/ja.json";

// Per-feature namespaces. Each file is the subtree for one feature; it is
// merged under a top-level key so components reference it as t("<feature>.key").
import enEmail from "./locales/en/email.json";
import jaEmail from "./locales/ja/email.json";
import enSettingsUi from "./locales/en/settingsUi.json";
import jaSettingsUi from "./locales/ja/settingsUi.json";
import enComposer from "./locales/en/composer.json";
import jaComposer from "./locales/ja/composer.json";
import enUi from "./locales/en/ui.json";
import jaUi from "./locales/ja/ui.json";
import enTasks from "./locales/en/tasks.json";
import jaTasks from "./locales/ja/tasks.json";
import enHelp from "./locales/en/help.json";
import jaHelp from "./locales/ja/help.json";
import enLabels from "./locales/en/labels.json";
import jaLabels from "./locales/ja/labels.json";
import enCalendar from "./locales/en/calendar.json";
import jaCalendar from "./locales/ja/calendar.json";
import enAccounts from "./locales/en/accounts.json";
import jaAccounts from "./locales/ja/accounts.json";
import enSearch from "./locales/en/search.json";
import jaSearch from "./locales/ja/search.json";
import enAttachments from "./locales/en/attachments.json";
import jaAttachments from "./locales/ja/attachments.json";
import enLayout from "./locales/en/layout.json";
import jaLayout from "./locales/ja/layout.json";
import enDnd from "./locales/en/dnd.json";
import jaDnd from "./locales/ja/dnd.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const enResources = {
  ...enCore,
  email: enEmail,
  settingsUi: enSettingsUi,
  composer: enComposer,
  ui: enUi,
  tasks: enTasks,
  help: enHelp,
  labels: enLabels,
  calendar: enCalendar,
  accounts: enAccounts,
  search: enSearch,
  attachments: enAttachments,
  layout: enLayout,
  dnd: enDnd,
};

export const jaResources = {
  ...jaCore,
  email: jaEmail,
  settingsUi: jaSettingsUi,
  composer: jaComposer,
  ui: jaUi,
  tasks: jaTasks,
  help: jaHelp,
  labels: jaLabels,
  calendar: jaCalendar,
  accounts: jaAccounts,
  search: jaSearch,
  attachments: jaAttachments,
  layout: jaLayout,
  dnd: jaDnd,
};

// Resources are bundled inline so init is synchronous — no Suspense needed.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enResources },
      ja: { translation: jaResources },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // map "ja-JP" → "ja"
    interpolation: { escapeValue: false }, // React already escapes
    returnObjects: true, // help steps use array values
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "fumi_language",
    },
  });

export default i18n;
