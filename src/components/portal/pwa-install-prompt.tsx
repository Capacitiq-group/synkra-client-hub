import { useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallPrompt() {
  const { showPrompt, install, dismiss, isIOS, canInstall } = usePWAInstall();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  if (!showPrompt) return null;

  const showHelp = isIOS || !canInstall;
  return (
    <aside
      className="synkra-sheet-in fixed inset-x-0 bottom-0 z-[80] border-t p-6 md:hidden"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
      }}
      aria-label="Install Synkra"
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "var(--accent-green)",
          letterSpacing: "0.1em",
        }}
      >
        SYNKRA
      </p>
      <h2 className="mt-2" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
        Add Synkra to your home screen
      </h2>
      <p className="mt-2" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        Access your workflows faster without opening a browser.
      </p>
      <div className="relative mt-5 flex gap-3">
        {showIOSHelp && (
          <div
            className="absolute bottom-12 right-0 w-64 border p-3"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowIOSHelp(false)}
              className="absolute right-2 top-2"
              aria-label="Close instructions"
            >
              <X size={14} />
            </button>
            <p className="pr-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Share className="mr-1 inline" size={14} /> Tap the Share button then select Add to
              Home Screen.
            </p>
          </div>
        )}
        <Button type="button" variant="ghost" className="flex-1" onClick={dismiss}>
          Not now
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => (showHelp ? setShowIOSHelp(true) : void install())}
        >
          {showHelp ? "Show me how" : "Add to home screen"}
        </Button>
      </div>
    </aside>
  );
}
