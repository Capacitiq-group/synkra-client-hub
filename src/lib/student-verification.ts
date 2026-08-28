// Section 4 (28 Aug 2026) — student discount verification.
// Every call carries the signed-in user's real PocketBase auth token; the
// backend derives the acting identity from that token, never from a
// request field. See routers/student_verification.py in synkra-core.
//
// submitStudentVerification is used by every signed-in user, from their own
// settings page. The three admin-only functions below are gated a second,
// independent way server-side (ADMIN_ALERT_EMAILS) — the frontend never
// decides who counts as an admin, it just surfaces whatever the backend
// allows or rejects.
import pb from "@/lib/pocketbase";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

export interface StudentVerificationRecord {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  institution_name?: string;
  document_year?: string;
  name_on_document?: string;
  verification_method: "academic_email" | "document_upload";
  created?: string;
}

function authHeaders(): HeadersInit {
  const token = pb.authStore.token;
  if (!token) throw new Error("You are signed out. Sign in again to continue.");
  return { Authorization: `Bearer ${token}` };
}

/** Uploads a document for review. multipart/form-data — do not set Content-Type,
 * the browser sets the correct boundary automatically. */
export async function submitStudentVerification(
  file: File,
): Promise<{ status: "approved" | "pending"; message: string }> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE}/student-verification/submit`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || `${response.status} ${response.statusText}`);
  }
  return data;
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/student-verification${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Admin-only. The backend independently enforces this — this call will
 * simply fail with 403 for anyone else, which is the real gate. */
export async function listPendingStudentVerifications(): Promise<StudentVerificationRecord[]> {
  const data = await adminRequest<{ items: StudentVerificationRecord[] }>("/pending");
  return data.items ?? [];
}

export async function approveStudentVerification(id: string): Promise<void> {
  await adminRequest<void>(`/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export async function rejectStudentVerification(id: string): Promise<void> {
  await adminRequest<void>(`/${encodeURIComponent(id)}/reject`, { method: "POST" });
}
