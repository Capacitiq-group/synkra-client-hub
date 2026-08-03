import { useMemo, useState } from "react";
import { X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { previewWorkflow } from "@/lib/workflow/resolve";
import { sampleInputFor } from "@/lib/workflow/describe";
import { testWorkflow, type TestRunResult } from "@/lib/workflow/api";
import type { WorkflowBlock } from "@/lib/workflow/types";

const codeStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  padding: 12,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: 12,
  color: "var(--text-secondary)",
  whiteSpace: "pre-wrap",
};

export function TestModal({
  blocks,
  userId,
  user,
  onClose,
}: {
  blocks: WorkflowBlock[];
  userId: string;
  user?: { email?: string; name?: string; business_name?: string };
  onClose: () => void;
}) {
  const [sampleText, setSampleText] = useState(() =>
    JSON.stringify(sampleInputFor(blocks), null, 2),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestRunResult | null>(null);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(sampleText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [sampleText]);

  const preview = useMemo(
    () => previewWorkflow(blocks, parsed ?? {}, user),
    [blocks, parsed, user],
  );

  const run = async () => {
    if (!parsed) {
      toast.error("Sample input is not valid JSON");
      return;
    }
    setRunning(true);
    try {
      const response = await testWorkflow(blocks, parsed, userId);
      setResult(response);
      toast.success("Test run finished");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Test workflow"
    >
      <div
        className="mt-10 w-full max-w-[720px]"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Test run
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="synkra-focus rounded-sm">
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <label
              className="mb-1.5 block"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
            >
              Sample input
            </label>
            <textarea
              value={sampleText}
              rows={6}
              onChange={(e) => setSampleText(e.target.value)}
              className="synkra-focus w-full"
              style={{ ...codeStyle, resize: "vertical" }}
            />
            {!parsed && (
              <p style={{ fontSize: 12, color: "var(--state-error)", marginTop: 4 }}>
                This is not valid JSON.
              </p>
            )}
          </div>

          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              RESOLVED STEPS
            </p>
            <div className="flex flex-col gap-2">
              {preview.steps.map((step, index) => {
                const log = result?.step_logs?.[index];
                return (
                  <div
                    key={step.block.id}
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-sm)",
                      padding: 12,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Step {index + 1}
                      </span>
                      <span
                        style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                      >
                        {step.block.label}
                      </span>
                      {running && !log && (
                        <Loader2 size={14} className="animate-spin" style={{ color: "var(--state-info)" }} />
                      )}
                      {log?.success === true && (
                        <CheckCircle size={14} style={{ color: "var(--state-success)" }} />
                      )}
                      {log?.success === false && (
                        <XCircle size={14} style={{ color: "var(--state-error)" }} />
                      )}
                    </div>
                    <pre style={{ ...codeStyle, marginTop: 8 }}>
                      {JSON.stringify(step.resolvedConfig, null, 2)}
                    </pre>
                    {step.missing.length > 0 && (
                      <p style={{ fontSize: 12, color: "var(--state-warning)", marginTop: 6 }}>
                        Unresolved: {step.missing.join(", ")}
                      </p>
                    )}
                    {log?.error && (
                      <p style={{ fontSize: 13, color: "var(--state-error)", marginTop: 6 }}>
                        {log.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={running}
            className="synkra-focus w-full rounded-md"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "#04120B",
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 16px",
              opacity: running ? 0.7 : 1,
            }}
          >
            {running ? "Running test" : "Run test"}
          </button>
        </div>
      </div>
    </div>
  );
}
