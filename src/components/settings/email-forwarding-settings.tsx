import { ForwardingAddressCard } from "@/components/email/forwarding-address-card";
import { SettingsSection } from "./settings-primitives";

/**
 * Account-level view of the dedicated forwarding address. Nothing to create
 * or configure — the address already exists for every account.
 */
export function EmailForwardingSettings() {
  return (
    <SettingsSection title="Email forwarding">
      <ForwardingAddressCard showHeader={false} />
    </SettingsSection>
  );
}

export default EmailForwardingSettings;
