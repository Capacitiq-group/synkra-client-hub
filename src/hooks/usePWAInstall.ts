import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("synkra-pwa-dismissed")) return;
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const timer = window.setTimeout(
      () => {
        if (window.innerWidth < 768) setShowPrompt(true);
      },
      3 * 60 * 1000,
    );
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      localStorage.setItem("synkra-pwa-dismissed", "true");
      return true;
    }
    return false;
  };

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("synkra-pwa-dismissed", "true");
  };

  return { showPrompt, install, dismiss, isIOS, canInstall: Boolean(installPrompt) };
}
