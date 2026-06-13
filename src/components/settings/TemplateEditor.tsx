import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../../services/db/templates";
import type { Template } from "../../types";

function generateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TemplateEditor() {
  const { t: translate } = useTranslation();
  const { getActiveAccount } = useAccountStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) return;
    const data = await getAllTemplates(account.id);
    setTemplates(data);
  }, [getActiveAccount]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!editName.trim()) return;
    const account = getActiveAccount();
    await createTemplate({
      id: generateId(),
      account_id: account?.id ?? null,
      name: editName.trim(),
      subject: editSubject.trim() || null,
      body: editBody.trim() || null,
    });
    resetForm();
    await load();
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateTemplate(editingId, {
      name: editName.trim(),
      subject: editSubject.trim() || null,
      body: editBody.trim() || null,
    });
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    await load();
  };

  const startEdit = (template: Template) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditSubject(template.subject ?? "");
    setEditBody(template.body ?? "");
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditName("");
    setEditSubject("");
    setEditBody("");
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditName("");
    setEditSubject("");
    setEditBody("");
  };

  const isFormOpen = isAdding || editingId !== null;

  return (
    <div className="space-y-3">
      {/* List */}
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
          data-testid={`template-item-${t.id}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{t.name}</p>
            {t.subject && (
              <p className="truncate text-xs text-text-tertiary">{t.subject}</p>
            )}
          </div>
          <button
            onClick={() => startEdit(t)}
            className="rounded p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            data-testid={`template-edit-${t.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            className="rounded p-1.5 text-text-tertiary hover:bg-danger/10 hover:text-danger"
            data-testid={`template-delete-${t.id}`}
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
            placeholder={translate("settingsUi.templates.namePlaceholder")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="template-name-input"
          />
          <input
            type="text"
            placeholder={translate("settingsUi.templates.subjectPlaceholder")}
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="template-subject-input"
          />
          <textarea
            placeholder={translate("settingsUi.templates.bodyPlaceholder")}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="template-body-input"
          />
          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleAdd}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              data-testid="template-save"
            >
              <Check className="h-3.5 w-3.5" />
              {editingId
                ? translate("settingsUi.templates.update")
                : translate("settingsUi.templates.save")}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-1 rounded-lg border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
              data-testid="template-cancel"
            >
              <X className="h-3.5 w-3.5" />
              {translate("settingsUi.templates.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isFormOpen && (
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-primary px-3 py-2 text-sm text-text-secondary hover:border-accent hover:text-accent"
          data-testid="template-add-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          {translate("settingsUi.templates.addTemplate")}
        </button>
      )}
    </div>
  );
}
