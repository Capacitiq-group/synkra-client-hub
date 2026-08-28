/**
 * Student discount verification (Section 4, 28 Aug 2026).
 *
 * Shown in the billing tab. A user with a .ac.za email never sees this at
 * all — that path is decided at signup, before this component can even
 * render (see resolveOrCreateUser in billing.server.ts). This component
 * only handles the document-upload path for everyone else.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Upload, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { submitStudentVerification } from "@/lib/student-verification";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "application/pdf,image/jpeg,image/png,image/webp";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
    >
      {children}
    </div>
  );
}

export function StudentVerificationSettings() {
  const { user, refreshUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (f: File) => submitStudentVerification(f),
    onSuccess: async (data) => {
      setResult(data.message);
      setFile(null);
      await refreshUser?.();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not submit your document.");
    },
  });

  // .ac.za signups already have student_verified=true with no row of their
  // own to review — nothing to show them here beyond a confirmation.
  const status = user?.student_verification_status ?? "none";

  if (user?.student_verified) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} style={{ color: "var(--accent-green)" }} />
          <span className="text-[14px] font-semibold">Student discount active</span>
        </div>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Your next invoice already reflects the discounted price.
        </p>
      </Card>
    );
  }

  if (status === "pending") {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Clock size={18} style={{ color: "var(--text-secondary)" }} />
          <span className="text-[14px] font-semibold">Verification in review</span>
        </div>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          We&apos;re reviewing your document. This can take a little while — we&apos;ll email you
          once it&apos;s confirmed.
        </p>
      </Card>
    );
  }

  function handleFile(selected: File | null) {
    setError(null);
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("File too large (max 10MB).");
      return;
    }
    setFile(selected);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">Student discount</span>
        {status === "rejected" && (
          <span
            className="flex items-center gap-1 text-[12px]"
            style={{ color: "var(--state-error)" }}
          >
            <XCircle size={14} /> Previous submission not approved
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Upload a current student ID, proof of registration, or similar document from your
        institution. PDF, JPEG, PNG, or WebP — max 10MB.
      </p>

      <label
        className="mt-4 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg text-[13px]"
        style={{
          border: "1px dashed var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        <Upload size={18} />
        {file ? file.name : "Choose a file"}
        <input
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      {result && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--accent-green)" }}>
          {result}
        </p>
      )}

      <button
        type="button"
        disabled={!file || mutation.isPending}
        onClick={() => file && mutation.mutate(file)}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent-green)", color: "var(--bg-base)" }}
      >
        {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        {mutation.isPending ? "Submitting…" : "Submit for review"}
      </button>
    </Card>
  );
}
