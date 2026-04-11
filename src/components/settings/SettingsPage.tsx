import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { AccountAvatar } from "../accounts/AccountAvatar";
import { TemplateEditor } from "./TemplateEditor";
import { SignatureEditor } from "./SignatureEditor";
import { FilterEditor } from "./FilterEditor";
import { BundleEditor } from "./BundleEditor";
import { getDb } from "../../services/db/connection";

type Theme = "system" | "light" | "dark";

const SYNC_INTERVALS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
];

async function loadSetting(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function saveSetting(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [key, value],
    );
  } catch {
    // Silently fail
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { accounts, removeAccount } = useAccountStore();
  const { theme, setTheme } = useUIStore();

  const [syncInterval, setSyncInterval] = useState(60);
  const [undoSendDelay, setUndoSendDelay] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(
    null,
  );

  const [phishingSensitivity, setPhishingSensitivity] = useState<string>("default");

  // AI settings state
  const [aiProvider, setAiProvider] = useState<string>("claude");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(true);
  const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
  const [aiCategoryEnabled, setAiCategoryEnabled] = useState(true);

  // Load persisted settings
  useEffect(() => {
    const load = async () => {
      const [
        interval,
        notif,
        storedClientId,
        storedClientSecret,
        storedUndoDelay,
        storedAiProvider,
        storedAiApiKey,
        storedAiSummary,
        storedAiReplies,
        storedAiCategory,
        storedPhishingSensitivity,
      ] = await Promise.all([
          loadSetting("sync_interval"),
          loadSetting("notifications_enabled"),
          loadSetting("google_client_id"),
          loadSetting("google_client_secret"),
          loadSetting("undo_send_delay"),
          loadSetting("ai_provider"),
          loadSetting("ai_api_key"),
          loadSetting("ai_summary_enabled"),
          loadSetting("ai_replies_enabled"),
          loadSetting("ai_category_enabled"),
          loadSetting("phishing_sensitivity"),
        ]);

      if (interval) setSyncInterval(Number(interval));
      if (notif !== null) setNotificationsEnabled(notif !== "false");
      if (storedClientId) setClientId(storedClientId);
      if (storedClientSecret) setClientSecret(storedClientSecret);
      if (storedUndoDelay) setUndoSendDelay(Number(storedUndoDelay));
      if (storedAiProvider) setAiProvider(storedAiProvider);
      if (storedAiApiKey) setAiApiKey(storedAiApiKey);
      if (storedAiSummary !== null) setAiSummaryEnabled(storedAiSummary !== "false");
      if (storedAiReplies !== null) setAiRepliesEnabled(storedAiReplies !== "false");
      if (storedAiCategory !== null) setAiCategoryEnabled(storedAiCategory !== "false");
      if (storedPhishingSensitivity) setPhishingSensitivity(storedPhishingSensitivity);

      // Check autostart status
      if (
        typeof window !== "undefined" &&
        "__TAURI_INTERNALS__" in window
      ) {
        try {
          const { isEnabled } = await import(
            "@tauri-apps/plugin-autostart"
          );
          setAutostartEnabled(await isEnabled());
        } catch {
          // Plugin not available
        }
      }
    };
    load();
  }, []);

  const handleRemoveAccount = useCallback(
    async (id: string) => {
      setRemovingAccountId(id);
      try {
        await removeAccount(id);
      } finally {
        setRemovingAccountId(null);
      }
    },
    [removeAccount],
  );

  const handleSyncIntervalChange = useCallback(async (value: number) => {
    setSyncInterval(value);
    await saveSetting("sync_interval", String(value));
  }, []);

  const handleUndoSendDelayChange = useCallback(async (value: number) => {
    setUndoSendDelay(value);
    await saveSetting("undo_send_delay", String(value));
  }, []);

  const handleNotificationsToggle = useCallback(async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await saveSetting("notifications_enabled", String(enabled));
  }, []);

  const handleAutostartToggle = useCallback(async (enabled: boolean) => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }
    try {
      const { enable, disable } = await import(
        "@tauri-apps/plugin-autostart"
      );
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setAutostartEnabled(enabled);
    } catch {
      // Plugin not available
    }
  }, []);

  const handlePhishingSensitivityChange = useCallback(async (value: string) => {
    setPhishingSensitivity(value);
    await saveSetting("phishing_sensitivity", value);
  }, []);

  const handleClientIdSave = useCallback(
    async (value: string) => {
      setClientId(value);
      await saveSetting("google_client_id", value);
    },
    [],
  );

  const handleClientSecretSave = useCallback(
    async (value: string) => {
      setClientSecret(value);
      await saveSetting("google_client_secret", value);
    },
    [],
  );

  const handleAiProviderChange = useCallback(async (value: string) => {
    setAiProvider(value);
    await saveSetting("ai_provider", value);
  }, []);

  const handleAiApiKeySave = useCallback(async (value: string) => {
    setAiApiKey(value);
    await saveSetting("ai_api_key", value);
  }, []);

  const handleAiSummaryToggle = useCallback(async (enabled: boolean) => {
    setAiSummaryEnabled(enabled);
    await saveSetting("ai_summary_enabled", String(enabled));
  }, []);

  const handleAiRepliesToggle = useCallback(async (enabled: boolean) => {
    setAiRepliesEnabled(enabled);
    await saveSetting("ai_replies_enabled", String(enabled));
  }, []);

  const handleAiCategoryToggle = useCallback(async (enabled: boolean) => {
    setAiCategoryEnabled(enabled);
    await saveSetting("ai_category_enabled", String(enabled));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Title bar drag region */}
      <div
        className="h-10 shrink-0 bg-bg-primary"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 pb-12">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              data-testid="settings-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          </div>

          {/* Accounts */}
          <Section title="Accounts">
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
                  data-testid={`settings-account-${account.id}`}
                >
                  <AccountAvatar account={account} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {account.email}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {account.provider === "gmail_api"
                        ? "Gmail API"
                        : "IMAP"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveAccount(account.id)}
                    disabled={removingAccountId === account.id}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                    data-testid={`remove-account-${account.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigate("/login")}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                data-testid="add-gmail-account"
              >
                Add Gmail account
              </button>
              <button
                onClick={() => navigate("/login")}
                className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
                data-testid="add-imap-account"
              >
                Add IMAP account
              </button>
            </div>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <label className="mb-2 block text-sm text-text-secondary">
              Theme
            </label>
            <div
              className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-1"
              data-testid="theme-selector"
            >
              {(
                [
                  { value: "system", icon: Monitor, label: "System" },
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                ] as const
              ).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value as Theme)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    theme === value
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                  data-testid={`theme-${value}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Sync */}
          <Section title="Sync">
            <label className="mb-2 block text-sm text-text-secondary">
              Sync interval
            </label>
            <select
              value={syncInterval}
              onChange={(e) =>
                handleSyncIntervalChange(Number(e.target.value))
              }
              className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="sync-interval-select"
            >
              {SYNC_INTERVALS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Section>

          {/* Undo Send */}
          <Section title="Undo Send">
            <label className="mb-2 block text-sm text-text-secondary">
              Undo send delay
            </label>
            <select
              value={undoSendDelay}
              onChange={(e) =>
                handleUndoSendDelayChange(Number(e.target.value))
              }
              className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="undo-send-delay-select"
            >
              <option value={0}>Off</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
            <p className="mt-1.5 text-xs text-text-tertiary">
              Delay sending emails so you can undo within the chosen time window.
            </p>
          </Section>

          {/* Filter Rules */}
          <Section title="Filter Rules">
            <FilterEditor />
          </Section>

          {/* Bundle Rules */}
          <Section title="Bundle Rules">
            <BundleEditor />
          </Section>

          {/* Phishing Detection */}
          <Section title="Phishing Detection">
            <label className="mb-2 block text-sm text-text-secondary">
              Detection sensitivity
            </label>
            <select
              value={phishingSensitivity}
              onChange={(e) =>
                handlePhishingSensitivityChange(e.target.value)
              }
              className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="phishing-sensitivity-select"
            >
              <option value="low">Low</option>
              <option value="default">Default</option>
              <option value="high">High</option>
            </select>
            <p className="mt-1.5 text-xs text-text-tertiary">
              Controls how aggressively links in emails are flagged as suspicious. Higher sensitivity catches more threats but may produce more false positives.
            </p>
          </Section>

          {/* Notifications */}
          <Section title="Notifications">
            <ToggleRow
              label="Desktop notifications"
              description="Show notifications for new emails"
              enabled={notificationsEnabled}
              onToggle={handleNotificationsToggle}
              testId="notifications-toggle"
            />
          </Section>

          {/* Autostart */}
          <Section title="Autostart">
            <ToggleRow
              label="Launch on startup"
              description="Start Fumi when you log in to your computer"
              enabled={autostartEnabled}
              onToggle={handleAutostartToggle}
              testId="autostart-toggle"
            />
          </Section>

          {/* Templates */}
          <Section title="Templates">
            <TemplateEditor />
          </Section>

          {/* Signatures */}
          <Section title="Signatures">
            <SignatureEditor />
          </Section>

          {/* AI Features */}
          <Section title="AI Features">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => void handleAiProviderChange(e.target.value)}
                  className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  data-testid="ai-provider-select"
                >
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini (Google)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showAiApiKey ? "text" : "password"}
                    value={aiApiKey}
                    onChange={(e) => void handleAiApiKeySave(e.target.value)}
                    placeholder="Enter API key"
                    className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                    data-testid="ai-api-key-input"
                  />
                  <button
                    onClick={() => setShowAiApiKey((prev) => !prev)}
                    className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                    data-testid="toggle-ai-api-key-visibility"
                  >
                    {showAiApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <ToggleRow
                  label="Thread summaries"
                  description="AI-generated summaries for email threads"
                  enabled={aiSummaryEnabled}
                  onToggle={handleAiSummaryToggle}
                  testId="ai-summary-toggle"
                />
                <ToggleRow
                  label="Smart reply suggestions"
                  description="AI-suggested reply options for emails"
                  enabled={aiRepliesEnabled}
                  onToggle={handleAiRepliesToggle}
                  testId="ai-replies-toggle"
                />
                <ToggleRow
                  label="Auto-categorization"
                  description="Automatically categorize emails using AI"
                  enabled={aiCategoryEnabled}
                  onToggle={handleAiCategoryToggle}
                  testId="ai-category-toggle"
                />
              </div>
            </div>
          </Section>

          {/* OAuth Credentials */}
          <Section title="OAuth Credentials">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Google Client ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showClientId ? "text" : "password"}
                    value={clientId}
                    onChange={(e) => handleClientIdSave(e.target.value)}
                    placeholder="Enter Client ID"
                    className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                    data-testid="settings-client-id"
                  />
                  <button
                    onClick={() => setShowClientId((prev) => !prev)}
                    className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                    data-testid="toggle-client-id-visibility"
                  >
                    {showClientId ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Client Secret
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showClientSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => handleClientSecretSave(e.target.value)}
                    placeholder="Enter Client Secret"
                    className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                    data-testid="settings-client-secret"
                  />
                  <button
                    onClick={() => setShowClientSecret((prev) => !prev)}
                    className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                    data-testid="toggle-client-secret-visibility"
                  >
                    {showClientSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* About */}
          <Section title="About">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-text-primary">Fumi</p>
              <p className="text-text-secondary">Version 0.1.0</p>
              <a
                href="https://github.com/atani/fumi-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
                data-testid="about-github-link"
              >
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  testId,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-border-secondary"
        }`}
        role="switch"
        aria-checked={enabled}
        data-testid={testId}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
