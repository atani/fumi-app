import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ThreadWindow } from "./components/email/ThreadWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initLogForwarding } from "./services/logging";
import "./i18n";
import "./styles/globals.css";

// Persist console.warn/error to the log file so support can diagnose issues.
void initLogForwarding();

function Root() {
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get("thread");
  const accountId = params.get("account");

  if (threadId && accountId) {
    return <ThreadWindow threadId={threadId} accountId={accountId} />;
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
