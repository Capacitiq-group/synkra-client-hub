export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  danger,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 420,
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
          {body}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="synkra-focus rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 13,
              padding: "8px 16px",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="synkra-focus rounded-md font-semibold"
            style={{
              backgroundColor: danger ? "var(--state-error)" : "var(--accent-green)",
              color: danger ? "#ffffff" : "#0A0A0A",
              fontSize: 13,
              padding: "8px 18px",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
