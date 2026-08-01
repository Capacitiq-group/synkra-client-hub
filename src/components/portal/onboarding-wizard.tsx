// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Activity, ChevronRight, Settings, X, Zap } from "lucide-react";
import pb from "@/lib/pocketbase";
import { saveUserFields } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { TEMPLATES } from "@/lib/setup/seedTemplates";
import { useAuthStore } from "@/stores/auth";

const TOTAL_STEPS = 5;

const INDUSTRIES = [
  "Retail",
  "Beauty and Wellness",
  "Food and Hospitality",
  "Professional Services",
  "Education and Coaching",
  "Healthcare",
  "Trades and Construction",
  "Other",
];

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  height: 44,
  padding: "0 14px",
  color: "var(--text-primary)",
  fontSize: 15,
  width: "100%",
  outline: "none",
};

function formatDate(value?: string | null) {
  if (!value) return "in 30 days";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "in 30 days";
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export function OnboardingWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user) as
    | (Record<string, unknown> & { id: string; name?: string; email: string })
    | null;

  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const saved = Number(user["onboarding_step"] ?? 1);
    setStep(saved >= 1 && saved <= TOTAL_STEPS ? saved : 1);
    setBusinessName(String(user["business_name"] ?? ""));
    setIndustry(String(user["business_industry"] ?? ""));
  }, [open, user]);

  if (!open || !user) return null;

  const save = (data: Record<string, unknown>) => saveUserFields(user.id, data);

  const closeWizard = (completed: boolean) => {
    save(completed ? { onboarding_completed: true, onboarding_step: TOTAL_STEPS } : { onboarding_step: step });
    onClose();
  };

  const saveBusiness = () => {
    const cleanName = sanitizeInput(businessName);
    const cleanIndustry = sanitizeInput(industry);
    save({ business_name: cleanName, business_industry: cleanIndustry, onboarding_step: 3 });
    if (pb.authStore.record) {
      pb.authStore.record["business_name"] = cleanName;
      pb.authStore.record["business_industry"] = cleanIndustry;
    }
  };

  const goNext = () => {
    if (step === 2) saveBusiness();
    if (step === 4 && selectedTemplate) {
      save({ onboarding_step: 5 });
      onClose();
      navigate({
        to: "/dashboard/workflows/builder/new",
        search: { template: selectedTemplate },
      });
      return;
    }
    if (step === TOTAL_STEPS) {
      closeWizard(true);
      return;
    }
    const next = step + 1;
    save({ onboarding_step: next });
    setStep(next);
  };

  const goTo = (to: string) => {
    closeWizard(true);
    navigate({ to });
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l text-left md:w-[400px]"
      role="dialog"
      aria-label="Setup guide"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((dot) => (
            <span
              key={dot}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor:
                  dot === step
                    ? "var(--accent-green)"
                    : dot < step
                      ? "var(--accent-green)"
                      : "var(--border-strong)",
                opacity: dot < step ? 0.4 : 1,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Close setup guide"
          onClick={() => closeWizard(step === TOTAL_STEPS)}
          style={{ color: "var(--text-muted)", lineHeight: 0 }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ height: 2, backgroundColor: "var(--border-default)" }}>
        <div
          style={{
            height: 2,
            width: `${progress}%`,
            backgroundColor: "var(--accent-green)",
            transition: "width 300ms ease",
          }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {step === 1 && (
          <div>
            <div
              style={{ color: "var(--accent-green)", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}
            >
              SYNKRA
            </div>
            <h2 style={{ marginTop: 24, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
              {user.name ? `Welcome, ${user.name}` : "Welcome to Synkra"}
            </h2>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              You are here because your business deserves to run more smoothly. This short guide will
              help you activate your first automation in under 5 minutes.
            </p>
            {String(user["user_type"] ?? "beta") === "beta" && (
              <div
                style={{
                  marginTop: 24,
                  border: "1px solid var(--accent-green-border)",
                  backgroundColor: "var(--accent-green-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-green)" }}>
                  Your 30-day free trial is active. Expires{" "}
                  {formatDate(user["trial_ends_at"] as string | null)}.
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                  No credit card required.
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
              Tell us about your business
            </h2>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              This helps us show you the most relevant templates first.
            </p>
            <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="ob-business" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                  Business name
                </label>
                <input
                  id="ob-business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your trading name"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="ob-industry" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                  Industry
                </label>
                <select
                  id="ob-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
              How Synkra works
            </h2>
            <div style={{ marginTop: 24, display: "grid", gap: 24 }}>
              {[
                {
                  title: "A trigger starts your automation",
                  body: "Something happens, a form is submitted, the clock hits 7am, a customer pays, and Synkra wakes up.",
                },
                {
                  title: "Actions run automatically",
                  body: "Synkra sends an email, waits a day, then sends another one. All without you touching anything.",
                },
                {
                  title: "You watch what happened",
                  body: "The activity log shows every run with a step-by-step result. If something fails you see exactly why.",
                },
              ].map((item, i) => (
                <div key={item.title} style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      borderRadius: 999,
                      backgroundColor: "var(--accent-green-subtle)",
                      border: "1px solid var(--accent-green-border)",
                      color: "var(--accent-green)",
                      fontWeight: 700,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {item.title}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
                      {item.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
              Activate your first automation
            </h2>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              Pick one that fits your business. You can change it or add more any time.
            </p>
            <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
              {TEMPLATES.map((template) => {
                const selected = selectedTemplate === template.template_id;
                return (
                  <button
                    key={template.template_id}
                    type="button"
                    onClick={() => setSelectedTemplate(template.template_id)}
                    className="text-left transition-colors"
                    style={{
                      backgroundColor: selected ? "var(--accent-green-subtle)" : "var(--bg-elevated)",
                      border: `1px solid ${selected ? "var(--accent-green)" : "var(--border-default)"}`,
                      borderRadius: "var(--radius-md)",
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--accent-green)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {template.category}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {template.name}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                      {template.description}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                      No paid API required
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
              You are all set
            </h2>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              Your automation dashboard is ready. Here is what you can do from here.
            </p>
            <div style={{ marginTop: 24, display: "grid", gap: 4 }}>
              {[
                { icon: Zap, label: "Browse templates", to: "/dashboard/workflows" },
                { icon: Activity, label: "View activity logs", to: "/dashboard/activity" },
                { icon: Settings, label: "Update your settings", to: "/dashboard/settings" },
              ].map(({ icon: Icon, label, to }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => goTo(to)}
                  className="flex items-center gap-3 rounded-sm px-2 py-3 text-left transition-colors"
                >
                  <Icon size={18} style={{ color: "var(--accent-green)" }} />
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
                    {label}
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="border-t px-5 py-4"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                height: 44,
                paddingInline: 16,
                fontSize: 15,
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            className="flex-1 transition-opacity hover:opacity-90 active:scale-[0.97]"
            style={{
              height: 44,
              backgroundColor: "var(--accent-green)",
              color: "#0A0A0A",
              fontWeight: 600,
              fontSize: 15,
              borderRadius: "var(--radius-md)",
            }}
          >
            {step === TOTAL_STEPS ? "Finish" : "Next"}
          </button>
        </div>
        {step === 1 && (
          <button
            type="button"
            onClick={() => closeWizard(true)}
            style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}
          >
            I will figure it out myself
          </button>
        )}
      </div>
    </aside>
  );
}
