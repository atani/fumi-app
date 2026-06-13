import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getAllFilterRules,
  saveFilterRule,
  deleteFilterRule,
} from "../../services/filters/filterEngine";
import type { FilterRule, FilterCriteria, FilterActions } from "../../types";

function generateId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_CRITERIA: FilterCriteria = {
  from: "",
  to: "",
  subject: "",
  hasAttachment: false,
};

const EMPTY_ACTIONS: FilterActions = {
  applyLabel: "",
  archive: false,
  trash: false,
  star: false,
  markRead: false,
};

export function FilterEditor() {
  const { t } = useTranslation();
  const { accounts } = useAccountStore();
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [editing, setEditing] = useState<FilterRule | null>(null);
  const [criteria, setCriteria] = useState<FilterCriteria>({ ...EMPTY_CRITERIA });
  const [actions, setActions] = useState<FilterActions>({ ...EMPTY_ACTIONS });

  const activeAccount = accounts[0];

  const loadRules = useCallback(async () => {
    if (!activeAccount) return;
    const loaded = await getAllFilterRules(activeAccount.id);
    setRules(loaded);
  }, [activeAccount]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleNew = () => {
    setEditing(null);
    setCriteria({ ...EMPTY_CRITERIA });
    setActions({ ...EMPTY_ACTIONS });
    setEditing({
      id: generateId(),
      account_id: activeAccount?.id ?? "",
      criteria: { ...EMPTY_CRITERIA },
      actions: { ...EMPTY_ACTIONS },
      enabled: true,
      created_at: new Date().toISOString(),
    });
  };

  const handleEdit = (rule: FilterRule) => {
    setEditing(rule);
    setCriteria({ ...rule.criteria });
    setActions({ ...rule.actions });
  };

  const handleCancel = () => {
    setEditing(null);
    setCriteria({ ...EMPTY_CRITERIA });
    setActions({ ...EMPTY_ACTIONS });
  };

  const handleSave = async () => {
    if (!editing) return;
    const rule: FilterRule = {
      ...editing,
      criteria: { ...criteria },
      actions: { ...actions },
    };
    await saveFilterRule(rule);
    await loadRules();
    handleCancel();
  };

  const handleDelete = async (ruleId: string) => {
    await deleteFilterRule(ruleId);
    await loadRules();
  };

  if (!activeAccount) {
    return (
      <p className="text-sm text-text-tertiary">
        {t("settingsUi.filters.noAccount")}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="filter-editor">
      {/* Existing rules list */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
              data-testid={`filter-rule-${rule.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {describeCriteria(rule.criteria)}
                </p>
                <p className="text-xs text-text-tertiary">
                  {describeActions(rule.actions)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(rule)}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  data-testid={`edit-filter-${rule.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                  data-testid={`delete-filter-${rule.id}`}
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
          data-testid="filter-form"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {rules.some((r) => r.id === editing.id)
                ? t("settingsUi.filters.editFilter")
                : t("settingsUi.filters.newFilter")}
            </h3>
            <button
              onClick={handleCancel}
              className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              data-testid="filter-cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Criteria */}
          <fieldset className="mb-4 space-y-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t("settingsUi.filters.criteria")}
            </legend>
            <label className="block">
              <span className="mb-0.5 block text-xs text-text-secondary">
                {t("settingsUi.filters.from")}
              </span>
              <input
                type="text"
                value={criteria.from ?? ""}
                onChange={(e) =>
                  setCriteria((c) => ({ ...c, from: e.target.value }))
                }
                className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                placeholder={t("settingsUi.filters.fromPlaceholder")}
                data-testid="filter-criteria-from"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-xs text-text-secondary">
                {t("settingsUi.filters.to")}
              </span>
              <input
                type="text"
                value={criteria.to ?? ""}
                onChange={(e) =>
                  setCriteria((c) => ({ ...c, to: e.target.value }))
                }
                className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                placeholder={t("settingsUi.filters.toPlaceholder")}
                data-testid="filter-criteria-to"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-xs text-text-secondary">
                {t("settingsUi.filters.subjectContains")}
              </span>
              <input
                type="text"
                value={criteria.subject ?? ""}
                onChange={(e) =>
                  setCriteria((c) => ({ ...c, subject: e.target.value }))
                }
                className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                placeholder={t("settingsUi.filters.subjectPlaceholder")}
                data-testid="filter-criteria-subject"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={criteria.hasAttachment ?? false}
                onChange={(e) =>
                  setCriteria((c) => ({
                    ...c,
                    hasAttachment: e.target.checked,
                  }))
                }
                className="rounded border-border-primary accent-accent"
                data-testid="filter-criteria-attachment"
              />
              <span className="text-xs text-text-secondary">
                {t("settingsUi.filters.hasAttachment")}
              </span>
            </label>
          </fieldset>

          {/* Actions */}
          <fieldset className="mb-4 space-y-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t("settingsUi.filters.actions")}
            </legend>
            <label className="block">
              <span className="mb-0.5 block text-xs text-text-secondary">
                {t("settingsUi.filters.applyLabel")}
              </span>
              <input
                type="text"
                value={actions.applyLabel ?? ""}
                onChange={(e) =>
                  setActions((a) => ({ ...a, applyLabel: e.target.value }))
                }
                className="w-full rounded-md border border-border-primary bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                placeholder={t("settingsUi.filters.applyLabelPlaceholder")}
                data-testid="filter-action-label"
              />
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={actions.archive ?? false}
                  onChange={(e) =>
                    setActions((a) => ({ ...a, archive: e.target.checked }))
                  }
                  className="rounded border-border-primary accent-accent"
                  data-testid="filter-action-archive"
                />
                <span className="text-xs text-text-secondary">
                  {t("settingsUi.filters.archive")}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={actions.trash ?? false}
                  onChange={(e) =>
                    setActions((a) => ({ ...a, trash: e.target.checked }))
                  }
                  className="rounded border-border-primary accent-accent"
                  data-testid="filter-action-trash"
                />
                <span className="text-xs text-text-secondary">
                  {t("settingsUi.filters.trash")}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={actions.star ?? false}
                  onChange={(e) =>
                    setActions((a) => ({ ...a, star: e.target.checked }))
                  }
                  className="rounded border-border-primary accent-accent"
                  data-testid="filter-action-star"
                />
                <span className="text-xs text-text-secondary">
                  {t("settingsUi.filters.star")}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={actions.markRead ?? false}
                  onChange={(e) =>
                    setActions((a) => ({ ...a, markRead: e.target.checked }))
                  }
                  className="rounded border-border-primary accent-accent"
                  data-testid="filter-action-markread"
                />
                <span className="text-xs text-text-secondary">
                  {t("settingsUi.filters.markAsRead")}
                </span>
              </label>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="filter-cancel-btn"
            >
              {t("settingsUi.common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              data-testid="filter-save-btn"
            >
              {t("settingsUi.common.save")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          data-testid="filter-add-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("settingsUi.filters.addRule")}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers for human-readable descriptions
// ---------------------------------------------------------------------------

function describeCriteria(c: FilterCriteria): string {
  const parts: string[] = [];
  if (c.from) parts.push(`from: ${c.from}`);
  if (c.to) parts.push(`to: ${c.to}`);
  if (c.subject) parts.push(`subject: "${c.subject}"`);
  if (c.hasAttachment) parts.push("has attachment");
  return parts.length > 0 ? parts.join(", ") : "No criteria";
}

function describeActions(a: FilterActions): string {
  const parts: string[] = [];
  if (a.applyLabel) parts.push(`label: ${a.applyLabel}`);
  if (a.archive) parts.push("archive");
  if (a.trash) parts.push("trash");
  if (a.star) parts.push("star");
  if (a.markRead) parts.push("mark read");
  return parts.length > 0 ? parts.join(", ") : "No actions";
}
