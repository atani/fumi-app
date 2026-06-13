import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, X, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getAllQuickSteps,
  saveQuickStep,
  deleteQuickStep,
} from "../../services/quickSteps/executor";
import { QUICK_STEP_PRESETS } from "../../services/quickSteps/defaults";
import type { QuickStep, QuickStepAction, QuickStepActionType } from "../../types";

function generateId(): string {
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ACTION_TYPES: { value: QuickStepActionType; label: string }[] = [
  { value: "applyLabel", label: "Apply label" },
  { value: "removeLabel", label: "Remove label" },
  { value: "archive", label: "Archive" },
  { value: "trash", label: "Trash" },
  { value: "star", label: "Star" },
  { value: "unstar", label: "Unstar" },
  { value: "markRead", label: "Mark read" },
  { value: "markUnread", label: "Mark unread" },
  { value: "forward", label: "Forward" },
  { value: "reply", label: "Reply" },
  { value: "move", label: "Move" },
  { value: "snooze", label: "Snooze" },
  { value: "mute", label: "Mute" },
  { value: "followUp", label: "Follow up" },
  { value: "categorize", label: "Categorize" },
  { value: "addTask", label: "Add task" },
  { value: "unsubscribe", label: "Unsubscribe" },
  { value: "openUrl", label: "Open URL" },
];

/** Action types that require a parameter input */
const PARAM_ACTIONS: Partial<
  Record<QuickStepActionType, { key: string; label: string; placeholder: string }>
> = {
  applyLabel: { key: "labelId", label: "Label ID", placeholder: "e.g. IMPORTANT" },
  removeLabel: { key: "labelId", label: "Label ID", placeholder: "e.g. INBOX" },
  move: { key: "destination", label: "Destination", placeholder: "e.g. ARCHIVE" },
  forward: { key: "to", label: "Forward to", placeholder: "e.g. user@example.com" },
  categorize: { key: "category", label: "Category", placeholder: "e.g. Updates" },
  openUrl: { key: "url", label: "URL", placeholder: "https://..." },
  snooze: { key: "duration", label: "Duration", placeholder: "e.g. 1h, 1d" },
};

function makeEmptyQuickStep(accountId: string): QuickStep {
  return {
    id: generateId(),
    account_id: accountId,
    name: "",
    icon: null,
    actions: [],
    shortcut: null,
    created_at: new Date().toISOString(),
  };
}

export function QuickStepEditor() {
  const { t } = useTranslation();
  const { accounts } = useAccountStore();
  const [steps, setSteps] = useState<QuickStep[]>([]);
  const [editing, setEditing] = useState<QuickStep | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const activeAccount = accounts[0];

  const loadSteps = useCallback(async () => {
    if (!activeAccount) return;
    const loaded = await getAllQuickSteps(activeAccount.id);
    setSteps(loaded);
  }, [activeAccount]);

  useEffect(() => {
    void loadSteps();
  }, [loadSteps]);

  const handleNew = () => {
    if (!activeAccount) return;
    setEditing(makeEmptyQuickStep(activeAccount.id));
  };

  const handleEdit = (qs: QuickStep) => {
    setEditing({ ...qs, actions: qs.actions.map((a) => ({ ...a })) });
  };

  const handleCancel = () => {
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    await saveQuickStep(editing);
    await loadSteps();
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await deleteQuickStep(id);
    await loadSteps();
  };

  const handleAddPreset = async (preset: (typeof QUICK_STEP_PRESETS)[number]) => {
    if (!activeAccount) return;
    const qs: QuickStep = {
      id: generateId(),
      account_id: activeAccount.id,
      name: preset.name,
      icon: preset.icon,
      actions: preset.actions.map((a) => ({ ...a })),
      shortcut: null,
      created_at: new Date().toISOString(),
    };
    await saveQuickStep(qs);
    await loadSteps();
    setShowPresets(false);
  };

  // Action editing helpers
  const addAction = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      actions: [...editing.actions, { type: "archive" }],
    });
  };

  const removeAction = (index: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      actions: editing.actions.filter((_, i) => i !== index),
    });
  };

  const updateActionType = (index: number, type: QuickStepActionType) => {
    if (!editing) return;
    const newActions = editing.actions.map((a, i) =>
      i === index ? { type, params: undefined } : a,
    );
    setEditing({ ...editing, actions: newActions });
  };

  const updateActionParam = (index: number, key: string, value: string) => {
    if (!editing) return;
    const newActions = editing.actions.map((a, i) =>
      i === index ? { ...a, params: { ...a.params, [key]: value } } : a,
    );
    setEditing({ ...editing, actions: newActions });
  };

  const moveAction = (index: number, direction: "up" | "down") => {
    if (!editing) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editing.actions.length) return;
    const newActions = [...editing.actions];
    const item = newActions[index];
    const swapItem = newActions[newIndex];
    if (item == null || swapItem == null) return;
    newActions[index] = swapItem;
    newActions[newIndex] = item;
    setEditing({ ...editing, actions: newActions });
  };

  if (!activeAccount) {
    return (
      <p className="text-sm text-text-tertiary">
        {t("settingsUi.quickSteps.noAccount")}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="quick-step-editor">
      {/* Existing quick steps list */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((qs) => (
            <div
              key={qs.id}
              className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
              data-testid={`quick-step-${qs.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-accent" />
                  <p className="truncate text-sm font-medium text-text-primary">
                    {qs.name}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {describeActions(qs.actions)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(qs)}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  data-testid={`edit-quick-step-${qs.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void handleDelete(qs.id)}
                  className="rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                  data-testid={`delete-quick-step-${qs.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor form */}
      {editing ? (
        <div
          className="rounded-lg border border-border-primary bg-bg-secondary p-4"
          data-testid="quick-step-form"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {steps.some((s) => s.id === editing.id)
                ? t("settingsUi.quickSteps.editStep")
                : t("settingsUi.quickSteps.newStep")}
            </h3>
            <button
              onClick={handleCancel}
              className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              data-testid="quick-step-cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Name */}
          <label className="mb-3 block">
            <span className="mb-0.5 block text-xs text-text-secondary">
              {t("settingsUi.quickSteps.name")}
            </span>
            <input
              type="text"
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
              className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              placeholder={t("settingsUi.quickSteps.namePlaceholder")}
              data-testid="quick-step-name"
            />
          </label>

          {/* Shortcut */}
          <label className="mb-4 block">
            <span className="mb-0.5 block text-xs text-text-secondary">
              {t("settingsUi.quickSteps.shortcut")}
            </span>
            <input
              type="text"
              value={editing.shortcut ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  shortcut: e.target.value || null,
                })
              }
              className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              placeholder={t("settingsUi.quickSteps.shortcutPlaceholder")}
              data-testid="quick-step-shortcut"
            />
          </label>

          {/* Actions */}
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t("settingsUi.quickSteps.actions")}
            </legend>
            <div className="space-y-2">
              {editing.actions.map((action, index) => {
                const paramDef = PARAM_ACTIONS[action.type];
                return (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-md border border-border-primary bg-bg-primary p-2"
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveAction(index, "up")}
                        disabled={index === 0}
                        className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-bg-hover disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveAction(index, "down")}
                        disabled={index === editing.actions.length - 1}
                        className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-bg-hover disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <select
                        value={action.type}
                        onChange={(e) =>
                          updateActionType(
                            index,
                            e.target.value as QuickStepActionType,
                          )
                        }
                        className="w-full rounded-md border border-border-primary bg-bg-secondary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
                        data-testid={`quick-step-action-type-${index}`}
                      >
                        {ACTION_TYPES.map((at) => (
                          <option key={at.value} value={at.value}>
                            {t(`settingsUi.quickSteps.action.${at.value}`)}
                          </option>
                        ))}
                      </select>
                      {paramDef != null && (
                        <input
                          type="text"
                          value={action.params?.[paramDef.key] ?? ""}
                          onChange={(e) =>
                            updateActionParam(index, paramDef.key, e.target.value)
                          }
                          className="w-full rounded-md border border-border-primary bg-bg-secondary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder={t(
                            `settingsUi.quickSteps.param.${action.type}Placeholder`,
                          )}
                          data-testid={`quick-step-action-param-${index}`}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => removeAction(index)}
                      className="rounded-md p-1 text-danger transition-colors hover:bg-danger/10"
                      data-testid={`remove-action-${index}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addAction}
              className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
              data-testid="quick-step-add-action"
            >
              <Plus className="h-3 w-3" />
              {t("settingsUi.quickSteps.addAction")}
            </button>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="quick-step-cancel-btn"
            >
              {t("settingsUi.common.cancel")}
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!editing.name.trim() || editing.actions.length === 0}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              data-testid="quick-step-save-btn"
            >
              {t("settingsUi.common.save")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            data-testid="quick-step-add-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("settingsUi.quickSteps.newStepButton")}
          </button>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            data-testid="quick-step-presets-btn"
          >
            <Zap className="h-3.5 w-3.5" />
            {t("settingsUi.quickSteps.addFromPresets")}
          </button>
        </div>
      )}

      {/* Presets dropdown */}
      {showPresets && !editing && (
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("settingsUi.quickSteps.presets")}
          </h4>
          <div className="space-y-1">
            {QUICK_STEP_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => void handleAddPreset(preset)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-hover"
                data-testid={`preset-${preset.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Zap className="h-3.5 w-3.5 text-accent" />
                <div>
                  <p className="font-medium">{preset.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {describeActions(preset.actions)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function describeActions(actions: QuickStepAction[]): string {
  if (actions.length === 0) return "No actions";
  return actions
    .map((a) => {
      const typeDef = ACTION_TYPES.find((t) => t.value === a.type);
      const label = typeDef?.label ?? a.type;
      if (a.params != null) {
        const paramValues = Object.values(a.params).filter(Boolean);
        if (paramValues.length > 0) {
          return `${label}: ${paramValues.join(", ")}`;
        }
      }
      return label;
    })
    .join(" → ");
}
