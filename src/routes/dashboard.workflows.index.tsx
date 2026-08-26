import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { TemplateCard } from "@/components/workflows/template-card";
import { TemplateDetailModal } from "@/components/workflows/template-detail-modal";
import { FilterDropdown } from "@/components/workflows/filter-dropdown";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import { ConfirmDialog } from "@/components/workflows/confirm-dialog";
import { activateTemplate, useTemplates, type PortalTemplate } from "@/hooks/useTemplates";
import {
  deleteWorkflow,
  duplicateWorkflow,
  renameWorkflow,
  setWorkflowStatus,
  useWorkflows,
  type PortalWorkflow,
} from "@/hooks/useWorkflows";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeInput } from "@/lib/sanitize";
import { useSaveAction } from "@/hooks/useSaveAction";
import {
  collectCategoryOptions,
  collectPlatformOptions,
  hasActiveFilters,
  matchesFilters,
  matchesSearch,
  toggleValue,
  UNCATEGORISED,
  type FilterState,
} from "@/lib/workflow/filters";
import { isLockedForTier } from "@/lib/workflow/plan-access";
import { usePlanUsage } from "@/hooks/usePlanUsage";

type WorkflowTab = "templates" | "mine";

/** How many templates the Recommended shelf shows at most. */
const RECOMMENDED_LIMIT = 3;

export const Route = createFileRoute("/dashboard/workflows/")({
  validateSearch: (search: Record<string, unknown>): { tab?: WorkflowTab } => {
    if (search["tab"] === "mine") return { tab: "mine" };
    if (search["tab"] === "templates") return { tab: "templates" };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Workflows — Synkra Client Portal" },
      { name: "description", content: "Browse Synkra templates and manage your own workflows." },
      { property: "og:title", content: "Workflows — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Browse Synkra templates and manage your own workflows.",
      },
    ],
  }),
  component: WorkflowsPage,
});

const STATUSES = [
  { key: "All", value: "all" },
  { key: "Running", value: "published" },
  { key: "Paused", value: "paused" },
  { key: "Draft", value: "draft" },
  { key: "Error", value: "error" },
];
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "runs", label: "Most runs" },
  { value: "active", label: "Recently active" },
];

function FilterButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="synkra-focus shrink-0 transition-colors"
      style={{
        backgroundColor: selected ? "var(--accent-green-subtle)" : "transparent",
        border: `1px solid ${selected ? "var(--accent-green-border)" : "var(--border-default)"}`,
        color: selected ? "var(--accent-green)" : "var(--text-muted)",
        borderRadius: "var(--radius-full)",
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full">
      <Search
        size={16}
        aria-hidden="true"
        style={{ color: "var(--text-muted)", position: "absolute", left: 12, top: 12 }}
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="synkra-focus w-full"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          height: 40,
          padding: "0 12px 0 34px",
          color: "var(--text-primary)",
          fontSize: 14,
        }}
      />
    </div>
  );
}

