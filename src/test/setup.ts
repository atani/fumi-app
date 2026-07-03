import "@testing-library/jest-dom/vitest";
import i18n from "../i18n";

// Pin the language so UI-string assertions are locale-deterministic regardless
// of the host's navigator.language.
void i18n.changeLanguage("en");
