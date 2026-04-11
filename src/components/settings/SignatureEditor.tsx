import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X, Star } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getAllSignatures,
  createSignature,
  updateSignature,
  deleteSignature,
} from "../../services/db/signatures";
import type { Signature } from "../../types";

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SignatureEditor() {
  const { getActiveAccount } = useAccountStore();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) return;
    const data = await getAllSignatures(account.id);
    setSignatures(data);
  }, [getActiveAccount]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!editName.trim() || !editBody.trim()) return;
    const account = getActiveAccount();
    await createSignature({
      id: generateId(),
      account_id: account?.id ?? null,
      name: editName.trim(),
      body: editBody.trim(),
      is_default: editIsDefault ? 1 : 0,
    });
    resetForm();
    await load();
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim() || !editBody.trim()) return;
    const account = getActiveAccount();
    await updateSignature(
      editingId,
      {
        name: editName.trim(),
        body: editBody.trim(),
        is_default: editIsDefault ? 1 : 0,
      },
      account?.id ?? null,
    );
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteSignature(id);
    await load();
  };

  const handleSetDefault = async (signature: Signature) => {
    const account = getActiveAccount();
    await updateSignature(
      signature.id,
      { is_default: 1 },
      account?.id ?? null,
    );
    await load();
  };

  const startEdit = (signature: Signature) => {
    setEditingId(signature.id);
    setEditName(signature.name);
    setEditBody(signature.body);
    setEditIsDefault(signature.is_default === 1);
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditName("");
    setEditBody("");
    setEditIsDefault(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditName("");
    setEditBody("");
    setEditIsDefault(false);
  };

  const isFormOpen = isAdding || editingId !== null;

  return (
    <div className="space-y-3">
      {/* List */}
      {signatures.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
          data-testid={`signature-item-${s.id}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-text-primary">{s.name}</p>
              {s.is_default === 1 && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  default
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-tertiary">{s.body}</p>
          </div>
          {s.is_default !== 1 && (
            <button
              onClick={() => handleSetDefault(s)}
              className="rounded p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-accent"
              title="Set as default"
              data-testid={`signature-set-default-${s.id}`}
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => startEdit(s)}
            className="rounded p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            data-testid={`signature-edit-${s.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(s.id)}
            className="rounded p-1.5 text-text-tertiary hover:bg-danger/10 hover:text-danger"
            data-testid={`signature-delete-${s.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Form */}
      {isFormOpen && (
        <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-4">
          <input
            type="text"
            placeholder="Signature name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="signature-name-input"
          />
          <textarea
            placeholder="Signature body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="signature-body-input"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={editIsDefault}
              onChange={(e) => setEditIsDefault(e.target.checked)}
              className="rounded"
              data-testid="signature-default-checkbox"
            />
            Set as default signature
          </label>
          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleAdd}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              data-testid="signature-save"
            >
              <Check className="h-3.5 w-3.5" />
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-1 rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
              data-testid="signature-cancel"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isFormOpen && (
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-primary px-3 py-2 text-sm text-text-secondary hover:border-accent hover:text-accent"
          data-testid="signature-add-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          Add signature
        </button>
      )}
    </div>
  );
}
