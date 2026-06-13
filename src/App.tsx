import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "./stores/accountStore";
import { useUIStore } from "./stores/uiStore";
import { useComposerStore } from "./stores/composerStore";
import { useShortcutStore } from "./stores/shortcutStore";
import { useLicenseStore } from "./stores/licenseStore";
import { LoginPage } from "./components/auth/LoginPage";
import { ActivationPage } from "./components/license/ActivationPage";
import { TrialBanner } from "./components/license/TrialBanner";
import { MailLayout } from "./components/layout/MailLayout";
import { SettingsPage } from "./components/settings/SettingsPage";
import { CalendarPage } from "./components/calendar/CalendarPage";
import { TasksPage } from "./components/tasks/TasksPage";
import { HelpPage } from "./components/help/HelpPage";
import { AttachmentLibrary } from "./components/attachments/AttachmentLibrary";
import { runMigrations } from "./services/db/migrations";
import { loadDrafts, deleteDraft } from "./services/composer/draftAutoSave";
import type { LocalDraft } from "./services/composer/draftAutoSave";
import type { ComposerMode } from "./stores/composerStore";

export function App() {
  const { accounts, isLoading, loadAccounts } = useAccountStore();
  const isAuthenticated = accounts.length > 0;
  const licenseStatus = useLicenseStore((s) => s.status);
  const [pendingDraft, setPendingDraft] = useState<LocalDraft | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const init = async () => {
      await runMigrations();
      await useUIStore.getState().initTheme();
      await useUIStore.getState().initReadingPanePosition();
      await useUIStore.getState().initEmailListWidth();
      await useShortcutStore.getState().loadKeyMap();
      await useLicenseStore.getState().init();
      await loadAccounts();

      // Check for unsent drafts
      try {
        const drafts = await loadDrafts();
        const firstDraft = drafts[0];
        if (firstDraft) {
          setPendingDraft(firstDraft);
        }
      } catch {
        // Draft restoration is best-effort
      }

      // Close splash screen and show main window
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("close_splashscreen");
        } catch {
          // Splash screen may not exist in dev mode
        }
      }
    };
    init();
  }, [loadAccounts]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    useComposerStore.getState().restoreDraft({
      id: pendingDraft.id,
      mode: (pendingDraft.mode as ComposerMode) ?? "compose",
      to: pendingDraft.to_addresses ?? "",
      cc: pendingDraft.cc ?? "",
      bcc: pendingDraft.bcc ?? "",
      subject: pendingDraft.subject ?? "",
      body: pendingDraft.body ?? "",
      inReplyTo: pendingDraft.in_reply_to,
      references: pendingDraft.reference_headers,
    });
    setPendingDraft(null);
  }, [pendingDraft]);

  const handleDiscardDraft = useCallback(() => {
    if (!pendingDraft) return;
    deleteDraft(pendingDraft.id).catch((err: unknown) => {
      console.error("Failed to discard draft:", err);
    });
    setPendingDraft(null);
  }, [pendingDraft]);

  if (isLoading || licenseStatus === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Fumi</h1>
          <p className="mt-2 text-text-secondary">{t("app.loading")}</p>
        </div>
      </div>
    );
  }

  // Hard paywall once the free trial ends and no license is active.
  if (licenseStatus === "expired") {
    return <ActivationPage expired />;
  }

  return (
    <>
      {licenseStatus === "trial" && <TrialBanner />}
      {pendingDraft && (
        <div
          className="fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 shadow-lg"
          data-testid="draft-restore-banner"
        >
          <span className="text-sm text-text-primary">
            {pendingDraft.subject
              ? t("app.unsentDraftNamed", { subject: pendingDraft.subject })
              : t("app.unsentDraft")}
          </span>
          <button
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            onClick={handleRestoreDraft}
          >
            {t("app.restore")}
          </button>
          <button
            className="rounded bg-bg-hover px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            onClick={handleDiscardDraft}
          >
            {t("app.discard")}
          </button>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/tasks"
          element={isAuthenticated ? <TasksPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/calendar"
          element={isAuthenticated ? <CalendarPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/attachments"
          element={isAuthenticated ? <AttachmentLibrary /> : <Navigate to="/login" />}
        />
        <Route
          path="/help/:topic?"
          element={isAuthenticated ? <HelpPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/*"
          element={isAuthenticated ? <MailLayout /> : <Navigate to="/login" />}
        />
      </Routes>
    </>
  );
}
