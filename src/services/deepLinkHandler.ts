import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { useComposerStore } from "../stores/composerStore";

interface MailtoParams {
  to: string;
  subject: string;
  body: string;
  cc: string;
  bcc: string;
}

function parseMailtoUrl(url: string): MailtoParams | null {
  if (!url.startsWith("mailto:")) return null;

  // Format: mailto:addr1,addr2?subject=X&body=Y&cc=Z&bcc=W
  const withoutScheme = url.slice("mailto:".length);
  const [pathPart, queryPart] = withoutScheme.split("?", 2);

  const to = decodeURIComponent(pathPart ?? "");

  const params = new URLSearchParams(queryPart ?? "");
  const subject = decodeURIComponent(params.get("subject") ?? "");
  const body = decodeURIComponent(params.get("body") ?? "");
  const cc = decodeURIComponent(params.get("cc") ?? "");
  const bcc = decodeURIComponent(params.get("bcc") ?? "");

  return { to, subject, body, cc, bcc };
}

function openComposerWithMailto(params: MailtoParams): void {
  const store = useComposerStore.getState();
  store.openCompose();
  useComposerStore.setState({
    to: params.to,
    subject: params.subject,
    body: params.body,
    cc: params.cc,
    bcc: params.bcc,
  });
}

function handleUrls(urls: string[]): void {
  for (const url of urls) {
    const params = parseMailtoUrl(url);
    if (params) {
      openComposerWithMailto(params);
      break; // Only open one composer at a time
    }
  }
}

/**
 * Initialize the deep link handler to listen for mailto: URLs.
 * Returns a cleanup function to unregister the listener.
 */
export async function initDeepLinkHandler(): Promise<() => void> {
  // Check if the app was launched via a deep link
  try {
    const currentUrls = await getCurrent();
    if (currentUrls) {
      handleUrls(currentUrls);
    }
  } catch (err) {
    console.error("Failed to get current deep link URLs:", err);
  }

  // Listen for deep link events while the app is running
  let unlisten: (() => void) | undefined;
  try {
    unlisten = await onOpenUrl((urls) => {
      handleUrls(urls);
    });
  } catch (err) {
    console.error("Failed to register deep link listener:", err);
  }

  return () => {
    unlisten?.();
  };
}
