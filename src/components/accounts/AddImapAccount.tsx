import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "../../stores/accountStore";
import {
  imapTestConnection,
  smtpTestConnection,
} from "../../services/imap/tauriCommands";
import type { Account } from "../../types";

interface ProviderPreset {
  name: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: "ssl" | "starttls" | "none";
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "ssl" | "starttls" | "none";
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "Outlook / Hotmail",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
  },
  {
    name: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
  },
  {
    name: "iCloud",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
  },
  {
    name: "AOL",
    imapHost: "imap.aol.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.aol.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
  },
  {
    name: "Zoho",
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
  },
  {
    name: "FastMail",
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
  },
  {
    name: "GMX",
    imapHost: "imap.gmx.com",
    imapPort: 993,
    imapSecurity: "ssl",
    smtpHost: "mail.gmx.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
  },
];

function autoDetectProvider(email: string): ProviderPreset | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  ) {
    return PROVIDER_PRESETS.find((p) => p.name === "Outlook / Hotmail") ?? null;
  }
  if (domain === "yahoo.com" || domain.endsWith(".yahoo.com")) {
    return PROVIDER_PRESETS.find((p) => p.name === "Yahoo Mail") ?? null;
  }
  if (
    domain === "icloud.com" ||
    domain === "me.com" ||
    domain === "mac.com"
  ) {
    return PROVIDER_PRESETS.find((p) => p.name === "iCloud") ?? null;
  }
  if (domain === "aol.com") {
    return PROVIDER_PRESETS.find((p) => p.name === "AOL") ?? null;
  }
  if (domain.endsWith("zoho.com")) {
    return PROVIDER_PRESETS.find((p) => p.name === "Zoho") ?? null;
  }
  if (domain === "fastmail.com" || domain === "fastmail.fm") {
    return PROVIDER_PRESETS.find((p) => p.name === "FastMail") ?? null;
  }
  if (domain === "gmx.com" || domain === "gmx.net") {
    return PROVIDER_PRESETS.find((p) => p.name === "GMX") ?? null;
  }

  return null;
}

type SecurityType = "ssl" | "starttls" | "none";

interface AddImapAccountProps {
  onClose: () => void;
}

export function AddImapAccount({ onClose }: AddImapAccountProps) {
  const { t } = useTranslation();
  const addAccount = useAccountStore((s) => s.addAccount);

  const [step, setStep] = useState<"credentials" | "servers">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapSecurity, setImapSecurity] = useState<SecurityType>("ssl");
  const [imapUsername, setImapUsername] = useState("");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecurity, setSmtpSecurity] = useState<SecurityType>("ssl");

  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const applyPreset = useCallback((preset: ProviderPreset) => {
    setImapHost(preset.imapHost);
    setImapPort(preset.imapPort);
    setImapSecurity(preset.imapSecurity);
    setSmtpHost(preset.smtpHost);
    setSmtpPort(preset.smtpPort);
    setSmtpSecurity(preset.smtpSecurity);
  }, []);

  const handleEmailBlur = useCallback(() => {
    const preset = autoDetectProvider(email);
    if (preset) {
      applyPreset(preset);
    }
  }, [email, applyPreset]);

  const handleNext = useCallback(() => {
    if (!email || !password) {
      setError(t("accounts.credentialsRequired"));
      return;
    }
    setError(null);
    handleEmailBlur();
    setStep("servers");
  }, [email, password, handleEmailBlur, t]);

  const handleTestAndSave = useCallback(async () => {
    setTesting(true);
    setError(null);
    setTestStatus(null);

    const username = imapUsername || email;

    try {
      setTestStatus(t("accounts.testingImap"));
      await imapTestConnection({
        host: imapHost,
        port: imapPort,
        username,
        password,
        security: imapSecurity,
      });

      setTestStatus(t("accounts.testingSmtp"));
      await smtpTestConnection({
        host: smtpHost,
        port: smtpPort,
        username,
        password,
        security: smtpSecurity,
      });

      setTestStatus(t("accounts.savingAccount"));
      const accountId = `imap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const account: Account = {
        id: accountId,
        email,
        name: displayName || email.split("@")[0] || email,
        picture: "",
        provider: "imap",
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_security: imapSecurity,
        imap_username: imapUsername || null,
        imap_password: password,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_security: smtpSecurity,
      };

      await addAccount(account);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTestStatus(null);
    } finally {
      setTesting(false);
    }
  }, [
    email,
    password,
    displayName,
    imapHost,
    imapPort,
    imapSecurity,
    imapUsername,
    smtpHost,
    smtpPort,
    smtpSecurity,
    addAccount,
    onClose,
    t,
  ]);

  const securityOptions: { value: SecurityType; label: string }[] = [
    { value: "ssl", label: "SSL/TLS" },
    { value: "starttls", label: "STARTTLS" },
    { value: "none", label: t("accounts.securityNone") },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold text-text-primary">
        {t("accounts.addImapAccount")}
      </h2>

      {error && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {testStatus && (
        <div className="rounded-md bg-accent-light px-3 py-2 text-sm text-accent">
          {testStatus}
        </div>
      )}

      {step === "credentials" && (
        <>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">
                {t("accounts.email")}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder={t("accounts.emailPlaceholder")}
                className="rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">
                {t("accounts.password")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("accounts.passwordPlaceholder")}
                className="rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">
                {t("accounts.displayName")}
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("accounts.displayNamePlaceholder")}
                className="rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-tertiary">
              {t("accounts.quickSetup")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              {t("accounts.cancel")}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
            >
              {t("accounts.next")}
            </button>
          </div>
        </>
      )}

      {step === "servers" && (
        <>
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3 rounded-md border border-border-primary p-3">
              <legend className="px-1 text-sm font-medium text-text-secondary">
                {t("accounts.imapIncoming")}
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.host")}
                  </span>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder={t("accounts.imapHostPlaceholder")}
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.port")}
                  </span>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.security")}
                  </span>
                  <select
                    value={imapSecurity}
                    onChange={(e) =>
                      setImapSecurity(e.target.value as SecurityType)
                    }
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  >
                    {securityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-tertiary">
                  {t("accounts.usernameHint")}
                </span>
                <input
                  type="text"
                  value={imapUsername}
                  onChange={(e) => setImapUsername(e.target.value)}
                  placeholder={email || "you@example.com"}
                  className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
              </label>
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-md border border-border-primary p-3">
              <legend className="px-1 text-sm font-medium text-text-secondary">
                {t("accounts.smtpOutgoing")}
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.host")}
                  </span>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder={t("accounts.smtpHostPlaceholder")}
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.port")}
                  </span>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">
                    {t("accounts.security")}
                  </span>
                  <select
                    value={smtpSecurity}
                    onChange={(e) =>
                      setSmtpSecurity(e.target.value as SecurityType)
                    }
                    className="rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  >
                    {securityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              {t("accounts.back")}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                {t("accounts.cancel")}
              </button>
              <button
                type="button"
                onClick={handleTestAndSave}
                disabled={testing || !imapHost || !smtpHost}
                className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {testing
                  ? t("accounts.testing")
                  : t("accounts.testAndAddAccount")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
