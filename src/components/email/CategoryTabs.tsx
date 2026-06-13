import { useTranslation } from "react-i18next";
import { useThreadStore } from "../../stores/threadStore";
import type { ThreadCategory } from "../../services/ai/aiService";

const CATEGORIES: ThreadCategory[] = [
  "Primary",
  "Updates",
  "Promotions",
  "Social",
  "Newsletters",
];

export function CategoryTabs() {
  const { t } = useTranslation();
  const { activeCategory, setActiveCategory, categoryCounts } =
    useThreadStore();

  return (
    <div
      className="flex border-b border-border-primary bg-bg-primary"
      role="tablist"
      aria-label={t("email.categories.ariaLabel")}
    >
      {CATEGORIES.map((category) => {
        const isActive = activeCategory === category;
        const count = categoryCounts[category] ?? 0;

        return (
          <button
            key={category}
            role="tab"
            aria-selected={isActive}
            onClick={() =>
              setActiveCategory(isActive ? null : category)
            }
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              isActive
                ? "border-b-2 border-accent text-accent"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            data-testid={`category-tab-${category}`}
          >
            {t(`email.categories.${category}`)}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isActive
                    ? "bg-accent-light text-accent"
                    : "bg-bg-secondary text-text-tertiary"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
