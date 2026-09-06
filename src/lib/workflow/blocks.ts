{
  key: "typeform_response_received",
  kind: "trigger",
  subtype: "typeform_response_received",
  label: "New Typeform response",
  description: "Fires when someone submits a Typeform",
  icon: ClipboardList,
  color: "var(--accent-green)",
  section: "TRIGGERS",
  requiresIntegration: "typeform",
  configHint:
    "Starts this workflow whenever someone submits the Typeform you choose.",
  configNote:
    "Synkra automatically registers the webhook when you publish this workflow.",
  defaultConfig: {
    form_id: "",
    match_all: true,
  },
},
