import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveAction } from "@/hooks/useSaveAction";
import pb from "@/lib/pocketbase";
import { sendNotificationEmail } from "@/lib/notifications";
import {
  EMAIL_PAID_PLAN_NOTE,
  NOTIFICATION_PREFERENCES,
  channelLabel,
  emailChannelAvailable,
  isPaidTier,
  preferenceEnabled,
} from "@/lib/notification-preferences";
import { sanitizeEmail } from "@/lib/sanitize";
import { fieldStyle, SettingsSection } from "./settings-primitives";

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
          body: `Hi,\n\nThis confirms that Synkra notification emails will be sent to this address.\n\nSynkra`,
        });
      }
    },
    { success: "Saved successfully" },
  );
  if (!user) return null;
  const preferences = user as unknown as Record<string, unknown>;
  const tier = user.tier;
  const paid = isPaidTier(tier);

  return (
    <div className="max-w-[560px]">
      <SettingsSection title="Notification preferences">
        <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Each switch below controls whether that event is delivered at all. Every enabled event
          appears in your in-app notification feed. The channel shown on each row is exactly what is
          sent.
        </p>
        <p className="mb-5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {paid
            ? "Your paid plan includes email for every event you enable, alongside the in-app feed."
            : "On the Free plan, email is sent for credit balance alerts and platform updates only. Workflow and summary events are delivered in-app — upgrade to receive those by email as well."}
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
          {NOTIFICATION_PREFERENCES.map((def) => {
            const emailAvailable = emailChannelAvailable(tier, def.eventType);
            const gated = def.emailRequiresPaid && !emailAvailable;
            return (
              <div
                key={def.field}
                className="flex min-h-16 items-center justify-between gap-4 border-t px-1 py-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {def.label}
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {channelLabel(tier, def.eventType)}
                    </span>
                    {gated && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: "var(--accent-green)",
                          color: "var(--bg-primary, #07130d)",
                        }}
                      >
                        Email: paid plan
                      </span>
                    )}
                  </p>
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                    {def.description}
                  </p>
                  {gated && (
                    <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {EMAIL_PAID_PLAN_NOTE}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-end">
                  <Switch
                    checked={preferenceEnabled(preferences, def.eventType)}
                    disabled={savingPreference}
                    onCheckedChange={(value) => void update(user.id, def.field, value)}
                    aria-label={`${def.label} — ${channelLabel(tier, def.eventType)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
                    }
