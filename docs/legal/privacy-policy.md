# Privacy Policy for Fumi

_Last updated: 2026-06-13_

> **Draft for review.** Replace the bracketed placeholders (`[…]`) with your legal entity name and contact details, have it reviewed, and host it at a public URL (required for Google OAuth verification).

Fumi ("the App", "we", "us") is a desktop email client for macOS, Windows, and Linux, published by **[Your name / legal entity]**. This policy explains what data the App handles and how.

## Summary

Fumi is a **local-first** application. Your email, calendar, contacts, and account credentials are stored **only on your device**. **We operate no servers that receive your data, and the App contains no analytics or telemetry.** Your data is transmitted only to the services you connect to (Google, your IMAP/SMTP provider) and — only if you opt in — to the AI provider you configure with your own API key. To verify your paid license, the App also sends your license key (and nothing else about you) to our payment provider; see [License verification](#license-verification).

## Information the App accesses

When you connect a Google account, the App requests these scopes:

- **Gmail** (`gmail.modify`, `gmail.compose`, `gmail.send`) — to read, organize, draft, and send your mail.
- **Google Calendar** (`calendar`) — to show and create calendar events.
- **Basic profile** (`userinfo.email`, `userinfo.profile`) — to display your email address, name, and avatar.

When you connect an IMAP account, the App stores the mailbox credentials and server settings you enter.

## How the App uses and stores data

- All accessed data — messages, threads, labels, contacts, attachments, calendar events, and OAuth tokens — is stored **locally on your device** in an SQLite database (`fumi.db`).
- The App communicates **directly** from your device with Google's APIs and with any IMAP/SMTP server you configure. This data does not pass through any server operated by us.
- OAuth access and refresh tokens are stored locally and used solely to authenticate your own requests to Google.

## AI features (optional, opt-in)

The App includes optional AI features (thread summaries, smart replies, "Ask Inbox", task extraction). These work only if you enable them and provide **your own API key** for a provider you choose (Anthropic, OpenAI, or Google).

When you use an AI feature, the relevant message content is sent **directly from your device** to the AI provider you configured, under **that provider's** privacy policy and terms. We do not receive, store, or process this content. If you do not use AI features, no message content is sent to any AI provider.

## Google API Services User Data Policy — Limited Use

Fumi's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the **Limited Use** requirements. Specifically:

- Google user data is used **only to provide and improve the App's user-facing features** on your device.
- Google user data is **not transferred** to any party except as necessary to provide a feature you direct (e.g. sending message content to an AI provider you configured), to comply with applicable law, or as part of a merger you are notified of.
- Google user data is **not used for advertising**.
- **No humans read** your Google user data, except where you give explicit consent, where required for security/legal reasons, or where the data is aggregated and anonymized.

## License verification

Fumi is a paid app. To activate and verify your license, the App sends your **license key** and a generated **installation identifier** to our licensing and payment provider, **Lemon Squeezy** (our reseller and merchant of record) — when you activate a license and when the App starts (to confirm the license is still valid). This request contains **only** the license key and installation identifier; it never includes your email, contacts, or message content. It is governed by [Lemon Squeezy's privacy policy](https://www.lemonsqueezy.com/privacy). We do not operate the server; no data other than the license key and installation identifier leaves your device for this purpose.

## Data sharing

We do not sell, rent, or share your data. The only outbound transmissions are: (1) to Google and your IMAP/SMTP provider to operate your account, (2) to the AI provider you optionally configure, and (3) to our licensing provider (Lemon Squeezy) to verify your license key, as described above.

## Data retention and deletion

Because all data is stored locally, **you control it**:

- Delete a connected account in the App to remove its locally stored data.
- Uninstalling the App and deleting the `fumi.db` database removes all locally stored data.
- Revoke the App's access to your Google account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Security

Data is stored on your device and protected by your operating system's user account controls. Network communication with Google and AI providers uses HTTPS/TLS. Google OAuth uses the PKCE flow.

## Children

Fumi is not directed to children under 13 (or the equivalent minimum age in your jurisdiction).

## Changes

We may update this policy; material changes will be reflected by the "Last updated" date above.

## Contact

Questions: **[your-contact-email]**.
