import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { sanitizeInput } from "@/lib/sanitize";
import { Field, fieldStyle, SettingsSection } from "./settings-primitives";

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false);
  return <Field label={label}><div className="relative"><input type={shown ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} style={{ ...fieldStyle, paddingRight: 44 }} /><button type="button" onClick={() => setShown((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={shown ? "Hide password" : "Show password"}>{shown ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>;
}

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [oldError, setOldError] = useState("");
  useEffect(() => setName(user?.name ?? ""), [user?.name]);
  const requirements = { length: password.length >= 8, number: /\d/.test(password), uppercase: /[A-Z]/.test(password) };
  const strength = Object.values(requirements).filter(Boolean).length + (password.length >= 12 ? 1 : 0);
  const strengthColor = strength <= 1 ? "var(--state-error)" : strength === 2 ? "var(--state-warning)" : strength === 3 ? "var(--accent-green)" : "var(--state-success)";
  const mismatch = confirmTouched && password !== confirm;
  const accountDate = useMemo(() => user?.created ? new Date(user.created).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "Not available", [user?.created]);
  if (!user) return null;
  const saveName = async () => { try { await pb.collection("users").update(user.id, { name: sanitizeInput(name) }); await refreshUser(); toast.success("Profile updated"); } catch { toast.error("Could not update profile"); } };
  const changePassword = async () => {
    setOldError(""); setConfirmTouched(true);
    if (password !== confirm || !requirements.length || !requirements.number || !requirements.uppercase) return;
    try { await pb.collection("users").update(user.id, { oldPassword, password, passwordConfirm: confirm }); setOldPassword(""); setPassword(""); setConfirm(""); setConfirmTouched(false); toast.success("Password updated"); }
    catch { setOldError("The current password is not correct"); }
  };
  const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const days = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
  return <div className="flex max-w-[560px] flex-col gap-10">
    <SettingsSection title="Personal information"><div className="flex flex-col gap-5"><Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></Field><Field label="Email address" note="Your email address cannot be changed. Contact hello@synkra.co.za if you need to update it."><input value={user.email} readOnly style={{ ...fieldStyle, backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)", cursor: "not-allowed", borderColor: "var(--border-subtle)" }} /></Field><Button className="h-10 w-fit" disabled={name.trim() === (user.name ?? "").trim()} onClick={() => void saveName()}>Save changes</Button></div></SettingsSection>
    <SettingsSection title="Change password"><div className="flex flex-col gap-5"><div><PasswordInput label="Current password" value={oldPassword} onChange={setOldPassword} />{oldError && <p className="mt-1 text-xs" style={{ color: "var(--state-error)" }}>{oldError}</p>}</div><div><PasswordInput label="New password" value={password} onChange={setPassword} /><div className="mt-2 grid grid-cols-4 gap-1">{[0,1,2,3].map((segment) => <span key={segment} className="h-1" style={{ backgroundColor: segment < strength ? strengthColor : "var(--border-default)" }} />)}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{[[requirements.length,"At least 8 characters"],[requirements.number,"one number"],[requirements.uppercase,"one uppercase letter"]].map(([met,label]) => <span key={String(label)} className="flex items-center gap-1 text-xs" style={{ color: met ? "var(--state-success)" : "var(--text-muted)" }}><Check size={12} />{String(label)}</span>)}</div></div><div onBlur={() => setConfirmTouched(true)}><PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} />{mismatch && <p className="mt-1 text-xs" style={{ color: "var(--state-error)" }}>Passwords do not match</p>}</div><Button variant="secondary" className="h-10 w-fit" onClick={() => void changePassword()}>Change password</Button></div></SettingsSection>
    <SettingsSection title="Account information"><div>{[["Account type", user.is_tester ? "TESTER" : user.user_type === "paid" ? "PRO" : "BETA"],["Trial status", user.is_tester ? "Unlimited tester access" : days === null ? "Not available" : days < 0 ? "Trial ended" : `Trial active until ${trialEnd?.toLocaleDateString("en-ZA")}`],["Member since", accountDate]].map(([label,value], index) => <div key={label} className="flex h-12 items-center justify-between border-b" style={{ borderColor: index === 2 ? "transparent" : "var(--border-subtle)" }}><span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span><span className="text-sm font-medium" style={{ color: label === "Trial status" && !user.is_tester && days !== null && days < 0 ? "var(--state-error)" : "var(--text-primary)" }}>{value}</span></div>)}</div></SettingsSection>
  </div>;
}