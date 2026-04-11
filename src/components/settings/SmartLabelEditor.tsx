import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useLabelStore } from "../../stores/labelStore";
import {
  getAllSmartLabelRules,
  saveSmartLabelRule,
  deleteSmartLabelRule,
} from "../../services/smartLabels/smartLabelService";
import { backfillSmartLabels } from "../../services/smartLabels/backfillService";
import type { SmartLabelRule } from "../../types";

interface RuleForm {
  id: string;
  label_id: string;
  description: string;
  senderPattern: string;
  subjectPattern: string;
  enabled: boolean;
}

function generateId(): string {
  return `slr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ruleToForm(rule: SmartLabelRule): RuleForm {
  let senderPattern = "";
  let subjectPattern = "";
  try {
    const criteria = JSON.parse(rule.criteria) as {
      senderPattern?: string;
      subjectPattern?: string;
    };
    senderPattern = criteria.senderPattern ?? "";
    subjectPattern = criteria.subjectPattern ?? "";
  } catch {
    // ignore
  }
  return {
    id: rule.id,
    label_id: rule.label_id,
    description: rule.description,
    senderPattern,
    subjectPattern,
    enabled: rule.enabled,
  };
}

function formToRule(form: RuleForm, accountId: string): SmartLabelRule {
  const criteria: Record<string, string> = {};
  if (form.senderPattern.trim()) {
    criteria.senderPattern = form.senderPattern.trim();
  }
  if (form.subjectPattern.trim()) {
    criteria.subjectPattern = form.subjectPattern.trim();
  }
  return {
    id: form.id,
    account_id: accountId,
    label_id: form.label_id,
    description: form.description,
    criteria: JSON.stringify(criteria),
    enabled: form.enabled,
  };
}

export function SmartLabelEditor() {
  const [rules, setRules] = useState<RuleForm[]>([]);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const { userLabels } = useLabelStore();

  const accountId = activeAccountId ?? accounts[0]?.id ?? null;

  useEffect(() => {
    if (!accountId) return;
    void getAllSmartLabelRules(accountId).then((loaded) => {
      setRules(loaded.map(ruleToForm));
    });
  }, [accountId]);

  const handleAdd = useCallback(() => {
    const defaultLabel = userLabels[0]?.id ?? "";
    setRules((prev) => [
      ...prev,
      {
        id: generateId(),
        label_id: defaultLabel,
        description: "",
        senderPattern: "",
        subjectPattern: "",
        enabled: true,
      },
    ]);
  }, [userLabels]);

  const handleSave = useCallback(
    async (form: RuleForm) => {
      if (!accountId) return;
      const rule = formToRule(form, accountId);
      await saveSmartLabelRule(rule);
    },
    [accountId],
  );

  const handleDelete = useCallback(
    async (ruleId: string) => {
      await deleteSmartLabelRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    },
    [],
  );

  const handleFieldChange = useCallback(
    (ruleId: string, field: keyof RuleForm, value: string | boolean) => {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const handleBackfill = useCallback(async () => {
    if (!accountId) return;
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const count = await backfillSmartLabels(accountId);
      setBackfillResult(
        count > 0
          ? `Applied labels to ${count} thread${count === 1 ? "" : "s"}.`
          : "No threads needed labeling.",
      );
    } catch (err) {
      setBackfillResult(
        err instanceof Error ? err.message : "Backfill failed",
      );
    } finally {
      setIsBackfilling(false);
    }
  }, [accountId]);

  if (!accountId) {
    return (
      <p className="text-sm text-text-tertiary">
        Add an account to configure smart labels.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="smart-label-editor">
      <p className="text-xs text-text-tertiary">
        Smart labels automatically classify incoming emails. Define criteria for
        fast matching, or let AI classify messages that do not match any
        pattern.
      </p>

      {rules.map((rule) => (
        <div
          key={rule.id}
          className="space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-4"
          data-testid={`smart-label-rule-${rule.id}`}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) =>
                  handleFieldChange(rule.id, "enabled", e.target.checked)
                }
                className="rounded"
              />
              <span className="text-text-secondary">Enabled</span>
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => void handleSave(rule)}
                title="Save rule"
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-accent"
                data-testid={`save-rule-${rule.id}`}
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={() => void handleDelete(rule.id)}
                title="Delete rule"
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-danger"
                data-testid={`delete-rule-${rule.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">
              Label
            </label>
            <select
              value={rule.label_id}
              onChange={(e) =>
                handleFieldChange(rule.id, "label_id", e.target.value)
              }
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              {userLabels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">
              Description (used for AI classification)
            </label>
            <input
              type="text"
              value={rule.description}
              onChange={(e) =>
                handleFieldChange(rule.id, "description", e.target.value)
              }
              placeholder="e.g. Emails about project updates from the team"
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">
                Sender pattern (fast path)
              </label>
              <input
                type="text"
                value={rule.senderPattern}
                onChange={(e) =>
                  handleFieldChange(rule.id, "senderPattern", e.target.value)
                }
                placeholder="e.g. @company.com"
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">
                Subject pattern (fast path)
              </label>
              <input
                type="text"
                value={rule.subjectPattern}
                onChange={(e) =>
                  handleFieldChange(rule.id, "subjectPattern", e.target.value)
                }
                placeholder="e.g. [weekly-report]"
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          data-testid="add-smart-label-rule"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </button>
        <button
          onClick={() => void handleBackfill()}
          disabled={isBackfilling || rules.length === 0}
          className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50"
          data-testid="backfill-smart-labels"
        >
          {isBackfilling ? "Processing..." : "Apply to existing emails"}
        </button>
      </div>

      {backfillResult && (
        <p className="text-xs text-text-secondary">{backfillResult}</p>
      )}
    </div>
  );
}
