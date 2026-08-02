import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { TemplateCard } from "@/components/workflows/template-card";
import { TemplatePreviewModal } from "@/components/workflows/template-preview-modal";
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
import { sanitizeText } from "@/lib/sanitize";

export const Route = createFileRoute("/dashboard/workflows/")({
  validateSearch: (search: Record<string, unknown>): { tab?: "mine" } =>
    search["tab"] === "mine" ? { tab: "mine" } : {},
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

const CATEGORIES = ["All", "Sales", "Operations", "Customer Service", "Marketing", "Finance"];
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

function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tab } = Route.useSearch();

  const templatesQuery = useTemplates();
  const workflowsQuery = useWorkflows();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [previewTemplate, setPreviewTemplate] = useState<PortalTemplate | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalWorkflow | null>(null);

  const templates = templatesQuery.data ?? [];
  const workflows = workflowsQuery.data ?? [];
  const activeTab = tab === "mine" ? "mine" : "templates";

  const setTab = (next: "templates" | "mine") =>
    navigate({ to: "/dashboard/workflows", search: next === "mine" ? { tab: "mine" } : {} });

  const templateNames = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(t.template_id, t.name));
    return map;
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      if (category !== "All" && template.category !== category) return false;
      if (!needle) return true;
      return (
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle) ||
        template.category.toLowerCase().includes(needle)
      );
    });
  }, [templates, category, query]);

  const visibleWorkflows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = workflows.filter((workflow) => {
      if (statusFilter !== "all" && workflow.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        workflow.name.toLowerCase().includes(needle) ||
        (workflow.description ?? "").toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "oldest") return (a.created ?? "").localeCompare(b.created ?? "");
      if (sort === "runs") return (b.run_count ?? 0) - (a.run_count ?? 0);
      if (sort === "active") return (b.last_run_at ?? "").localeCompare(a.last_run_at ?? "");
      return (b.created ?? "").localeCompare(a.created ?? "");
    });
    return sorted;
  }, [workflows, statusFilter, query, sort]);

  const handleActivate = async (template: PortalTemplate) => {
    if (!user?.id) return;
    if (template.isActivated && template.workflowId) {
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: template.workflowId },
      });
      return;
    }
    setPendingTemplate(template.template_id);
    try {
      const workflow = await activateTemplate(template, user.id);
      toast.success("Workflow activated successfully");
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: workflow.id },
      });
    } catch {
      toast.error("Could not activate workflow. Please try again.");
    } finally {
      setPendingTemplate(null);
      setPreviewTemplate(null);
    }
  };

  const refreshWorkflows = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const handleToggleStatus = async (workflow: PortalWorkflow) => {
    const next = workflow.status === "published" ? "paused" : "published";
    try {
      await setWorkflowStatus(workflow.id, next);
      await refreshWorkflows();
      toast.success(next === "paused" ? "Workflow paused" : "Workflow resumed");
    } catch {
      toast.error("Could not update the workflow status");
    }
  };

  const handleRename = async (workflow: PortalWorkflow) => {
    const input = window.prompt("Rename workflow", workflow.name);
    if (input === null) return;
    const clean = sanitizeText(input).slice(0, 120);
    if (!clean) return;
    try {
      await renameWorkflow(workflow.id, clean);
      await refreshWorkflows();
      toast.success("Workflow renamed");
    } catch {
      toast.error("Could not rename the workflow");
    }
  };

  const handleDuplicate = async (workflow: PortalWorkflow) => {
    try {
      await duplicateWorkflow(workflow);
      await refreshWorkflows();
      toast.success("Workflow duplicated");
    } catch {
      toast.error("Could not duplicate the workflow");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorkflow(deleteTarget.id);
      await refreshWorkflows();
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Workflow deleted");
    } catch {
      toast.error("Could not delete the workflow");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>Workflows</h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            Build automations that run on their own. Start with a template or build from scratch.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          <div className="relative">
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
              placeholder="Search templates and workflows"
              aria-label="Search templates and workflows"
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
        className="mt-8 flex gap-8"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
        aria-label="Workflow views"
      >
        {[
          { key: "templates" as const, label: "Templates", count: templates.length },
          { key: "mine" as const, label: "My Workflows", count: workflows.length },
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

      {activeTab === "templates" ? (
        <section className="mt-6" aria-label="Template gallery">
          <div className="synkra-scroll-x flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((item) => (
              <FilterButton
                key={item}
                label={item}
                selected={category === item}
                onClick={() => setCategory(item)}
              />
            ))}
          </div>

          {templatesQuery.isError ? (
            <div className="mt-6">
              <SectionError label="templates" onRetry={() => templatesQuery.refetch()} />
            </div>
          ) : templatesQuery.isLoading ? (
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
              No templates match that search.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  activated={template.isActivated}
                  pending={pendingTemplate === template.template_id}
                  onActivate={() => handleActivate(template)}
                  onPreview={() => setPreviewTemplate(template)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6" aria-label="My workflows">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="synkra-scroll-x flex gap-2 overflow-x-auto pb-1">
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
            <div className="mt-10">
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                No workflows yet.
              </h2>
              <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
                Activate a template or build from scratch to create your first automation.
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
              No workflows match those filters.
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
                  onToggleStatus={() => handleToggleStatus(workflow)}
                  onDuplicate={() => handleDuplicate(workflow)}
                  onRename={() => handleRename(workflow)}
                  onDelete={() => setDeleteTarget(workflow)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          activated={previewTemplate.isActivated}
          pending={pendingTemplate === previewTemplate.template_id}
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
