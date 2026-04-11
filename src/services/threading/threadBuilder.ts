import type { Message } from "../../types";

/**
 * JWZ threading algorithm implementation.
 *
 * Groups messages into conversation threads using Message-ID, References,
 * and In-Reply-To headers. Supports phantom containers for missing
 * references and subject-based merging as a fallback.
 *
 * Reference: https://www.jwz.org/doc/threading.html
 */

/** A container that may hold a message and links to parent/children. */
export interface Container {
  message: Message | null;
  messageId: string;
  parent: Container | null;
  children: Container[];
}

/** A computed thread: root container plus the list of messages it contains. */
export interface ThreadGroup {
  /** Stable thread ID derived from the root message's Message-ID */
  threadId: string;
  subject: string;
  messages: Message[];
}

/**
 * Parse a References or In-Reply-To header value into individual Message-IDs.
 * Message-IDs are enclosed in angle brackets: <id@domain>
 */
export function parseMessageIdList(header: string | null): string[] {
  if (!header) return [];
  const matches = header.match(/<[^>]+>/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Normalize a subject line for comparison by stripping Re:/Fwd:/Fw: prefixes
 * and leading/trailing whitespace.
 */
export function normalizeSubject(subject: string | null): string {
  if (!subject) return "";
  return subject.replace(/^(\s*(Re|Fwd|Fw)\s*:\s*)+/i, "").trim();
}

function getOrCreateContainer(
  idTable: Map<string, Container>,
  messageId: string,
): Container {
  const existing = idTable.get(messageId);
  if (existing) return existing;

  const container: Container = {
    message: null,
    messageId,
    parent: null,
    children: [],
  };
  idTable.set(messageId, container);
  return container;
}

/** Check if `ancestor` is an ancestor of `container` (prevents cycles). */
function isAncestor(ancestor: Container, container: Container): boolean {
  let current = container.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function removeFromParent(container: Container): void {
  if (!container.parent) return;
  const idx = container.parent.children.indexOf(container);
  if (idx !== -1) {
    container.parent.children.splice(idx, 1);
  }
  container.parent = null;
}

function linkParentChild(parent: Container, child: Container): void {
  // Prevent cycles
  if (child === parent || isAncestor(child, parent)) return;

  removeFromParent(child);
  child.parent = parent;
  parent.children.push(child);
}

/**
 * Build threads from a list of messages using the JWZ algorithm.
 *
 * Steps:
 * 1. Build an ID table mapping Message-ID → Container
 * 2. Link containers via References/In-Reply-To
 * 3. Find root containers (no parent)
 * 4. Merge roots by normalized subject (fallback for broken headers)
 * 5. Flatten each root tree into a ThreadGroup
 */
export function buildThreads(messages: Message[]): ThreadGroup[] {
  const idTable = new Map<string, Container>();

  // Step 1 & 2: For each message, create/find its container, then link references
  for (const msg of messages) {
    const msgId =
      msg.message_id_header ?? msg.header_message_id ?? `synth-${msg.id}`;
    const container = getOrCreateContainer(idTable, msgId);
    container.message = msg;

    // Build the reference chain
    const refs = parseMessageIdList(msg.references_header);
    const inReplyTo = parseMessageIdList(msg.in_reply_to_header);

    // Combine references: References header first, then In-Reply-To
    const allRefs = [...refs];
    for (const r of inReplyTo) {
      if (!allRefs.includes(r)) {
        allRefs.push(r);
      }
    }

    // Link successive references as parent→child
    let prevContainer: Container | null = null;
    for (const refId of allRefs) {
      const refContainer = getOrCreateContainer(idTable, refId);
      if (prevContainer && !refContainer.parent) {
        linkParentChild(prevContainer, refContainer);
      }
      prevContainer = refContainer;
    }

    // Link the last reference as parent of this message's container
    if (prevContainer && prevContainer !== container) {
      linkParentChild(prevContainer, container);
    }
  }

  // Step 3: Find root set (containers with no parent)
  const roots: Container[] = [];
  for (const container of idTable.values()) {
    if (!container.parent) {
      roots.push(container);
    }
  }

  // Step 4: Subject-based merging for roots with matching normalized subjects
  const subjectTable = new Map<string, Container>();
  for (const root of roots) {
    const subject = normalizeSubject(getContainerSubject(root));
    if (!subject) continue;

    const existing = subjectTable.get(subject);
    if (!existing) {
      subjectTable.set(subject, root);
      continue;
    }

    // Merge: make one the child of the other
    // Prefer the container that has a real message as the parent
    if (!existing.message && root.message) {
      // Existing is phantom — replace it as the subject table entry,
      // and adopt its children. Copy array to avoid mutation during iteration.
      subjectTable.set(subject, root);
      for (const child of [...existing.children]) {
        linkParentChild(root, child);
      }
    } else if (existing.message && !root.message) {
      // Root is phantom — adopt its children under existing.
      // Copy array to avoid mutation during iteration.
      for (const child of [...root.children]) {
        linkParentChild(existing, child);
      }
    } else {
      // Both have messages — make root a child of existing
      linkParentChild(existing, root);
    }
  }

  // Rebuild roots after merging
  const finalRoots: Container[] = [];
  const seen = new Set<Container>();
  for (const container of idTable.values()) {
    if (!container.parent) {
      if (!seen.has(container)) {
        seen.add(container);
        finalRoots.push(container);
      }
    }
  }

  // Step 5: Flatten each root tree into a ThreadGroup
  return finalRoots.map((root) => flattenToThreadGroup(root));
}

/** Get the subject from a container, checking the container itself and its children. */
function getContainerSubject(container: Container): string | null {
  if (container.message?.subject) return container.message.subject;
  for (const child of container.children) {
    const s = getContainerSubject(child);
    if (s) return s;
  }
  return null;
}

/** Collect all real messages from a container tree, sorted by date. */
function collectMessages(container: Container): Message[] {
  const result: Message[] = [];

  function walk(c: Container): void {
    if (c.message) {
      result.push(c.message);
    }
    for (const child of c.children) {
      walk(child);
    }
  }

  walk(container);

  // Sort by date ascending
  result.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });

  return result;
}

function flattenToThreadGroup(root: Container): ThreadGroup {
  const messages = collectMessages(root);
  const firstMessage = messages[0];

  const subject = normalizeSubject(
    getContainerSubject(root),
  ) || firstMessage?.subject || "(No subject)";

  // Thread ID: use the root's message ID to keep it stable
  const threadId = `thread-${root.messageId}`;

  return {
    threadId,
    subject,
    messages,
  };
}

/**
 * Incrementally add new messages to existing thread groups.
 * Returns updated thread groups (existing ones modified in place, new ones appended).
 */
export function mergeIntoThreads(
  existingThreads: ThreadGroup[],
  newMessages: Message[],
): ThreadGroup[] {
  if (newMessages.length === 0) return existingThreads;

  // Collect all messages from existing threads plus the new ones
  const allMessages: Message[] = [];
  for (const thread of existingThreads) {
    allMessages.push(...thread.messages);
  }
  allMessages.push(...newMessages);

  // Rebuild threads from scratch — JWZ is idempotent
  return buildThreads(allMessages);
}
