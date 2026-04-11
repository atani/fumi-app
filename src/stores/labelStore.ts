import { create } from "zustand";
import type { Label, Account } from "../types";
import {
  getLabelsByAccount,
  upsertLabel,
  deleteLabelFromDb,
} from "../services/db/labels";
import {
  createGmailLabel,
  updateGmailLabel,
  deleteGmailLabel,
} from "../services/gmail/labels";

/** Gmail system label IDs that should not be editable or deletable. */
const SYSTEM_LABEL_IDS = new Set([
  "INBOX",
  "STARRED",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
  "IMPORTANT",
  "UNREAD",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "CHAT",
]);

interface LabelState {
  labels: Label[];
  systemLabels: Label[];
  userLabels: Label[];

  loadLabels: (accountId: string) => Promise<void>;
  createLabel: (account: Account, name: string, color: string | null) => Promise<void>;
  updateLabel: (account: Account, labelId: string, name: string, color: string | null) => Promise<void>;
  deleteLabel: (account: Account, labelId: string) => Promise<void>;
}

function partitionLabels(labels: Label[]): {
  systemLabels: Label[];
  userLabels: Label[];
} {
  const systemLabels: Label[] = [];
  const userLabels: Label[] = [];
  for (const label of labels) {
    if (label.type === "system" || SYSTEM_LABEL_IDS.has(label.id)) {
      systemLabels.push(label);
    } else {
      userLabels.push(label);
    }
  }
  return { systemLabels, userLabels };
}

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: [],
  systemLabels: [],
  userLabels: [],

  loadLabels: async (accountId) => {
    const labels = await getLabelsByAccount(accountId);
    const { systemLabels, userLabels } = partitionLabels(labels);
    set({ labels, systemLabels, userLabels });
  },

  createLabel: async (account, name, color) => {
    // Create via Gmail API first to get the server-assigned ID
    const gmailLabel = await createGmailLabel(account, name, color ?? undefined);

    const label: Label = {
      id: gmailLabel.id,
      account_id: account.id,
      name,
      type: "user",
      color,
    };

    await upsertLabel(label);

    const labels = [...get().labels, label];
    const { systemLabels, userLabels } = partitionLabels(labels);
    set({ labels, systemLabels, userLabels });
  },

  updateLabel: async (account, labelId, name, color) => {
    await updateGmailLabel(account, labelId, name, color ?? undefined);

    const labels = get().labels.map((l) =>
      l.id === labelId && l.account_id === account.id
        ? { ...l, name, color }
        : l,
    );

    // Persist the update locally
    const updated = labels.find(
      (l) => l.id === labelId && l.account_id === account.id,
    );
    if (updated) {
      await upsertLabel(updated);
    }

    const { systemLabels, userLabels } = partitionLabels(labels);
    set({ labels, systemLabels, userLabels });
  },

  deleteLabel: async (account, labelId) => {
    await deleteGmailLabel(account, labelId);
    await deleteLabelFromDb(labelId, account.id);

    const labels = get().labels.filter(
      (l) => !(l.id === labelId && l.account_id === account.id),
    );
    const { systemLabels, userLabels } = partitionLabels(labels);
    set({ labels, systemLabels, userLabels });
  },
}));
