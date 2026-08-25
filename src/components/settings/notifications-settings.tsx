import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveAction } from "@/hooks/useSaveAction";
import pb from "@/lib/pocketbase";
import { sendNotificationEmail } from "@/lib/notifications";
import { sanitizeEmail } from "@/lib/sanitize";
import { fieldStyle, SettingsSection } from "./settings-primitives";

const ROWS = [
  [
    "notify_on_failure",
    "Workflow failed",
    "Email me when any automation encounters an error.",
    true,
  ],
  [
    "notify_weekly_summary",
    "Weekly summary",
    "A summary of your workflow runs every Monday at 8am.",
    true,
  ],
  [
    "notify_on_success",
    "Workflow completed",
    "Email me each time a workflow finishes running successfully.",
    false,
  ],
  [
    "notify_credit_low",
    "Credit balance low",
    "Alert me when any credit type drops below 20 percent remaining.",
    true,
  ],
  [
    "notify_platform_updates",
    "Platform updates",
    "Occasional emails about new templates and features from Synkra.",
    false,
  ],
] as const;
export function NotificationsSettings() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  useEffect(() => setEmail(user?.notification_email || user?.email || ""), [user]);
  const { run: update, saving: savingPreference } = useSaveAction(
    async (userId: string, key: string, value: boolean) => {
      await pb.collection("users").update(userId, { [key]: value });
      if (pb.authStore.record) pb.authStore.record[key] = value;
      await refreshUser();
    },
    { pending: "Saving preference…", success: "Saved successfully" },
  );
  const { run: saveEmail, saving: savingEmail } = useSaveAction(
    async (userId: string, value: string, previous: string) => {
      const clean = sanitizeEmail(value);
      await pb.collection("users").update(userId, { notification_email: clean });
      await refreshUser();
      if (clean && clean !== previous) {
        void sendNotificationEmail({
          to: clean,
          subject: "Synkra notifications are active",
          body: `Hi,\n\nThis confirms that Synkra workflow notifications will be sent to this address.\n\nYou will receive an email when any of your automations encounter an error.\n\nSynkra`,
        });
      }
    },
    { success: "Saved successfully" },
  );
  if (!user) return null;
  const preferences = user as unknown as Record<string, unknown>;
  return (
    <div className="max-w-[560px]">
      <SettingsSection title="Notification preferences">
        <p className="mb-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Workflow and account events are saved in your notification feed. Control which events also send you an email.
        </p>
        <label className="mb-6 block">
          <span
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Notification email address
          </span>
          <span className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={fieldStyle}
            />
            <Button
              variant="secondary"
              className="h-11 shrink-0"
              disabled={savingEmail}
              onClick={() =>
                void saveEmail(user.id, email, user.notification_email || user.email || "")
              }
            >
              {savingEmail ? "Saving…" : "Save"}
            </Button>
          </span>
        </label>
        <div>
          {ROWS.map(([key, name, description, defaultValue]) => (
            <div
              key={key}
              className="flex min-h-16 items-center justify-between gap-4 border-t px-1"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end">
                <Switch
                  checked={Boolean(preferences[key] ?? defaultValue)}
                  disabled={savingPreference}
                  onCheckedChange={(value) => void update(user.id, key, value)}
                  aria-label={name}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
