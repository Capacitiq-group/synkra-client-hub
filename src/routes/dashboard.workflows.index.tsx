import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { TemplateCard } from "@/components/workflows/template-card";
import { TemplatePreviewModal } from "@/components/workflows/template-preview-modal";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import { ConfirmDialog } from "@/components/workflows/confirm-dialog";
import { OwnershipBadge } from "@/components/workflows/ownership-badge";
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
  matchesFilters,
  UNCATEGORISED,
  type FilterState,
} from "@/lib/workflow/filters";
import { isLockedForTier } from "@/lib/workflow/plan-access";
import { usePlanUsage } from "@/hooks/usePlanUsage";

type AvailabilityFilter = "all" | "included" | "paid";

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "included", label: "Included in my plan" },
  { value: "paid", label: "Requires a paid plan" },
];

type WorkflowTab = "all" | "templates" | "mine";


export const Route = createFileRoute("/dashboard/workflows/")({
  validateSearch: (search: Record<string, unknown>): { tab?: "mine" | "templates" } => {
    if (search["tab"] === "mine") return { tab: "mine" };
    if (search["tab"] === "templates") return { tab: "templates" };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Workflows — Synkra Client Portal" },
      { name: "description", content: "Activate templates and manage your automation workflows." },
      { property: "og:title", content: "Workflows — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Activate templates and manage your automation workflows.",
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

function FilterGroup({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {legend}
      </div>
      <div
        className="synkra-scroll-x flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={legend}
      >
        {children}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  count,
  kind,
}: {
  title: string;
  subtitle: string;
  count: number;
  kind: "template" | "user";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <OwnershipBadge kind={kind} />
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
        {title}{" "}
        <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>({count})</span>
      </h2>
      <p className="w-full" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        {subtitle}
      </p>
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

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [previewTemplate, setPreviewTemplate] = useState<PortalTemplate | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalWorkflow | null>(null);

  const usageQuery = usePlanUsage();
  const tier = usageQuery.data?.tier ?? "free";

  const templates = templatesQuery.data ?? [];
  const workflows = workflowsQuery.data ?? [];

  const activeTab: WorkflowTab = tab ?? "all";

  const setTab = (next: WorkflowTab) =>
    navigate({
      to: "/dashboard/workflows",
      search: next === "all" ? {} : { tab: next },
    });

  const templateNames = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(t.template_id, t.name));
    return map;
  }, [templates]);

  /**
   * User workflows have no category column. A workflow activated from a
   * template inherits that template's category so category filtering can
   * return both kinds of item; anything built from scratch is Uncategorised.
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

  const filterables = useMemo(
    () => [...templates, ...workflowsWithCategory],
    [templates, workflowsWithCategory],
  );

  const categoryOptions = useMemo(() => collectCategoryOptions(filterables), [filterables]);
  const platformOptions = useMemo(() => collectPlatformOptions(filterables), [filterables]);

  const filters: FilterState = { query, category, platform };
  const filtersActive =
    query.trim() !== "" || category !== "all" || platform !== "all" || availability !== "all";

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
    () =>
      templates.filter((template) => {
        if (!matchesFilters(template, filters)) return false;
        const locked = templateLocked.get(template.id) ?? false;
        if (availability === "included" && locked) return false;
        if (availability === "paid" && !locked) return false;
        return true;
      }),
    [templates, query, category, platform, availability, templateLocked],
  );


  const visibleWorkflows = useMemo(() => {
    const filtered = workflowsWithCategory.filter((workflow) => {
      if (statusFilter !== "all" && workflow.status !== statusFilter) return false;
      const locked = isLockedForTier(workflow, tier);
      if (availability === "included" && locked) return false;
      if (availability === "paid" && !locked) return false;
      return matchesFilters(workflow, filters);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "oldest") return (a.created ?? "").localeCompare(b.created ?? "");
      if (sort === "runs") return (b.run_count ?? 0) - (a.run_count ?? 0);
      if (sort === "active") return (b.last_run_at ?? "").localeCompare(a.last_run_at ?? "");
      return (b.created ?? "").localeCompare(a.created ?? "");
    });
    return sorted;
  }, [workflowsWithCategory, statusFilter, query, category, platform, availability, tier, sort]);

  const goToBilling = () =>
    navigate({ to: "/dashboard/settings", search: { tab: "billing" } });

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setPlatform("all");
    setAvailability("all");

  };

  const refreshWorkflows = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const { run: runActivate } = useSaveAction(
    async (template: PortalTemplate) => {
      if (!user?.id) throw new Error("You are signed out. Please sign in again.");
      const workflow = await activateTemplate(template, user.id);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      return workflow;
    },
    {
      pending: "Activating workflow…",
      success: "Workflow activated successfully",
      error: "Could not activate workflow. Please try again.",
    },
  );

  const handleActivate = async (template: PortalTemplate) => {
    if (!user?.id) return;
    // Paid-only templates stay visible but cannot be activated on a free plan.
    if (isLockedForTier(template, tier)) {
      goToBilling();
      return;
    }

    if (template.isActivated && template.workflowId) {
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
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: workflow.id },
      });
    } finally {
      setPendingTemplate(null);
      setPreviewTemplate(null);
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
    const target = deleteTarget;
    await runDelete(target.id);
    setDeleteTarget(null);
  };

  const showTemplates = activeTab === "all" || activeTab === "templates";
  const showWorkflows = activeTab === "all" || activeTab === "mine";

  const templatesSection = (
    <section className="mt-8" aria-label="Synkra templates">
      <SectionHeading
        kind="template"
        title="Synkra templates"
        count={visibleTemplates.length}
        subtitle="Pre-built automations provided by Synkra. Activating one creates your own copy."
      />

      {templatesQuery.isError ? (
        <div className="mt-6">
          <SectionError label="templates" onRetry={() => templatesQuery.refetch()} />
        </div>
      ) : templatesQuery.isPending ? (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: 24,
              }}
            >
              <Shimmer height={11} width={80} />
              <div className="mt-3">
                <Shimmer height={18} width={200} />
              </div>
              <div className="mt-3">
                <Shimmer height={14} />
              </div>
              <div className="mt-6">
                <Shimmer height={60} />
              </div>
            </div>
          ))}
        </div>
      ) : visibleTemplates.length === 0 ? (
        <p className="mt-6" style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          No Synkra templates match these filters.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              activated={template.isActivated}
              pending={pendingTemplate === template.template_id}
              locked={templateLocked.get(template.id) ?? false}
              onUpgrade={goToBilling}
              onActivate={() => handleActivate(template)}
              onPreview={() => setPreviewTemplate(template)}
            />

          ))}
        </div>
      )}
    </section>
  );

  const workflowsSection = (
    <section className="mt-10" aria-label="Your workflows">
      <SectionHeading
        kind="user"
        title="Your workflows"
        count={visibleWorkflows.length}
        subtitle="Workflows on your account. You own these — Synkra never edits them."
      />

      <div className="mt-4 flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="synkra-scroll-x flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Status">
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
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
              }}
            >
              <Shimmer height={17} width={180} />
              <div className="mt-4">
                <Shimmer height={13} />
              </div>
              <div className="mt-4">
                <Shimmer height={30} width={220} />
              </div>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="mt-8">
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            No workflows yet.
          </h3>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            Activate a Synkra template or build from scratch to create your first automation.
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
        <p className="mt-6" style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          None of your workflows match these filters.
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
        <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-row md:items-center">
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
          <div className="relative w-full md:w-auto">
            <Search
              size={16}
              aria-hidden="true"
              style={{
                color: "var(--text-muted)",
                position: "absolute",
                left: 12,
                top: 12,
              }}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or keyword"
              aria-label="Search templates and workflows by name or keyword"
              className="synkra-focus w-full md:w-60"
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
        </div>
      </header>

      <nav
        className="mt-8 flex gap-6 overflow-x-auto sm:gap-8"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
        aria-label="Workflow views"
      >
        {[
          { key: "all" as const, label: "All", count: templates.length + workflows.length },
          { key: "templates" as const, label: "Synkra templates", count: templates.length },
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

      <div className="mt-6 flex flex-col gap-4">
        {categoryOptions.length > 0 && (
          <FilterGroup legend="Category">
            <FilterButton
              label="All categories"
              selected={category === "all"}
              onClick={() => setCategory("all")}
            />
            {categoryOptions.map((item) => (
              <FilterButton
                key={item}
                label={item}
                selected={category === item}
                onClick={() => setCategory(item)}
              />
            ))}
          </FilterGroup>
        )}

        {platformOptions.length > 0 && (
          <FilterGroup legend="Platform">
            <FilterButton
              label="All platforms"
              selected={platform === "all"}
              onClick={() => setPlatform("all")}
            />
            {platformOptions.map((item) => (
              <FilterButton
                key={item.key}
                label={item.name}
                selected={platform === item.key}
                onClick={() => setPlatform(item.key)}
              />
            ))}
          </FilterGroup>
        )}

        <FilterGroup legend="Plan availability">
          {AVAILABILITY_OPTIONS.map((option) => (
            <FilterButton
              key={option.value}
              label={option.label}
              selected={availability === option.value}
              onClick={() => setAvailability(option.value)}
            />
          ))}
        </FilterGroup>

        {lockedCount > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            style={{
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-md)",
              padding: 14,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {lockedCount} {lockedCount === 1 ? "template requires" : "templates require"} a paid
              plan on your current plan. They stay visible so you can see what you would unlock.
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



        {filtersActive && (
          <div className="flex flex-wrap items-center gap-3">
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Showing {visibleTemplates.length} Synkra{" "}
              {visibleTemplates.length === 1 ? "template" : "templates"} and{" "}
              {visibleWorkflows.length} of your{" "}
              {visibleWorkflows.length === 1 ? "workflow" : "workflows"}.
            </span>
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
              <X size={12} aria-hidden="true" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {showTemplates && templatesSection}
      {showWorkflows && workflowsSection}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          activated={previewTemplate.isActivated}
          pending={pendingTemplate === previewTemplate.template_id}
          locked={templateLocked.get(previewTemplate.id) ?? false}
          onUpgrade={goToBilling}
          onClose={() => setPreviewTemplate(null)}
          onActivate={() => handleActivate(previewTemplate)}
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
