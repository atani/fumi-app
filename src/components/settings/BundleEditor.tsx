import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getAllBundleRules,
  saveBundleRule,
  deleteBundleRule,
} from "../../services/bundles/bundleManager";
import type { BundleRule } from "../../types";

function generateId(): string {
  return `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function BundleEditor() {
  const { getActiveAccount } = useAccountStore();
  const [rules, setRules] = useState<BundleRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [senderPattern, setSenderPattern] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [schedule, setSchedule] = useState<BundleRule["schedule"]>("daily");
  const [enabled, setEnabled] = useState(true);

  const loadRules = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) return;
    const loaded = await getAllBundleRules(account.id);
    setRules(loaded);
  }, [getActiveAccount]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const resetForm = useCallback(() => {
    setSenderPattern("");
    setBundleName("");
    setSchedule("daily");
    setEnabled(true);
    setEditingId(null);
    setIsAdding(false);
  }, []);

  const startEditing = useCallback((rule: BundleRule) => {
    setEditingId(rule.id);
    setSenderPattern(rule.sender_pattern);
    setBundleName(rule.bundle_name);
    setSchedule(rule.schedule);
    setEnabled(rule.enabled);
    setIsAdding(false);
  }, []);

  const startAdding = useCallback(() => {
    resetForm();
    setIsAdding(true);
  }, [resetForm]);

  const handleSave = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) return;
    if (!senderPattern.trim() || !bundleName.trim()) return;

    const rule: BundleRule = {
      id: editingId ?? generateId(),
      account_id: account.id,
      sender_pattern: senderPattern.trim(),
      bundle_name: bundleName.trim(),
      schedule,
      enabled,
    };

    await saveBundleRule(rule);
    resetForm();
    await loadRules();
  }, [
    getActiveAccount,
    editingId,
    senderPattern,
    bundleName,
    schedule,
    enabled,
    resetForm,
    loadRules,
  ]);

  const handleDelete = useCallback(
    async (ruleId: string) => {
      await deleteBundleRule(ruleId);
      await loadRules();
    },
    [loadRules],
  );

  const isFormVisible = isAdding || editingId !== null;

  return (
    <div data-testid="bundle-editor">
      {/* Rule list */}
      {rules.length === 0 && !isFormVisible && (
        <p className="text-sm text-text-tertiary">
          No bundle rules configured. Bundle newsletters and bulk senders to
          receive them on a schedule.
        </p>
      )}

      {rules.map((rule) =>
        editingId === rule.id ? null : (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 mb-2"
            data-testid={`bundle-rule-${rule.id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {rule.bundle_name}
              </p>
              <p className="truncate text-xs text-text-tertiary">
                {rule.sender_pattern} &middot; {rule.schedule}
                {!rule.enabled && " (disabled)"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => startEditing(rule)}
                className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                aria-label="Edit rule"
                data-testid={`edit-bundle-${rule.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => void handleDelete(rule.id)}
                className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-danger"
                aria-label="Delete rule"
                data-testid={`delete-bundle-${rule.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ),
      )}

      {/* Add / Edit form */}
      {isFormVisible && (
        <div
          className="rounded-lg border border-border-primary bg-bg-secondary p-4 mb-2 space-y-3"
          data-testid="bundle-form"
        >
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Bundle name
            </label>
            <input
              type="text"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              placeholder="e.g. Newsletters"
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="bundle-name-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Sender pattern
            </label>
            <input
              type="text"
              value={senderPattern}
              onChange={(e) => setSenderPattern(e.target.value)}
              placeholder="e.g. *@newsletter.example.com"
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="bundle-pattern-input"
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Use * as a wildcard. Example: *@example.com matches all senders
              from that domain.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Delivery schedule
            </label>
            <select
              value={schedule}
              onChange={(e) =>
                setSchedule(e.target.value as BundleRule["schedule"])
              }
              className="rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              data-testid="bundle-schedule-select"
            >
              <option value="instant">Instant (no bundling)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bundle-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-accent"
              data-testid="bundle-enabled-checkbox"
            />
            <label
              htmlFor="bundle-enabled"
              className="text-sm text-text-secondary"
            >
              Enabled
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => void handleSave()}
              disabled={!senderPattern.trim() || !bundleName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              data-testid="bundle-save-btn"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="bundle-cancel-btn"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isFormVisible && (
        <button
          onClick={startAdding}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-border-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
          data-testid="add-bundle-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          Add bundle rule
        </button>
      )}
    </div>
  );
}
