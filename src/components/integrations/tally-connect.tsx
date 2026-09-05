import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { connectTallyApiKey } from "@/lib/workflow/api";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";

/**
 * Tally has no OAuth app to connect to — its API is authenticated with a
 * single account-wide API key (see services/tally_service.py's
 * docstring server-side for why there's nothing more granular to
 * request). The user copies the key from Tally's own
 * Settings > Integrations > API page and pastes it here; it's verified
 * against a live Tally call before ever being stored, same as every
 * other provider's "Test connection" does after the fact.
 */
export function TallyConnectButton({ onConnected }: { onConnected?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!user || !apiKey.trim()) return;
    setConnecting(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const decision = (await checkIntegrationConnectFn({ data: { token } })) as unknown as {
        ok: boolean;
        message?: string;
      };
      if (!decision.ok) {
        toast.error(decision.message || INTEGRATIONS_PAID_PLAN_NOTE);
        return;
      }

      const result = await connectTallyApiKey(user.id, apiKey.trim());
      if (result.connected) {
        toast.success("Tally connected");
        await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
        setOpen(false);
        setApiKey("");
        onConnected?.();
      } else {
        toast.error("Tally did not report a connection. Please try again.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Tally. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!user}>Connect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Tally</DialogTitle>
          <DialogDescription>
            Paste an API key from Tally's Settings &gt; Integrations &gt; API page. This key gives
            Synkra the same access you have across your whole Tally account — Tally doesn't yet support
            narrower, per-form API keys.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="tally-api-key">API key</Label>
          <Input
            id="tally-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="tly_..."
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={connecting}>
            Cancel
          </Button>
          <Button onClick={() => void handleConnect()} disabled={connecting || !apiKey.trim()}>
            {connecting ? "Verifying…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
