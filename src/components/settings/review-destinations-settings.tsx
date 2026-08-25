import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveAction } from "@/hooks/useSaveAction";
import pb from "@/lib/pocketbase";
import { sanitizeInput } from "@/lib/sanitize";
import {
  checkReviewUrl,
  findReviewDestination,
  REVIEW_DESTINATIONS,
  type ReviewDestinationId,
} from "@/lib/reviews/destinations";
import {
  activeReviewDestinations,
  parseReviewDestinations,
  primaryReviewUrl,
  reviewDestinationsPayload,
  reviewLinksText,
  type UserReviewDestination,
} from "@/lib/reviews/user-destinations";
import { fieldStyle, SettingsSection } from "./settings-primitives";

const NAMES: Record<string, string> = Object.fromEntries(
  REVIEW_DESTINATIONS.map((destination) => [destination.id, destination.name]),
);

function policyLine(id: ReviewDestinationId): { text: string; verified: boolean } {
  const destination = findReviewDestination(id);
  if (!destination) return { text: "", verified: false };
  return {
    text: destination.crossPost.finding,
    verified: destination.crossPost.status !== "unverified",
  };
}

/**
 * Multi-destination review links.
 *
 * Review requests are outbound messages carrying a link, so every destination
 * with a public review URL works through the existing email automation. No
 * review content is ever published to a platform on the customer's behalf —
 * see src/lib/reviews/destinations.ts for the per-platform API/terms findings.
 */
export function ReviewDestinationsSettings() {
  const { user, refreshUser } = useAuth();
  const fromUser = (): UserReviewDestination[] =>
    parseReviewDestinations({
      review_destinations: user?.review_destinations,
      review_link: user?.review_link,
    });

  const [rows, setRows] = useState<UserReviewDestination[]>(fromUser);
  useEffect(() => setRows(fromUser()), [user]);

  const { run: save, saving } = useSaveAction(
    async (userId: string, values: UserReviewDestination[]) => {
      const invalid = values.find((row) => {
        if (!row.url.trim()) return false;
        return !checkReviewUrl(row.id, row.url).ok;
      });
      if (invalid) {
        throw new Error(
          `The ${NAMES[invalid.id] ?? invalid.id} link is not a valid web address.`,
        );
      }
      await pb.collection("users").update(userId, reviewDestinationsPayload(values));
      await refreshUser();
    },
    { success: "Review destinations saved" },
  );

  const saved = useMemo(fromUser, [user]);
  const changed = JSON.stringify(rows) !== JSON.stringify(saved);
  const active = activeReviewDestinations(rows);
  const linkBlock = reviewLinksText(rows, NAMES);

  const available = REVIEW_DESTINATIONS.filter(
    (destination) => !rows.some((row) => row.id === destination.id),
  );

  const setUrl = (id: ReviewDestinationId, url: string) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, url } : row)));
  const toggle = (id: ReviewDestinationId) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, enabled: !row.enabled } : row)),
    );
  const remove = (id: ReviewDestinationId) =>
    setRows((current) => current.filter((row) => row.id !== id));
  const add = (id: ReviewDestinationId) =>
    setRows((current) =>
      current.some((row) => row.id === id) ? current : [...current, { id, url: "", enabled: true }],
    );

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Your browser blocked copying. Select the text and copy it manually.");
    }
  };

  if (!user) return null;

  return (
    <SettingsSection title="Review destinations">
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Review requests are sent as a message containing your review links. Add every place you
        want customers to review you — the first enabled destination is the one used by automations
        that only support a single link.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No destinations added yet.
          </p>
        )}

        {rows.map((row, index) => {
          const destination = findReviewDestination(row.id);
          if (!destination) return null;
          const check = row.url.trim() ? checkReviewUrl(row.id, row.url) : null;
          const policy = policyLine(row.id);
          const isPrimary = active[0]?.id === row.id;
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 p-4"
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                    {destination.name}
                  </span>
                  {isPrimary && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--accent-green)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 999,
                        padding: "1px 8px",
                      }}
                    >
                      Primary
                    </span>
                  )}
                  {!destination.linkSupported && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Not wired up yet
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(row.id)}
                    aria-pressed={row.enabled}
                    className="synkra-focus rounded-md"
                    style={{ fontSize: 12, color: "var(--text-secondary)", padding: "2px 6px" }}
                  >
                    {row.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    aria-label={`Remove ${destination.name}`}
                    className="synkra-focus rounded-md"
                    style={{ color: "var(--text-muted)", padding: 4 }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="sr-only">{destination.linkLabel}</span>
                <input
                  value={row.url}
                  onChange={(e) => setUrl(row.id, e.target.value)}
                  placeholder={destination.linkPlaceholder}
                  style={fieldStyle}
                  aria-label={destination.linkLabel}
                />
              </label>

              {check && !check.ok && (
                <span
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 12, color: "var(--state-error, #ef4444)" }}
                >
                  <AlertTriangle size={12} aria-hidden="true" />
                  {check.message}
                </span>
              )}
              {check?.ok && check.warning && (
                <span
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 12, color: "var(--state-warning)" }}
                >
                  <AlertTriangle size={12} aria-hidden="true" />
                  {check.message}
                </span>
              )}

              <span
                className="flex items-start gap-1.5"
                style={{ fontSize: 12, color: "var(--text-muted)" }}
              >
                {policy.verified ? (
                  <Check size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                )}
                <span>
                  {policy.verified ? "Checked: " : "Not checked yet: "}
                  {policy.text}
                </span>
              </span>

              {destination.notes?.map((note) => (
                <span key={note} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {note}
                </span>
              ))}

              {row.url.trim() && (
                <button
                  type="button"
                  onClick={() => void copy(row.url.trim())}
                  className="synkra-focus inline-flex w-fit items-center gap-1 rounded-md"
                  style={{ fontSize: 12, color: "var(--accent-green)", padding: "2px 4px" }}
                >
                  <Copy size={12} aria-hidden="true" />
                  Copy link
                </button>
              )}
              <span className="sr-only">{`Position ${index + 1}`}</span>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {available.map((destination) => (
            <button
              key={destination.id}
              type="button"
              onClick={() => add(destination.id)}
              className="synkra-focus inline-flex items-center gap-1 rounded-md"
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "6px 10px",
              }}
            >
              <Plus size={12} aria-hidden="true" />
              Add {destination.name}
            </button>
          ))}
        </div>
      )}

      {linkBlock && (
        <div className="mt-5">
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
            Paste-ready links for your review request message
          </span>
          <pre
            className="mt-1.5 overflow-auto"
            style={{
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              fontSize: 12,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {linkBlock}
          </pre>
          <button
            type="button"
            onClick={() => void copy(linkBlock)}
            className="synkra-focus mt-1.5 inline-flex items-center gap-1 rounded-md"
            style={{ fontSize: 12, color: "var(--accent-green)", padding: "2px 4px" }}
          >
            <Copy size={12} aria-hidden="true" />
            Copy all links
          </button>
          <p className="mt-1.5" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            The email action sends whatever text you paste, so these are the real links rather than
            placeholders. Single-link automations use{" "}
            <span style={{ color: "var(--text-secondary)" }}>{primaryReviewUrl(rows)}</span>.
          </p>
        </div>
      )}

      <Button
        className="mt-5 h-10 w-full sm:w-fit"
        disabled={saving || !changed}
        onClick={() => void save(user.id, rows)}
      >
        {saving ? "Saving…" : "Save review destinations"}
      </Button>
    </SettingsSection>
  );
              }