function Shelf({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</p>
      )}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
          }}
        >
          <Shimmer height={18} width={200} />
          <div className="mt-3">
            <Shimmer height={14} />
          </div>
          <div className="mt-5">
            <Shimmer height={28} width={220} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tab } = Route.useSearch();

  const templatesQuery = useTemplates();
  const workflowsQuery = useWorkflows();

  const [filters, setFilters] = useState<FilterState>({
    query: "",
    categories: [],
    platforms: [],
  });
  const [workflowQuery, setWorkflowQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [detailTemplate, setDetailTemplate] = useState<PortalTemplate | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalWorkflow | null>(null);

  const usageQuery = usePlanUsage();
  const tier = usageQuery.data?.tier ?? "free";

  const templates = templatesQuery.data ?? [];
  const workflows = workflowsQuery.data ?? [];

  const activeTab: WorkflowTab = tab ?? "templates";

  const setTab = (next: WorkflowTab) =>
    navigate({
      to: "/dashboard/workflows",
      search: next === "templates" ? {} : { tab: next },
    });

  const templateNames = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(t.template_id, t.name));
    return map;
  }, [templates]);

  /**
   * User workflows have no category column. A workflow activated from a
   * template inherits that template's category; anything built from scratch is
   * Uncategorised.
   */
  const workflowsWithCategory = useMemo(() => {
    const categoryByTemplate = new Map<string, string>();
    templates.forEach((t) => categoryByTemplate.set(t.template_id, t.category));
    return workflows.map((workflow) => ({
      ...workflow,
      category:
        (workflow.template_id ? categoryByTemplate.get(workflow.template_id) : "") ??
        UNCATEGORISED,
    }));
  }, [workflows, templates]);

  // Filter options always come from the loaded template data, so new
  // categories and integrations become filterable with no UI change.
  const categoryOptions = useMemo(() => collectCategoryOptions(templates), [templates]);
  const platformOptions = useMemo(() => collectPlatformOptions(templates), [templates]);

  const filtersActive = hasActiveFilters(filters);

  const templateLocked = useMemo(() => {
    const map = new Map<string, boolean>();
    templates.forEach((t) => map.set(t.id, isLockedForTier(t, tier)));
    return map;
  }, [templates, tier]);

  const lockedCount = useMemo(
    () => templates.filter((t) => templateLocked.get(t.id)).length,
    [templates, templateLocked],
  );

  const visibleTemplates = useMemo(
    () => templates.filter((template) => matchesFilters(template, filters)),
    [templates, filters],
  );

  /**
   * Synkra has no popularity or personalisation data, so "Recommended" is a
   * deterministic shelf, not a fake metric: the first templates in Synkra's own
   * ordering that the current plan can actually activate and that the user has
   * not activated yet. It is hidden while filters are in use.
   */
  const recommendedTemplates = useMemo(() => {
    if (filtersActive) return [];
    return visibleTemplates
      .filter((template) => !template.isActivated && !templateLocked.get(template.id))
      .slice(0, RECOMMENDED_LIMIT);
  }, [visibleTemplates, templateLocked, filtersActive]);

  const visibleWorkflows = useMemo(() => {
    const filtered = workflowsWithCategory.filter((workflow) => {
      if (statusFilter !== "all" && workflow.status !== statusFilter) return false;
      return matchesSearch(workflow, workflowQuery);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "oldest") return (a.created ?? "").localeCompare(b.created ?? "");
      if (sort === "runs") return (b.run_count ?? 0) - (a.run_count ?? 0);
      if (sort === "active") return (b.last_run_at ?? "").localeCompare(a.last_run_at ?? "");
      return (b.created ?? "").localeCompare(a.created ?? "");
    });
    return sorted;
  }, [workflowsWithCategory, statusFilter, workflowQuery, sort]);

  const goToBilling = () => navigate({ to: "/dashboard/settings", search: { tab: "billing" } });

  const clearFilters = () => setFilters({ query: "", categories: [], platforms: [] });

  const refreshWorkflows = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const { run: runActivate } = useSaveAction(
    async (template: PortalTemplate) => {
      if (!user?.id) throw new Error("You are signed out. Please sign in again.");
      // Creates the user's own workflow copy. The global template record is
      // never modified.
      const workflow = await activateTemplate(template, user.id);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      return workflow;
    },
    {
      pending: "Creating your workflow…",
      success: "Workflow created — opening the builder",
      error: "Could not create the workflow. Please try again.",
    },
  );

  /**
   * "Use template" is a single step: create (or reuse) the user's own copy and
   * land straight in the builder. There is no separate activate/open sequence,
   * and a failure keeps the user where they are.
   */
  const handleUseTemplate = async (template: PortalTemplate) => {
    if (!user?.id) return;
    if (isLockedForTier(template, tier)) {
      goToBilling();
      return;
    }

    if (template.isActivated && template.workflowId) {
      setDetailTemplate(null);
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: template.workflowId },
      });
      return;
    }

    setPendingTemplate(template.template_id);
    try {
      const workflow = await runActivate(template);
      if (!workflow) return;
      setDetailTemplate(null);
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: workflow.id },
      });
    } finally {
      setPendingTemplate(null);
    }
  };

  const { run: runToggleStatus, saving: togglingStatus } = useSaveAction(
    async (workflow: PortalWorkflow) => {
      const next = workflow.status === "published" ? "paused" : "published";
      await setWorkflowStatus(workflow.id, next);
      await refreshWorkflows();
      return next;
    },
    {
      pending: "Updating workflow…",
      success: "Workflow status updated",
      error: "Could not update the workflow status",
    },
  );

  const { run: runRename, saving: renaming } = useSaveAction(
    async (workflowId: string, name: string) => {
      await renameWorkflow(workflowId, name);
      await refreshWorkflows();
    },
    {
      pending: "Renaming workflow…",
      success: "Workflow renamed",
      error: "Could not rename the workflow",
    },
  );

  const { run: runDuplicate, saving: duplicating } = useSaveAction(
    async (workflow: PortalWorkflow) => {
      await duplicateWorkflow(workflow);
      await refreshWorkflows();
    },
    {
      pending: "Duplicating workflow…",
      success: "Workflow duplicated",
      error: "Could not duplicate the workflow",
    },
  );

  const { run: runDelete, saving: deleting } = useSaveAction(
    async (workflowId: string) => {
      await deleteWorkflow(workflowId);
      await refreshWorkflows();
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    {
      pending: "Deleting workflow…",
      success: "Workflow deleted",
      error: "Could not delete the workflow",
    },
  );

  const workflowActionBusy = togglingStatus || renaming || duplicating || deleting;

  const handleRename = async (workflow: PortalWorkflow) => {
    const input = window.prompt("Rename workflow", workflow.name);
    if (input === null) return;
    const clean = sanitizeInput(input).slice(0, 120);
    if (!clean) return;
    await runRename(workflow.id, clean);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await runDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const renderTemplateCard = (template: PortalTemplate) => (
    <TemplateCard
      key={template.id}
      template={template}
      pending={pendingTemplate === template.template_id}
      locked={templateLocked.get(template.id) ?? false}
      onUse={() => void handleUseTemplate(template)}
      onOpenDetail={() => setDetailTemplate(template)}
    />
  );

  const activeSelections = [
    ...filters.categories.map((value) => ({
      key: `category:${value}`,
      label: value,
      remove: () =>
        setFilters((prev) => ({ ...prev, categories: toggleValue(prev.categories, value) })),
    })),
    ...filters.platforms.map((value) => ({
      key: `platform:${value}`,
      label: platformOptions.find((option) => option.key === value)?.name ?? value,
      remove: () =>
        setFilters((prev) => ({ ...prev, platforms: toggleValue(prev.platforms, value) })),
    })),
  ];

  const templatesSection = (
    <div aria-label="Synkra templates">
      <div className="mt-8">
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>Templates</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          Find a workflow template and start automating faster.
        </p>
      </div>

      <div className="mt-5 max-w-xl">
        <SearchField
          value={filters.query}
          onChange={(next) => setFilters((prev) => ({ ...prev, query: next }))}
          placeholder="Find a workflow template..."
          label="Search templates by name, description, category or app"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterButton
          label="All templates"
          selected={!filtersActive}
          onClick={clearFilters}
        />
        <FilterDropdown
          label="Category"
          options={categoryOptions.map((value) => ({ value, label: value }))}
          selected={filters.categories}
          onToggle={(value) =>
            setFilters((prev) => ({ ...prev, categories: toggleValue(prev.categories, value) }))
          }
          onClear={() => setFilters((prev) => ({ ...prev, categories: [] }))}
        />
        <FilterDropdown
          label="Apps"
          options={platformOptions.map((option) => ({ value: option.key, label: option.name }))}
          selected={filters.platforms}
          onToggle={(value) =>
            setFilters((prev) => ({ ...prev, platforms: toggleValue(prev.platforms, value) }))
          }
          onClear={() => setFilters((prev) => ({ ...prev, platforms: [] }))}
        />
      </div>

      {(activeSelections.length > 0 || filters.query.trim() !== "") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeSelections.map((selection) => (
            <button
              key={selection.key}
              type="button"
              onClick={selection.remove}
              className="synkra-focus inline-flex items-center gap-1 rounded-full"
              style={{
                border: "1px solid var(--accent-green-border)",
                backgroundColor: "var(--accent-green-subtle)",
                color: "var(--accent-green)",
                fontSize: 12,
                padding: "4px 10px",
              }}
              aria-label={`Remove filter ${selection.label}`}
            >
              {selection.label}
              <X size={11} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="synkra-focus inline-flex items-center gap-1 rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 12,
              padding: "4px 10px",
            }}
          >
            <X size={11} aria-hidden="true" />
            Clear all
          </button>
        </div>
      )}

      {lockedCount > 0 && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            padding: 14,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {lockedCount} {lockedCount === 1 ? "template needs" : "templates need"} a paid plan.
            They stay visible so you can see what you would unlock.
          </span>
          <button
            type="button"
            onClick={goToBilling}
            className="synkra-focus rounded-md font-semibold"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "#0A0A0A",
              fontSize: 13,
              padding: "7px 16px",
            }}
          >
            Upgrade plan
          </button>
        </div>
      )}

      {templatesQuery.isError ? (
        <div className="mt-6">
          <SectionError label="templates" onRetry={() => templatesQuery.refetch()} />
        </div>
      ) : templatesQuery.isPending ? (
        <CardSkeletons />
      ) : visibleTemplates.length === 0 ? (
        <p className="mt-8" style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          No templates match your search and filters.
        </p>
      ) : (
        <>
          {recommendedTemplates.length > 0 && (
            <Shelf
              title="Recommended"
              subtitle="Ready to run on your current plan and not activated yet."
            >
              {recommendedTemplates.map(renderTemplateCard)}
            </Shelf>
          )}
          <Shelf
            title="All templates"
            subtitle={`${visibleTemplates.length} ${
              visibleTemplates.length === 1 ? "template" : "templates"
            }${filtersActive ? " match your filters" : " available"}.`}
          >
            {visibleTemplates.map(renderTemplateCard)}
          </Shelf>
        </>
      )}
    </div>
  );

  const workflowsSection = (
    <section className="mt-8" aria-label="Your workflows">
      <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>My workflows</h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
        Workflows on your account. You own these — Synkra never edits them.
      </p>

      <div className="mt-5 max-w-xl">
        <SearchField
          value={workflowQuery}
          onChange={setWorkflowQuery}
          placeholder="Search your workflows..."
          label="Search your workflows by name or keyword"
        />
      </div>

      <div className="mt-3 flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          className="synkra-scroll-x flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Status"
        >
          {STATUSES.map((item) => (
            <FilterButton
              key={item.value}
              label={item.key}
              selected={statusFilter === item.value}
              onClick={() => setStatusFilter(item.value)}
            />
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort workflows"
          className="synkra-focus"
          style={{
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            height: 36,
            padding: "0 10px",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {workflowsQuery.isError ? (
        <div className="mt-6">
          <SectionError label="your workflows" onRetry={() => workflowsQuery.refetch()} />
        </div>
      ) : workflowsQuery.isLoading ? (
        <CardSkeletons count={2} />
      ) : workflows.length === 0 ? (
        <div className="mt-8">
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            No workflows yet.
          </h3>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            Use a Synkra template or build from scratch to create your first automation.
          </p>
          <div className="mt-5 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => setTab("templates")}
              className="synkra-focus rounded-md font-semibold"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "#0A0A0A",
                fontSize: 13,
                padding: "8px 18px",
              }}
            >
              Browse templates
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard/workflows/builder/new", search: {} })}
              className="synkra-focus rounded-md border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                fontSize: 13,
                padding: "8px 18px",
              }}
            >
              Build from scratch
            </button>
          </div>
        </div>
      ) : visibleWorkflows.length === 0 ? (
        <p className="mt-8" style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          None of your workflows match this search.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visibleWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              templateName={
                workflow.template_id ? templateNames.get(workflow.template_id) : undefined
              }
              onToggleStatus={() => void runToggleStatus(workflow)}
              onDuplicate={() => void runDuplicate(workflow)}
              onRename={() => void handleRename(workflow)}
              onDelete={() => setDeleteTarget(workflow)}
              busy={workflowActionBusy}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] overflow-x-hidden px-4 py-6 sm:px-5 md:px-10 md:py-8">
      <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1
            style={{
              fontSize: "clamp(22px, 6vw, 28px)",
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            Workflows
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            Build automations that run on their own. Start with a Synkra template or build from
            scratch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard/workflows/builder/new", search: {} })}
          className="synkra-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-elevated)",
            fontSize: 13,
            fontWeight: 600,
            padding: "0 14px",
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Build from scratch
        </button>
      </header>

      <nav
        className="mt-8 flex gap-6 overflow-x-auto sm:gap-8"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
        aria-label="Workflow views"
      >
        {[
          { key: "templates" as const, label: "Templates", count: templates.length },
          { key: "mine" as const, label: "My workflows", count: workflows.length },
        ].map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className="synkra-focus inline-flex items-center gap-2"
              style={{
                height: 44,
                borderBottom: active ? "2px solid var(--accent-green)" : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: active ? 600 : 500,
                fontSize: 14,
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
              {item.count > 0 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {activeTab === "templates" ? templatesSection : workflowsSection}

      {detailTemplate && (
        <TemplateDetailModal
          template={detailTemplate}
          pending={pendingTemplate === detailTemplate.template_id}
          locked={templateLocked.get(detailTemplate.id) ?? false}
          onUpgrade={goToBilling}
          onClose={() => setDetailTemplate(null)}
          onUse={() => void handleUseTemplate(detailTemplate)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this workflow?"
          body="This will permanently delete the workflow and all its run history."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
