import { useState, useMemo } from "react";
import { ArrowLeft, HelpCircle, BookOpen } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { helpCategories } from "../../constants/helpContent";
import { HelpCard } from "./HelpCard";
import { HelpSearchBar } from "./HelpSearchBar";

export function HelpPage() {
  const navigate = useNavigate();
  const { topic } = useParams<{ topic: string }>();
  const [search, setSearch] = useState("");

  // Determine selected category: from URL param or first category
  const activeCategoryId = topic ?? helpCategories[0]?.id ?? "getting-started";

  const activeCategory = useMemo(
    () => helpCategories.find((c) => c.id === activeCategoryId),
    [activeCategoryId],
  );

  // Filter cards across all categories when searching
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return helpCategories.flatMap((cat) =>
      cat.cards.filter(
        (card) =>
          card.title.toLowerCase().includes(q) ||
          card.description.toLowerCase().includes(q) ||
          card.steps?.some((s) => s.toLowerCase().includes(q)),
      ),
    );
  }, [search]);

  return (
    <div className="flex h-screen flex-col bg-bg-primary" data-testid="help-page">
      {/* Title bar drag region */}
      <div
        className="h-10 shrink-0"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-6 pb-4">
        <button
          onClick={() => navigate("/")}
          className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          aria-label="Back to mail"
          data-testid="help-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <BookOpen className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold text-text-primary">Help</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border-primary bg-sidebar-bg">
          <div className="p-3">
            <HelpSearchBar value={search} onChange={setSearch} />
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
            {helpCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSearch("");
                  navigate(`/help/${cat.id}`);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  !search && activeCategoryId === cat.id
                    ? "bg-bg-selected font-medium text-accent"
                    : "text-sidebar-text hover:bg-bg-hover"
                }`}
                data-testid={`help-category-${cat.id}`}
              >
                {cat.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {searchResults ? (
            <>
              <h2 className="mb-4 text-lg font-semibold text-text-primary">
                Search results
                <span className="ml-2 text-sm font-normal text-text-tertiary">
                  ({searchResults.length} {searchResults.length === 1 ? "result" : "results"})
                </span>
              </h2>
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center py-16">
                  <HelpCircle className="mb-3 h-12 w-12 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">
                    No results found for &ldquo;{search}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((card) => (
                    <HelpCard key={card.id} card={card} />
                  ))}
                </div>
              )}
            </>
          ) : activeCategory ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">
                  {activeCategory.title}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {activeCategory.description}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeCategory.cards.map((card) => (
                  <HelpCard key={card.id} card={card} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-16">
              <HelpCircle className="mb-3 h-12 w-12 text-text-tertiary" />
              <p className="text-sm text-text-secondary">
                Select a category from the sidebar.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
