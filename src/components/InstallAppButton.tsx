import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const LIVE_URL = "https://ether-playpen.lovable.app";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(isInIframe());
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span
        className="hidden md:inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
        title="Running as installed app"
      >
        <Check className="h-3 w-3" /> App
      </span>
    );
  }

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else {
      setShowHelp(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleClick}
        title="Install Open Trader as a desktop app"
        aria-label="Install app"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install app</span>
      </Button>
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-sm">
          {inIframe ? (
            <>
              <DialogHeader>
                <DialogTitle>Open Trader</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button asChild>
                  <a href={LIVE_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open live site
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Open Trader</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setShowHelp(false)}>Got it</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
