/**
 * Thrown when an AI feature is used before the user has configured a provider
 * and API key. UI components detect this to show a "set up AI" prompt (with a
 * link to Settings) instead of a raw error string.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set an API key in Settings.");
    this.name = "AiNotConfiguredError";
  }
}
