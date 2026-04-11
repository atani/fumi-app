import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ThreadWindow } from "./components/email/ThreadWindow";
import "./styles/globals.css";

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
    <Root />
  </React.StrictMode>,
);
