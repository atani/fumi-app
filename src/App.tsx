import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAccountStore } from "./stores/accountStore";
import { useUIStore } from "./stores/uiStore";
import { LoginPage } from "./components/auth/LoginPage";
import { MailLayout } from "./components/layout/MailLayout";
import { SettingsPage } from "./components/settings/SettingsPage";
import { runMigrations } from "./services/db/migrations";

export function App() {
  const { accounts, isLoading, loadAccounts } = useAccountStore();
  const isAuthenticated = accounts.length > 0;

  useEffect(() => {
    const init = async () => {
      await runMigrations();
      await useUIStore.getState().initTheme();
      await loadAccounts();
    };
    init();
  }, [loadAccounts]);

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
  );
}
