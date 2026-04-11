import { useThreadStore } from "../../stores/threadStore";
import { Reply, ReplyAll, Forward, Archive, Trash2, Star } from "lucide-react";
import { EmailRenderer } from "../email/EmailRenderer";

export function ReadingPane() {
  const { messages } = useThreadStore();

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg-primary">
        <p className="text-text-tertiary">Loading messages...</p>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden bg-bg-primary"
      data-testid="reading-pane"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-3">
        <h2 className="text-lg font-semibold text-text-primary">
          {lastMessage?.subject || "(No subject)"}
        </h2>
        <div className="flex items-center gap-1">
          {[Archive, Star, Trash2].map((Icon, i) => (
            <button
              key={i}
              className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className="border-b border-border-secondary px-6 py-4"
            data-testid={`message-${message.id}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-text-primary">
                  {message.from_name || message.from_address}
                </span>
                {message.from_name && (
                  <span className="ml-2 text-sm text-text-tertiary">
                    &lt;{message.from_address}&gt;
                  </span>
                )}
              </div>
              <span className="text-xs text-text-tertiary">
                {message.date
                  ? new Date(message.date).toLocaleString()
                  : ""}
              </span>
            </div>

            <div className="mt-1 text-xs text-text-secondary">
              To: {message.to_addresses}
            </div>

            <div className="mt-4 text-sm text-text-primary">
              <EmailRenderer
                html={message.body_html}
                text={message.body_text ?? message.snippet}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Quick reply actions */}
      <div className="flex gap-2 border-t border-border-primary px-6 py-3">
        <button className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">
          <Reply className="h-4 w-4" /> Reply
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">
          <ReplyAll className="h-4 w-4" /> Reply All
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">
          <Forward className="h-4 w-4" /> Forward
        </button>
      </div>
    </div>
  );
}
