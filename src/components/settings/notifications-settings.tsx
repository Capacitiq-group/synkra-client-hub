import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { sanitizeEmail } from "@/lib/sanitize";
import { fieldStyle, SettingsSection } from "./settings-primitives";

const ROWS = [["notify_on_failure", "Workflow failed", "Email me when any automation encounters an error.", true], ["notify_weekly_summary", "Weekly summary", "A summary of your workflow runs every Monday at 8am.", true], ["notify_on_success", "Workflow completed", "Email me each time a workflow finishes running successfully.", false], ["notify_credit_low", "Credit balance low", "Alert me when any credit type drops below 20 percent remaining.", true], ["notify_platform_updates", "Platform updates", "Occasional emails about new templates and features from Synkra.", false]] as const;
export function NotificationsSettings() {
  const { user, refreshUser } = useAuth(); const [email, setEmail] = useState(""); const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => setEmail(user?.notification_email || user?.email || ""), [user]); if (!user) return null;
  const update = async (key: string, value: boolean) => { try { await pb.collection("users").update(user.id, { [key]: value }); if (pb.authStore.record) pb.authStore.record[key] = value; await refreshUser(); setSaved(key); window.setTimeout(() => setSaved((current) => current === key ? null : current), 1500); } catch { toast.error("Could not save preference"); } };
  const saveEmail = async () => { try { await pb.collection("users").update(user.id, { notification_email: sanitizeEmail(email) }); await refreshUser(); toast.success("Notification address updated"); } catch { toast.error("Could not update notification address"); } };
  const preferences = user as unknown as Record<string, unknown>;
  return <div className="max-w-[560px]"><SettingsSection title="Notification preferences"><p className="mb-5 text-sm" style={{ color: "var(--text-secondary)" }}>In-app notifications are always on. Control which events also send you an email.</p><label className="mb-6 block"><span className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Notification email address</span><span className="flex gap-2"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} /><Button variant="secondary" className="h-9" onClick={() => void saveEmail()}>Save</Button></span></label><div>{ROWS.map(([key,name,description,defaultValue]) => <div key={key} className="flex min-h-16 items-center justify-between gap-4 border-t px-1" style={{ borderColor: "var(--border-subtle)" }}><div><p className="text-sm font-medium">{name}</p><p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{description}</p></div><div className="flex min-w-24 items-center justify-end gap-2">{saved === key && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--state-success)" }}><CheckCircle size={14} />Saved</span>}<Switch checked={Boolean(preferences[key] ?? defaultValue)} onCheckedChange={(value) => void update(key, value)} aria-label={name} /></div></div>)}</div></SettingsSection></div>;
}