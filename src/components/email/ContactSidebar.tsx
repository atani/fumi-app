import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Calendar, MessageSquare, X } from "lucide-react";
import type { Contact, Thread } from "../../types";
import {
  getContactByEmail,
  getRecentThreadsWithContact,
} from "../../services/contacts/contactService";
import { getGravatarUrl } from "../../services/contacts/gravatar";

interface ContactSidebarProps {
  email: string;
  name: string | null;
  accountId: string;
  onClose: () => void;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function LetterAvatar({ name, email }: { name: string | null; email: string }) {
  const letter = (name?.[0] ?? email[0] ?? "?").toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white">
      {letter}
    </div>
  );
}

export function ContactSidebar({
  email,
  name,
  accountId,
  onClose,
}: ContactSidebarProps) {
  const { t } = useTranslation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [recentThreads, setRecentThreads] = useState<Thread[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setAvatarError(false);
      setAvatarUrl(null);
      setContact(null);
      setRecentThreads([]);

      const [contactResult, threads, gravatarUrl] = await Promise.all([
        getContactByEmail(accountId, email),
        getRecentThreadsWithContact(accountId, email, 5),
        getGravatarUrl(email),
      ]);

      if (cancelled) return;

      setContact(contactResult);
      setRecentThreads(threads);
      setAvatarUrl(gravatarUrl);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId, email]);

  const displayName = contact?.name ?? name ?? email;
  const showDate = (dateStr: string | null) =>
    formatDate(dateStr) ?? t("email.contact.unknownDate");

  return (
    <div
      className="flex w-72 flex-shrink-0 flex-col border-l border-border-primary bg-bg-secondary overflow-y-auto"
      data-testid="contact-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
        <span className="text-sm font-semibold text-text-primary">{t("email.contact.title")}</span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          title={t("email.contact.close")}
          data-testid="contact-sidebar-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Avatar & identity */}
      <div className="flex flex-col items-center gap-2 px-4 py-5">
        {avatarUrl && !avatarError ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-16 w-16 rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <LetterAvatar name={name ?? contact?.name ?? null} email={email} />
        )}
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">{displayName}</p>
          <p className="text-xs text-text-tertiary">{email}</p>
        </div>
      </div>

      {/* Stats */}
      {contact && (
        <div className="space-y-2 border-t border-border-secondary px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {t("email.contact.interactions", { count: contact.frequency })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{t("email.contact.first", { date: showDate(contact.first_contacted_at) })}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{t("email.contact.last", { date: showDate(contact.last_contacted_at) })}</span>
          </div>
        </div>
      )}

      {/* Recent threads */}
      <div className="border-t border-border-secondary px-4 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          {t("email.contact.recentThreads")}
        </h3>
        {recentThreads.length === 0 ? (
          <p className="text-xs text-text-tertiary">{t("email.contact.noRecentThreads")}</p>
        ) : (
          <ul className="space-y-2">
            {recentThreads.map((thread) => (
              <li key={thread.id}>
                <div className="rounded-lg px-2 py-1.5 hover:bg-bg-hover">
                  <p className="truncate text-xs font-medium text-text-primary">
                    {thread.subject || t("email.contact.noSubject")}
                  </p>
                  <p className="truncate text-[11px] text-text-tertiary">
                    {thread.snippet}
                  </p>
                  {thread.last_message_at && (
                    <p className="text-[10px] text-text-tertiary">
                      {showDate(thread.last_message_at)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
