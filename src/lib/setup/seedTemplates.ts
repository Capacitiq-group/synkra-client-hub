import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveAction } from "@/hooks/useSaveAction";
import pb from "@/lib/pocketbase";
import { sanitizeEmail, sanitizeInput } from "@/lib/sanitize";
import { Field, fieldStyle, SettingsSection } from "./settings-primitives";

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
type Form = {
  business_name: string;
  business_industry: string;
  business_address: string;
  whatsapp_number: string;
  notification_email: string;
};
export function BusinessSettings() {
  const { user, refreshUser } = useAuth();
  const fromUser = (): Form => ({
    business_name: user?.business_name ?? "",
    business_industry: user?.business_industry ?? "",
    business_address: user?.business_address ?? "",
    whatsapp_number: user?.whatsapp_number ?? "",
    notification_email: user?.notification_email || user?.email || "",
  });
  const [form, setForm] = useState<Form>(fromUser);
  useEffect(() => setForm(fromUser()), [user]);
  const { run: save, saving } = useSaveAction(
    async (userId: string, values: Form) => {
      await pb.collection("users").update(userId, {
        ...values,
        business_name: sanitizeInput(values.business_name),
        business_industry: sanitizeInput(values.business_industry),
        business_address: sanitizeInput(values.business_address),
        whatsapp_number: sanitizeInput(values.whatsapp_number),
        notification_email: sanitizeEmail(values.notification_email),
      });
      await refreshUser();
    },
    { success: "Saved successfully" },
  );
  if (!user) return null;
  const changed = JSON.stringify(form) !== JSON.stringify(fromUser());
  const set = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="max-w-[560px]">
      <SettingsSection title="Business details">
        <div className="flex flex-col gap-5">
          <Field label="Business name">
            <input
              required
              value={form.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              style={fieldStyle}
            />
          </Field>
          <Field label="Industry">
            <select
              value={form.business_industry}
              onChange={(e) => set("business_industry", e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select an industry</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
          </Field>
          <Field label="Business address">
            <input
              value={form.business_address}
              onChange={(e) => set("business_address", e.target.value)}
              placeholder="Street address, city, province"
              style={fieldStyle}
            />
          </Field>
          <Field
            label="WhatsApp Business number"
            note="This number is used when WhatsApp automation is connected."
          >
            <input
              type="tel"
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value)}
              placeholder="+27 or 0XX XXX XXXX"
              style={fieldStyle}
            />
          </Field>
          <Field
            label="Notification email"
            note="Workflow notifications are sent to this address. It can be different from your login email."
          >
            <input
              type="email"
              value={form.notification_email}
              onChange={(e) => set("notification_email", e.target.value)}
              style={fieldStyle}
            />
          </Field>
          <Button
            className="h-10 w-full sm:w-fit"
            disabled={saving || !changed || !form.business_name.trim()}
            onClick={() => void save(user.id, form)}
          >
            {saving ? "Saving…" : "Save business details"}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
                }
                
