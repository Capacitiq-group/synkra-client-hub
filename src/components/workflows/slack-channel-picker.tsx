import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { SlackConnectButton } from "@/components/integrations/slack-connect";
import { fetchSlackChannels, fetchSlackStatus } from "@/lib/workflow/api";
import { PlainField } from "./variables-popover";

/**
 * Trigger-config UI for the slack_* trigger types.
 *
 * Not connected -> short explanation + the shared Nango connect popup.
 * Connected     -> channel <select> writing into config.channel_id.
 *
 * Only channels the Synkra bot has been added to come back from the backend,
 * so that limitation is stated under the picker rather than left to guesswork.
 */
export function SlackChannelPicker({
  channelId,
  onChange,
}: {
  channelId: string;
  onChange: (channelId: string) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  const statusQuery = useQuery({
    queryKey: ["slack-status", userId],
    queryFn: () => fetchSlackStatus(userId!),
    enabled: Boolean(userId),
  });

  const connected = statusQuery.data?.connected === true;

  const channelsQuery = useQuery({
    queryKey: ["slack-channels", userId],
    queryFn: () => fetchSlackChannels(userId!),
    enabled: Boolean(userId) && connected,
  });

  if (!userId) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Sign in again to choose a Slack channel.
      </p>
    );
  }

  if (statusQuery.isLoading) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Checking your Slack connection…</p>
    );
  }

  if (!connected) {
    return (
      <div
        className="flex flex-col items-start gap-2 rounded-md p-3"
        style={{ border: "1px solid var(--border-default)" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Connect Slack to pick a channel
        </span>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          This trigger watches one Slack channel. Connect your workspace and the channels the
          Synkra bot has been added to will show up here.
        </p>
        <SlackConnectButton onConnected={() => void statusQuery.refetch()} />
      </div>
    );
  }

  const channels = channelsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1">
      {channelsQuery.isLoading ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading your channels…</p>
      ) : channelsQuery.isError ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          We could not load your Slack channels. Please try again in a moment.
        </p>
      ) : (
        <PlainField
          label="Slack channel"
          value={channelId}
          onChange={onChange}
          options={[
            { value: "", label: channels.length ? "Choose a channel…" : "No channels available" },
            ...channels.map((channel) => ({ value: channel.id, label: `#${channel.name}` })),
          ]}
        />
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Only channels you have added the Synkra bot to in Slack appear here.
      </p>
    </div>
  );
}
