import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAccountStore } from "./stores/accountStore";
import { useUIStore } from "./stores/uiStore";
import { useComposerStore } from "./stores/composerStore";
import { LoginPage } from "./components/auth/LoginPage";
import { MailLayout } from "./components/layout/MailLayout";
import { SettingsPage } from "./components/settings/SettingsPage";
import { runMigrations } from "./services/db/migrations";
import { loadDrafts, deleteDraft } from "./services/composer/draftAutoSave";
import type { LocalDraft } from "./services/composer/draftAutoSave";
import type { ComposerMode } from "./stores/composerStore";

export function App() {
  const { accounts, isLoading, loadAccounts } = useAccountStore();
  const isAuthenticated = accounts.length > 0;
  const [pendingDraft, setPendingDraft] = useState<LocalDraft | null>(null);

  useEffect(() => {
    const init = async () => {
      await runMigrations();
      await useUIStore.getState().initTheme();
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Fumi</h1>
          <p className="mt-2 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {pendingDraft && (
        <div
          className="fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 shadow-lg"
          data-testid="draft-restore-banner"
        >
          <span className="text-sm text-text-primary">
            You have an unsent draft
            {pendingDraft.subject ? `: "${pendingDraft.subject}"` : ""}
          </span>
          <button
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            onClick={handleRestoreDraft}
          >
            Restore
          </button>
          <button
            className="rounded bg-bg-hover px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            onClick={handleDiscardDraft}
          >
            Discard
          </button>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/settings"
          element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/*"
          element={isAuthenticated ? <MailLayout /> : <Navigate to="/login" />}
        />
      </Routes>
    </>
  );
}
