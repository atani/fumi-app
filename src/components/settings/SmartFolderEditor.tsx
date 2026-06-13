import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useSmartFolderStore } from "../../stores/smartFolderStore";
import type { SmartFolder } from "../../types";

export function SmartFolderEditor() {
  const { t } = useTranslation();
  const { activeAccountId } = useAccountStore();
  const { folders, loadFolders, createFolder, updateFolder, deleteFolder } =
    useSmartFolderStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [icon, setIcon] = useState("");

  useEffect(() => {
    if (activeAccountId) {
      void loadFolders(activeAccountId);
    }
  }, [activeAccountId, loadFolders]);

  const resetForm = useCallback(() => {
    setName("");
    setQuery("");
    setIcon("");
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!activeAccountId || !name.trim() || !query.trim()) return;

    const folder: SmartFolder = {
      id: crypto.randomUUID(),
      account_id: activeAccountId,
      name: name.trim(),
      query: query.trim(),
      icon: icon.trim() || null,
      sort_order: folders.length,
      created_at: new Date().toISOString(),
    };

    await createFolder(folder);
    resetForm();
  }, [activeAccountId, name, query, icon, folders.length, createFolder, resetForm]);

  const handleUpdate = useCallback(async () => {
    if (!activeAccountId || !editingId || !name.trim() || !query.trim()) return;

    await updateFolder(editingId, activeAccountId, {
      name: name.trim(),
      query: query.trim(),
      icon: icon.trim() || null,
    });
    resetForm();
  }, [activeAccountId, editingId, name, query, icon, updateFolder, resetForm]);

  const handleEdit = useCallback(
    (folder: SmartFolder) => {
      setEditingId(folder.id);
      setName(folder.name);
      setQuery(folder.query);
      setIcon(folder.icon ?? "");
      setIsAdding(false);
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!activeAccountId) return;
      await deleteFolder(id, activeAccountId);
    },
    [activeAccountId, deleteFolder],
  );

  const isEditing = isAdding || editingId !== null;

  return (
    <div className="space-y-3">
      {folders.map((folder) =>
        editingId === folder.id ? (
          <FolderForm
            key={folder.id}
            name={name}
            query={query}
            icon={icon}
            onNameChange={setName}
            onQueryChange={setQuery}
            onIconChange={setIcon}
            onSave={() => void handleUpdate()}
            onCancel={resetForm}
          />
        ) : (
          <div
            key={folder.id}
            className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-4 py-3"
            data-testid={`smart-folder-${folder.id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {folder.name}
              </p>
              <p className="truncate text-xs text-text-tertiary">
                {folder.query}
              </p>
            </div>
            <div className="ml-2 flex items-center gap-1">
              <button
                onClick={() => handleEdit(folder)}
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                title={t("settingsUi.smartFolders.edit")}
                data-testid={`edit-smart-folder-${folder.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => void handleDelete(folder.id)}
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-danger"
                title={t("settingsUi.smartFolders.delete")}
                data-testid={`delete-smart-folder-${folder.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ),
      )}

      {isAdding && (
        <FolderForm
          name={name}
          query={query}
          icon={icon}
          onNameChange={setName}
          onQueryChange={setQuery}
          onIconChange={setIcon}
          onSave={() => void handleCreate()}
          onCancel={resetForm}
        />
      )}

      {!isEditing && (
        <button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
          data-testid="add-smart-folder-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("settingsUi.smartFolders.addFolder")}
        </button>
      )}

      <p className="text-xs text-text-tertiary">
        {t("settingsUi.smartFolders.tokensHintPrefix")}
        <code>__TODAY__</code>, <code>__LAST_7_DAYS__</code>,{" "}
        <code>__LAST_30_DAYS__</code>
        {t("settingsUi.smartFolders.tokensHintSuffix")}
      </p>
    </div>
  );
}

function FolderForm({
  name,
  query,
  icon,
  onNameChange,
  onQueryChange,
  onIconChange,
  onSave,
  onCancel,
}: {
  name: string;
  query: string;
  icon: string;
  onNameChange: (v: string) => void;
  onQueryChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("settingsUi.smartFolders.namePlaceholder")}
        className="w-full rounded-md border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="smart-folder-name-input"
        autoFocus
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t("settingsUi.smartFolders.queryPlaceholder")}
        className="w-full rounded-md border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="smart-folder-query-input"
      />
      <input
        type="text"
        value={icon}
        onChange={(e) => onIconChange(e.target.value)}
        placeholder={t("settingsUi.smartFolders.iconPlaceholder")}
        className="w-full rounded-md border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="smart-folder-icon-input"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          title={t("settingsUi.smartFolders.cancel")}
          data-testid="smart-folder-cancel-btn"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={onSave}
          disabled={!name.trim() || !query.trim()}
          className="rounded-md p-1.5 text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          title={t("settingsUi.smartFolders.save")}
          data-testid="smart-folder-save-btn"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
