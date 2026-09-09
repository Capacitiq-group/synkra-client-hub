# PocketBase collections

Documentation of the **actual** PocketBase schema used by `synkra-client-hub`.

Authoritative definitions live in `src/lib/setup/createCollections.ts`
(`COLLECTIONS` + `USER_FIELDS`). Mirrors that must stay consistent with it:

| Path                                 | Role                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `src/lib/setup/createCollections.ts` | Authoritative. Used by the in-app `/setup` flow.        |
| `src/lib/setupCollections.ts`        | Legacy one-off browser helper. Mirrors the same schema. |
| `scripts/seed-pocketbase.mjs`        | Deploy-time seeding. Mirrors the `users` fields.        |
| `pb_schema.json`                     | Importable export of the collections documented here.   |

General notes:

- Relations are stored as **plain text ids** (`user_id`, `workspace_id`,
  `workflow_id`) rather than PocketBase relation fields, because the server
  layer resolves them with `pb.filter()` using the superuser client.
- All usage/seat/role state is written **server-side only** through
  `src/lib/usage/pocketbase.server.ts` (`adminClient`). The browser never holds
  superuser credentials, so list/view/create/update rules on these collections
  should stay closed to `users` except where the app reads them directly
  (workflows, workflow_runs, integrations for the owning user).
- `created` / `updated` are `autodate` fields and must be requested explicitly
  when a collection is created through the API.

---

## `users` (auth)

Purpose: portal accounts, business profile, notification prefs, plan tier and
monthly usage counters.

Fields added on top of PocketBase's built-in auth fields:

| Field                                                                                                             | Type                                                   | Notes                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                                                                            | text                                                   | Display name.                                                                                                                                                                                                                                                                                       |
| `business_name`, `business_industry`, `business_address`                                                          | text                                                   | Business profile.                                                                                                                                                                                                                                                                                   |
| `whatsapp_number`, `review_link`                                                                                  | text                                                   | Integration helpers.                                                                                                                                                                                                                                                                                |
| `review_destinations`                                                                                             | json                                                   | Multi-destination review links (Google, HelloPeter, own website widget, other). Array of `{ id, url, enabled }` parsed by `parseReviewDestinations()` in `src/lib/reviews/user-destinations.ts`. `review_link` is kept in sync with the primary active destination and remains the legacy fallback. |
| `is_tester`                                                                                                       | bool                                                   | Beta tester flag.                                                                                                                                                                                                                                                                                   |
| `user_type`                                                                                                       | select `beta` \| `paid`                                | Legacy account classification.                                                                                                                                                                                                                                                                      |
| `trial_ends_at`                                                                                                   | date                                                   |                                                                                                                                                                                                                                                                                                     |
| `theme_preference`                                                                                                | select `dark` \| `light` \| `system`                   |                                                                                                                                                                                                                                                                                                     |
| `notify_on_failure`, `notify_weekly_summary`, `notify_on_success`, `notify_credit_low`, `notify_platform_updates` | bool                                                   | Notification prefs.                                                                                                                                                                                                                                                                                 |
| `notification_email`                                                                                              | email                                                  |                                                                                                                                                                                                                                                                                                     |
| `credit_emails`, `credit_emails_used`, `credit_workflows`, `credit_workflows_used`                                | number                                                 | Legacy beta credits.                                                                                                                                                                                                                                                                                |
| `onboarding_completed`                                                                                            | bool                                                   |                                                                                                                                                                                                                                                                                                     |
| `onboarding_step`                                                                                                 | number                                                 |                                                                                                                                                                                                                                                                                                     |
| **`tier`**                                                                                                        | select `free` \| `basic` \| `pro`                      | Plan tier. Read by `@/lib/plans` (`normalizeTier`); drives every limit including seats.                                                                                                                                                                                                             |
| **`student_verified`**                                                                                            | bool                                                   | Section 4 (28 Aug 2026). Drives `getEffectivePriceZar()` — the only thing that actually affects what a student is charged. Server-owned: set only by `resolveOrCreateUser()` (`.ac.za` email at signup) or by an admin approving a `student_verifications` row.                                     |
| **`student_verification_status`**                                                                                 | select `none` \| `pending` \| `approved` \| `rejected` | Display-only status for the user's own settings page. `student_verified` is the field that actually matters for pricing; this is UI convenience, not itself trusted for billing.                                                                                                                    |
| **`billing_period_start`**                                                                                        | date                                                   | Start of the current monthly counting window.                                                                                                                                                                                                                                                       |
| **`executions_used_this_month`**                                                                                  | number                                                 | Incremented by `startExecution()` only.                                                                                                                                                                                                                                                             |
| **`ai_ops_used_this_month`**                                                                                      | number                                                 | AI operation counter.                                                                                                                                                                                                                                                                               |
| **`emails_used_this_month`**                                                                                      | number                                                 | Email send counter.                                                                                                                                                                                                                                                                                 |
| **`storage_used_mb`**                                                                                             | number                                                 | Storage counter.                                                                                                                                                                                                                                                                                    |

Relationships: owner of `workspaces` (`workspaces.owner_id`), referenced by
`workspace_members.user_id`, `workflows.user_id`, `workflow_runs.user_id`.

Security: `tier` and every `*_used_this_month` counter are server-owned. They
must never be writable by an authenticated user — a self-service update rule on
these fields would let a user grant themselves an unlimited plan. Usage rollover
(`periodHasRolledOver`) is also applied server-side in `loadUsage()`.

---

## `workspaces` (base)

Purpose: the single workspace each account is allowed on every current plan.
Seats are a separate limit.

| Field                 | Type           | Notes                                         |
| --------------------- | -------------- | --------------------------------------------- |
| `owner_id`            | text, required | `users.id` of the owner.                      |
| `name`                | text, required | Editable by owner/admin (`workspace.update`). |
| `is_default`          | bool           | Marks the account's default workspace.        |
| `created` / `updated` | autodate       |                                               |

Indexes: `idx_workspaces_owner_id` on `owner_id` (every lookup filters by it).

Relationships: parent of `workspace_members` and `workspace_invitations`.

Security: workspace creation goes through `createWorkspaceFn` →
`checkWorkspaceCreationAllowed()`, which enforces one workspace per plan.
Ownership transfer is intentionally not implemented, and `removeMember` /
`changeMemberRole` refuse to touch the owner row.

---

## `workspace_members` (base)

Purpose: seats. One row per person per workspace. Read/written by
`src/lib/team/team.server.ts` — the field names below are exactly the ones that
file uses.

| Field                 | Type                                            | Notes                                                                                                              |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `workspace_id`        | text, required                                  | `workspaces.id`.                                                                                                   |
| `user_id`             | text, required                                  | `users.id`.                                                                                                        |
| `email`               | text                                            | Denormalised at join time; used for duplicate-invite checks.                                                       |
| `name`                | text                                            | Denormalised display name.                                                                                         |
| `role`                | select `owner` \| `admin` \| `member`, required | Permission matrix lives in `src/lib/team/roles.ts`.                                                                |
| `status`              | select `active` \| `removed`, required          | Only `active` rows consume a seat. Removal is a status flip, never a delete, so history and business data survive. |
| `invited_by`          | text                                            | `users.id` of the inviter (set on acceptance).                                                                     |
| `joined_at`           | date                                            | Falls back to `created` in the read model.                                                                         |
| `created` / `updated` | autodate                                        |                                                                                                                    |

Indexes: unique `(workspace_id, user_id)` — one membership row per person per
workspace; `ensureOwnerMembership()` relies on that uniqueness.

Security: the owner always has an `active` / `owner` row, recreated
automatically by `ensureOwnerMembership()`. Admins cannot remove or re-role
another admin; nobody can remove or re-role the owner; nobody can change their
own role.

---

## `workspace_invitations` (base)

Purpose: pending invitations. A pending invitation **reserves a seat** in
`computeSeatUsage()` until it is accepted, cancelled or expired.

| Field                 | Type                                                                 | Notes                                             |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| `workspace_id`        | text, required                                                       | `workspaces.id`.                                  |
| `email`               | text, required                                                       | Normalised to lowercase by `normalizeEmail()`.    |
| `role`                | select `admin` \| `member`, required                                 | `owner` can never be invited.                     |
| `status`              | select `pending` \| `accepted` \| `cancelled` \| `expired`, required | Only `pending` reserves a seat.                   |
| `token`               | text, required                                                       | `crypto.randomUUID()`; the acceptance credential. |
| `invited_by`          | text                                                                 | `users.id` of the inviter.                        |
| `expires_at`          | date                                                                 | Invite TTL is 7 days (`INVITATION_TTL_DAYS`).     |
| `accepted_at`         | date                                                                 | Set when accepted.                                |
| `created` / `updated` | autodate                                                             |                                                   |

Indexes: unique on `token` (acceptance looks up by token alone);
`workspace_id` index for the per-workspace listing.

Security: the token is a bearer credential — `workspace_invitations` must not
be listable by authenticated users, or anyone could read another workspace's
tokens. Acceptance re-checks that the caller's email matches the invitation,
that the invitation is still `pending` and unexpired, and that a seat is still
available (a downgrade between invite and accept blocks acceptance). Elapsed
invitations are lazily flipped to `expired` by `expirePendingInvitations()`.

---

## `workflow_runs` (base)

Purpose: the execution log and the execution-accounting record.

| Field                                    | Type                                                             | Notes                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `workflow_id`                            | text, required                                                   | `workflows.id`.                                                            |
| `user_id`                                | text, required                                                   | `users.id`.                                                                |
| **`status`**                             | select `running` \| `success` \| `failed` \| `blocked`, required | `blocked` records an attempt refused by the monthly limit.                 |
| **`execution_id`**                       | text                                                             | Stable id from the execution engine. Identifies ONE run; retries reuse it. |
| **`trigger_type`**                       | text                                                             | Trigger that started the run (`EXECUTION_TRIGGERS`).                       |
| **`attempt_count`**                      | number                                                           | Incremented on each retry of the same `execution_id`.                      |
| **`counted`**                            | bool                                                             | True when this run consumed one of the monthly executions.                 |
| **`blocked_reason`**                     | text                                                             | Populated only for `blocked` runs.                                         |
| `triggered_at`, `completed_at`           | date                                                             |                                                                            |
| `duration_ms`                            | number                                                           |                                                                            |
| `input_data`, `output_data`, `step_logs` | json                                                             | Stored as JSON strings.                                                    |
| `error_message`                          | text                                                             |                                                                            |
| `created` / `updated`                    | autodate                                                         |                                                                            |

Indexes:

- `idx_unique_workflow_runs_execution_id`: **partial** unique index —
  `CREATE UNIQUE INDEX ... ON workflow_runs (execution_id) WHERE execution_id != ''`.
  The partial clause matters: SQLite treats `''` as a real value, so a plain
  unique index would reject a second legacy/blank row. With the clause,
  first execution, retries of the same id, and separate executions all behave
  correctly, and blocked runs (which also carry an `execution_id`) are covered.
- `idx_workflow_runs_user_id` for per-user activity queries.

Security: one workflow run = at most one counted execution. Only
`startExecution()` increments `users.executions_used_this_month`;
`completeExecution()` finalises status/logs and never touches the counter, so a
failed run is not refunded and a completion callback cannot inflate usage. Both
public endpoints (`/api/public/executions/start`, `/api/public/executions/complete`)
require the `x-synkra-secret` shared secret (`API_SECRET`).

## `notifications` (base)

Purpose: persisted, per-user in-app notifications. Server writers create rows;
authenticated users may list, view, mark, or delete only rows whose `user_id`
matches their PocketBase auth id.

| Field                   | Type           | Notes                                                                                                                                                                          |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user_id`               | text, required | Recipient `users.id`.                                                                                                                                                          |
| `event_type`            | text, required | Extensible machine value; deliberately not a select field. Initial values: `workflow_completed`, `workflow_failed`, `credit_balance_low`, `weekly_summary`, `platform_update`. |
| `title`                 | text, required | Short feed heading.                                                                                                                                                            |
| `message`               | text           | Notification detail.                                                                                                                                                           |
| `workflow_id`, `run_id` | text           | Optional deep-link context.                                                                                                                                                    |
| `link`                  | text           | Optional internal `/dashboard...` fallback link.                                                                                                                               |
| `source`                | text           | Writer that produced the row (e.g. `slack_urgency_triage`, `slack_daily_digest`, `slack_unanswered_check`), so the frontend can show a per-source icon.                        |
| `severity`              | text           | `info`, `success`, `warning`, or `error`.                                                                                                                                      |
| `metadata`              | json           | Event-specific structured context.                                                                                                                                             |
| `read`                  | bool           | Unread by default.                                                                                                                                                             |
| `read_at`               | date           | Set when marked read.                                                                                                                                                          |
| `dedupe_key`            | text           | Stable delivery key for idempotent writers.                                                                                                                                    |
| `created` / `updated`   | autodate       | Feed ordering and audit timestamps.                                                                                                                                            |

Indexes: `(user_id, created)`, `(user_id, read)`, and a partial unique index on
non-empty `dedupe_key`. Browser create access is closed. Execution outcome and
low-credit writers run in `src/lib/usage/executions.server.ts`; weekly summaries
and platform updates use the secret-protected
`POST /api/public/notifications/create` endpoint.

## `integrations` (base)

Purpose: one row per connected platform per user.

| Field            | Type                                            | Notes                                                                                                                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`        | text, required                                  | Owner `users.id`.                                                                                                                                                                                                                                                                                  |
| `type`           | select                                          | Platform key — canonical list mirrors `src/lib/integrations/catalog.ts` (plus legacy `gmail`): `gmail`, `email`, `ai`, `webhook`, `slack`, `hubspot`, `zoho`, `clickup`, `notion`, `whatsapp`, `sms`, `shopify`, `typeform`, `tally`, `calendly`, `xero`, `airtable`, `monday`, `asana`, `pipedrive`.                                                                                                                                                                                                       |
| `credentials`    | json                                            | Real `access_token` / `refresh_token` values for platforms we hold tokens for (Gmail, HubSpot).                                                                                                                                                                                                    |
| `connection_id`  | text                                            | Provider-side connection identifier for platforms where a broker holds the token. Slack connects through Nango: Nango stores the token and we only keep the id it knows the connection by (by convention the user's own id). Kept as its own explicit field rather than overloading `credentials`. |
| `status`         | select `connected` \| `disconnected` \| `error` |                                                                                                                                                                                                                                                                                                    |
| `display_name`   | text                                            |                                                                                                                                                                                                                                                                                                    |
| `last_tested_at` | date                                            |                                                                                                                                                                                                                                                                                                    |
| `error_message`  | text                                            |                                                                                                                                                                                                                                                                                                    |

## `student_verifications` (base, server-only)

Purpose: Section 4 of the 28 Aug 2026 handover — the student discount
program. One row per verification attempt (a user can have more than one
if a first upload is rejected and they try again). This collection only
ever records the _attempt_; the actual entitlement lives on the `users`
record itself (`student_verified`, `student_verification_status`), which
is what `getEffectivePriceZar()` in `plans.ts` actually reads at
checkout/billing time — never this collection directly.

Two ways to reach `student_verified: true`, and this collection is only
involved in one of them:

- **Academic email** (`.ac.za`): decided entirely at account-creation time
  in `resolveOrCreateUser()` (billing.server.ts). No document, no AI call,
  no row in this collection at all.
- **Document upload**: goes through synkra-core's `/student-verification/submit`
  endpoint, which reads the document (PyMuPDF for real-text PDFs, the AI
  vision layer for images/scanned PDFs — see that service's own docstring
  for the current live limitation with a text-only Ollama model), and
  either auto-approves (all of: year matches current year, name on the
  document plausibly matches the account name, and the AI's own
  `is_higher_education` check says yes) or leaves it `pending` for manual
  review via `/admin` on this app.

| Field                 | Type                                                   | Notes                                                                                       |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `user_id`             | text, required                                         | `users.id`.                                                                                 |
| `status`              | select `pending` \| `approved` \| `rejected`, required | Set by synkra-core, or by an admin via the approve/reject endpoints.                        |
| `document`            | file (PDF/JPEG/PNG/WebP, max 10MB)                     | The uploaded proof. Not present for the academic-email path.                                |
| `institution_name`    | text                                                   | AI-extracted, shown to the admin reviewing a pending case.                                  |
| `document_year`       | text                                                   | AI-extracted. Auto-approval requires this to equal the current year.                        |
| `name_on_document`    | text                                                   | AI-extracted. Auto-approval requires this to plausibly match the account's registered name. |
| `verification_method` | select `academic_email` \| `document_upload`, required |                                                                                             |
| `reviewed_by`         | text                                                   | Admin's user id, set only when a human approved/rejected a pending case.                    |

Indexes:

- `idx_student_verifications_user`: on `user_id` — an admin or the owning
  user's own settings page can list a user's verification history.
- `idx_student_verifications_status`: on `status` — the admin panel's
  pending-review list filters on this.

## `execution_pack_purchases` (base, server-only)

Purpose: one row per purchased execution top-up pack. Separate from
`addon_purchases` — the add-on system (`ai_ops`, `sms`, `whatsapp`,
`voice_minutes`, `storage_gb`) is untouched by this kind.

| Field                              | Type                                                                            | Notes                                                |
| ---------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `user_id`                          | text, required                                                                  | `users.id`.                                          |
| `kind`                             | select `executions`, required                                                   | The new purchasable kind.                            |
| `pack_id`                          | select `exec_250` \| `exec_1000` \| `exec_5000` \| `exec_10000` \| `exec_25000` | Published pack. Prices live in `execution-packs.ts`. |
| `units`                            | number                                                                          | Executions granted by the pack.                      |
| `amount_cents`                     | number                                                                          | Recomputed server-side, never sent by the browser.   |
| `currency`, `provider`             | text                                                                            | `ZAR`, `paystack`.                                   |
| `reference`                        | text, required                                                                  | `SYN-EXECPACK-<units>-<uuid>`.                       |
| `authorization_url`, `access_code` | text                                                                            | Paystack checkout handles.                           |
| `status`                           | select `pending` \| `paid` \| `failed`, required                                |                                                      |
| `provider_transaction_id`          | text                                                                            |                                                      |
| `paid_at`                          | date                                                                            |                                                      |
| `error_message`                    | text                                                                            |                                                      |

Indexes:

- `idx_execution_pack_purchases_reference`: unique on `reference` — settlement
  from the webhook and from the return page is therefore idempotent.

## `execution_credits` (base, server-only)

Purpose: the standing purchased execution balance. One row per user. These
credits do **not** expire with the billing month; the monthly rollover in
`executions.server.ts` only zeroes the counters on the `users` record.

| Field                | Type                          | Notes                                                    |
| -------------------- | ----------------------------- | -------------------------------------------------------- |
| `user_id`            | text, required                | `users.id`.                                              |
| `kind`               | select `executions`, required |                                                          |
| `units_purchased`    | number                        | Lifetime purchased executions. Never reset.              |
| `units_used`         | number                        | Spent only after the monthly included allowance is gone. |
| `expires_monthly`    | bool                          | Always false — kept explicit for auditability.           |
| `first_purchased_at` | date                          |                                                          |
| `last_reference`     | text                          | Guards against double-granting one reference.            |

Indexes:

- `idx_execution_credits_user_id`: unique on `user_id` — a racing create is
  folded into the existing row.

Note: adding these two collections to a live PocketBase requires re-running the
first-time setup (`runFirstTimeSetup`, `/setup`) or applying `pb_schema.json`
manually. Until that happens, purchase writes fail.

## `consent_records` (base, server-only)

Purpose: append-only audit trail of terms/privacy acceptance and marketing
opt-in captured at checkout. Written by `createCheckout` in
`src/lib/billing/billing.server.ts` — never updated, one row per consent event.

| Field                | Type                                                | Notes                                              |
| -------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `user_id`            | text, required                                      | `users.id`.                                        |
| `checkout_reference` | text                                                | The `SYN-...` reference the consent was given for. |
| `consent_type`       | select `terms_and_privacy` \| `marketing`, required |                                                    |
| `granted`            | bool                                                | What the person actually chose.                    |
| `policy_version`     | text                                                | `terms:<v>;privacy:<v>`; empty for marketing.      |
| `granted_at`         | date                                                | ISO timestamp recorded server-side.                |
| `ip_address`         | text                                                | First entry of `x-forwarded-for`, when present.    |

Indexes:

- `idx_consent_records_user` on `user_id`
- `idx_consent_records_reference` on `checkout_reference`

## `ghost_mailboxes` (base, server-only)

Purpose: forwarding aliases on `@in.synkra.co.za`. Managed by synkra-core
(`routers/ghost_mailbox.py`) and read by inbound email relay.

| Field              | Type           | Notes                                         |
| ------------------ | -------------- | --------------------------------------------- |
| `user_id`          | text, required | Owner; every read is scoped to it.            |
| `address`          | text, required | Lowercased, must end with `@in.synkra.co.za`. |
| `forward_to_email` | text, required | Real inbox mail is relayed to.                |

Indexes:

- `idx_ghost_mailboxes_address`: unique on `address` — the create endpoint
  returns 409 on a taken address.
- `idx_ghost_mailboxes_user` on `user_id`

## `notion_poll_cursors` (base, server-only)

Purpose: watermark for the Notion database poll in synkra-core's scheduler, so
existing pages are never replayed as new-row triggers on the first run.

| Field               | Type           | Notes                                                  |
| ------------------- | -------------- | ------------------------------------------------------ |
| `workflow_id`       | text, required | Workflow whose Notion trigger this cursor belongs to.  |
| `user_id`           | text, required | Owner of the connected Notion account.                 |
| `database_id`       | text, required | Notion database being polled.                          |
| `last_created_time` | text           | Notion `created_time` of the newest page already seen. |

Indexes:

- `idx_notion_poll_cursors_workflow_db`: unique on (`workflow_id`,
  `database_id`).

Note: adding these three collections to a live PocketBase requires re-running
the first-time setup (`runFirstTimeSetup`, `/setup`) or applying
`pb_schema.json` manually.

## synkra-core owned collections (base, server-only)

These 23 collections are written and read by synkra-core's daily backend
workflows and the agency checkout flow. All rules are `null`, so only server
code holding `PB_ADMIN_*` can touch them. They are declared here and in
`pb_schema.json` so a freshly provisioned database comes up complete.

### `clients` (base, server-only)

| Field                         | Type   | Notes |
| ----------------------------- | ------ | ----- |
| `company_name`                | text   |       |
| `owner_name`                  | text   |       |
| `owner_email`                 | text   |       |
| `status`                      | text   |       |
| `application_credit_balance`  | number |       |
| `purchased_credit_balance`    | number |       |
| `banking_details`             | json   |       |
| `billing_address`             | text   |       |
| `daily_digest_enabled`        | bool   |       |
| `overdue_reminders_enabled`   | bool   |       |
| `timesheet_reminders_enabled` | bool   |       |

Indexes:

- `CREATE INDEX `idx_clients_status`ON`clients` (`status`)`

### `team_members` (base, server-only)

| Field                         | Type | Notes |
| ----------------------------- | ---- | ----- |
| `company_id`                  | text |       |
| `name`                        | text |       |
| `email`                       | text |       |
| `role`                        | text |       |
| `active`                      | bool |       |
| `date_of_birth`               | text |       |
| `work_start_date`             | text |       |
| `receive_timesheet_reminders` | bool |       |

Indexes:

- `CREATE INDEX `idx_team_members_company`ON`team_members` (`company_id`)`

### `leads` (base, server-only)

| Field           | Type   | Notes |
| --------------- | ------ | ----- |
| `company_id`    | text   |       |
| `full_name`     | text   |       |
| `email`         | text   |       |
| `phone`         | text   |       |
| `source`        | text   |       |
| `message`       | text   |       |
| `status`        | text   |       |
| `assigned_to`   | text   |       |
| `deal_value`    | number |       |
| `lost_reason`   | text   |       |
| `custom_fields` | json   |       |

Indexes:

- `CREATE INDEX `idx_leads_company`ON`leads` (`company_id`)`

### `revenue_log` (base, server-only)

| Field           | Type   | Notes |
| --------------- | ------ | ----- |
| `company_id`    | text   |       |
| `lead_id`       | text   |       |
| `amount`        | number |       |
| `customer_name` | text   |       |
| `type`          | text   |       |

Indexes:

- `CREATE INDEX `idx_revenue_log_company`ON`revenue_log` (`company_id`)`

### `support_tickets` (base, server-only)

| Field               | Type | Notes |
| ------------------- | ---- | ----- |
| `company_id`        | text |       |
| `ticket_id`         | text |       |
| `customer_name`     | text |       |
| `customer_email`    | text |       |
| `subject`           | text |       |
| `description`       | text |       |
| `priority`          | text |       |
| `status`            | text |       |
| `escalation_reason` | text |       |

Indexes:

- `CREATE INDEX `idx_support_tickets_company_status`ON`support_tickets` (`company_id`, `status`)`
- `CREATE INDEX `idx_support_tickets_ticket_id`ON`support_tickets` (`ticket_id`)`

### `refund_requests` (base, server-only)

| Field            | Type   | Notes |
| ---------------- | ------ | ----- |
| `company_id`     | text   |       |
| `reference`      | text   |       |
| `customer_name`  | text   |       |
| `customer_email` | text   |       |
| `amount`         | number |       |
| `reason`         | text   |       |
| `status`         | text   |       |

Indexes:

- `CREATE INDEX `idx_refund_requests_company`ON`refund_requests` (`company_id`)`

### `invoices` (base, server-only)

| Field            | Type   | Notes |
| ---------------- | ------ | ----- |
| `company_id`     | text   |       |
| `invoice_number` | text   |       |
| `customer_name`  | text   |       |
| `customer_email` | text   |       |
| `amount`         | number |       |
| `due_date`       | text   |       |
| `file_url`       | text   |       |
| `status`         | text   |       |

Indexes:

- `CREATE INDEX `idx_invoices_company_status`ON`invoices` (`company_id`, `status`)`
- `CREATE INDEX `idx_invoices_number`ON`invoices` (`invoice_number`)`

### `payments` (base, server-only)

| Field                | Type   | Notes |
| -------------------- | ------ | ----- |
| `company_id`         | text   |       |
| `invoice_number`     | text   |       |
| `amount`             | number |       |
| `reference`          | text   |       |
| `customer_name`      | text   |       |
| `status`             | text   |       |
| `matched_to_invoice` | text   |       |

Indexes:

- `CREATE INDEX `idx_payments_company`ON`payments` (`company_id`)`

### `pending_payments` (base, server-only)

| Field           | Type   | Notes |
| --------------- | ------ | ----- |
| `company_id`    | text   |       |
| `reference`     | text   |       |
| `amount`        | number |       |
| `credit_amount` | number |       |
| `status`        | text   |       |

Indexes:

- `CREATE INDEX `idx_pending_payments_reference`ON`pending_payments` (`reference`)`

### `credit_ledger` (base, server-only)

| Field           | Type   | Notes |
| --------------- | ------ | ----- |
| `company_id`    | text   |       |
| `type`          | text   |       |
| `amount`        | number |       |
| `balance_after` | number |       |
| `description`   | text   |       |
| `reference`     | text   |       |

Indexes:

- `CREATE INDEX `idx_credit_ledger_company`ON`credit_ledger` (`company_id`)`

### `expenses` (base, server-only)

| Field                | Type   | Notes |
| -------------------- | ------ | ----- |
| `company_id`         | text   |       |
| `reference`          | text   |       |
| `submitted_by`       | text   |       |
| `submitted_by_email` | text   |       |
| `amount`             | number |       |
| `category`           | text   |       |
| `description`        | text   |       |
| `receipt_url`        | text   |       |
| `status`             | text   |       |

Indexes:

- `CREATE INDEX `idx_expenses_company`ON`expenses` (`company_id`)`

### `purchase_orders` (base, server-only)

| Field             | Type   | Notes |
| ----------------- | ------ | ----- |
| `company_id`      | text   |       |
| `po_number`       | text   |       |
| `requested_by`    | text   |       |
| `requester_email` | text   |       |
| `supplier`        | text   |       |
| `items`           | json   |       |
| `total_amount`    | number |       |
| `justification`   | text   |       |
| `status`          | text   |       |

Indexes:

- `CREATE INDEX `idx_purchase_orders_company`ON`purchase_orders` (`company_id`)`

### `documents` (base, server-only)

| Field            | Type | Notes |
| ---------------- | ---- | ----- |
| `company_id`     | text |       |
| `type`           | text |       |
| `reference`      | text |       |
| `customer_name`  | text |       |
| `customer_email` | text |       |
| `file_url`       | text |       |
| `status`         | text |       |

Indexes:

- `CREATE INDEX `idx_documents_company`ON`documents` (`company_id`)`

### `file_logs` (base, server-only)

| Field        | Type | Notes |
| ------------ | ---- | ----- |
| `company_id` | text |       |
| `filename`   | text |       |
| `file_url`   | text |       |
| `file_type`  | text |       |
| `folder`     | text |       |
| `status`     | text |       |

Indexes:

- `CREATE INDEX `idx_file_logs_company`ON`file_logs` (`company_id`)`

### `onboarding_tasks` (base, server-only)

| Field             | Type | Notes |
| ----------------- | ---- | ----- |
| `company_id`      | text |       |
| `employee_name`   | text |       |
| `employee_email`  | text |       |
| `role`            | text |       |
| `start_date`      | text |       |
| `status`          | text |       |
| `tasks_completed` | json |       |

Indexes:

- `CREATE INDEX `idx_onboarding_tasks_company`ON`onboarding_tasks` (`company_id`)`

### `leave_requests` (base, server-only)

| Field            | Type | Notes |
| ---------------- | ---- | ----- |
| `company_id`     | text |       |
| `reference`      | text |       |
| `employee_name`  | text |       |
| `employee_email` | text |       |
| `leave_type`     | text |       |
| `start_date`     | text |       |
| `end_date`       | text |       |
| `reason`         | text |       |
| `status`         | text |       |

Indexes:

- `CREATE INDEX `idx_leave_requests_company`ON`leave_requests` (`company_id`)`

### `performance_reviews` (base, server-only)

| Field            | Type | Notes |
| ---------------- | ---- | ----- |
| `company_id`     | text |       |
| `employee_name`  | text |       |
| `employee_email` | text |       |
| `review_date`    | text |       |
| `status`         | text |       |

Indexes:

- `CREATE INDEX `idx_performance_reviews_company`ON`performance_reviews` (`company_id`)`

### `content_approvals` (base, server-only)

| Field             | Type | Notes |
| ----------------- | ---- | ----- |
| `company_id`      | text |       |
| `reference`       | text |       |
| `submitted_by`    | text |       |
| `submitter_email` | text |       |
| `content_title`   | text |       |
| `content_type`    | text |       |
| `content_url`     | text |       |
| `notes`           | text |       |
| `status`          | text |       |

Indexes:

- `CREATE INDEX `idx_content_approvals_company`ON`content_approvals` (`company_id`)`

### `newsletter_subscribers` (base, server-only)

| Field        | Type | Notes |
| ------------ | ---- | ----- |
| `company_id` | text |       |
| `email`      | text |       |
| `name`       | text |       |
| `status`     | text |       |
| `source`     | text |       |

Indexes:

- `CREATE UNIQUE INDEX `idx_newsletter_subscribers_company_email`ON`newsletter_subscribers` (`company_id`, `email`)`

### `webinar_registrations` (base, server-only)

| Field          | Type | Notes |
| -------------- | ---- | ----- |
| `company_id`   | text |       |
| `email`        | text |       |
| `name`         | text |       |
| `webinar_name` | text |       |
| `webinar_date` | text |       |
| `status`       | text |       |

Indexes:

- `CREATE INDEX `idx_webinar_registrations_company`ON`webinar_registrations` (`company_id`)`

### `workflow_logs` (base, server-only)

| Field        | Type | Notes |
| ------------ | ---- | ----- |
| `company_id` | text |       |
| `workflow`   | text |       |
| `entity_id`  | text |       |
| `action`     | text |       |
| `status`     | text |       |
| `metadata`   | json |       |

Indexes:

- `CREATE INDEX `idx_workflow_logs_company`ON`workflow_logs` (`company_id`)`

### `pending_approvals` (base, server-only)

| Field             | Type | Notes |
| ----------------- | ---- | ----- |
| `user_id`         | text |       |
| `type`            | text |       |
| `status`          | text |       |
| `subject`         | text |       |
| `body`            | text |       |
| `recipient_email` | text |       |
| `recipient_name`  | text |       |
| `zoho_followup`   | json |       |

Indexes:

- `CREATE INDEX `idx_pending_approvals_user_status`ON`pending_approvals` (`user_id`, `status`)`

### `agency_quote_requests` (base, server-only)

| Field                   | Type   | Notes |
| ----------------------- | ------ | ----- |
| `contact_name`          | text   |       |
| `contact_email`         | text   |       |
| `contact_phone`         | text   |       |
| `company_name`          | text   |       |
| `service_slug`          | text   |       |
| `qualification_answers` | json   |       |
| `computed_tier`         | text   |       |
| `computed_monthly`      | number |       |
| `computed_setup`        | number |       |
| `qualification_passed`  | bool   |       |
| `status`                | text   |       |
| `zoho_contact_id`       | text   |       |
| `zoho_estimate_id`      | text   |       |

Indexes:

- `CREATE INDEX `idx_agency_quote_requests_status`ON`agency_quote_requests` (`status`)`
- `CREATE INDEX `idx_agency_quote_requests_email`ON`agency_quote_requests` (`contact_email`)`

### `error_logs` (base, server-only)

Purpose: durable history of every failure recorded by `synkra-core`'s alerting
module (`services/alerting.py`) — unhandled request errors, failed scheduled
jobs and missed runs, failed workflow runs, and browser crashes posted by the
portal to `POST /client-errors/report` (see
`src/lib/client-error-reporting.ts`). Rows are written by core with superuser
credentials; the browser never reads or writes this collection directly.

| Field         | Type | Notes                                                                 |
| ------------- | ---- | --------------------------------------------------------------------- |
| `service`     | text | `synkra-core`, or `synkra-client-hub` for browser crashes.            |
| `environment` | text | `production`, `staging`, `development`.                               |
| `level`       | text | `error`, `critical`.                                                   |
| `source`      | text | Origin, e.g. `request`, `scheduled:<job>`, `workflow`, `browser:react`. |
| `message`     | text | Truncated to 2000 chars.                                               |
| `stack`       | text | Truncated to 4000 chars (8000 accepted from the browser).             |
| `fingerprint` | text | Dedupe key; repeat alerts are suppressed, but every row is still saved. |
| `context`     | json | Workflow / user / run details, URL, user agent, IP.                    |
| `created_at`  | text | ISO-8601 UTC timestamp set by the writer.                              |

Indexes:

- `CREATE INDEX `idx_error_logs_fingerprint`ON`error_logs` (`fingerprint`)`
- `CREATE INDEX `idx_error_logs_created`ON`error_logs` (`created_at`)`
- `CREATE INDEX `idx_error_logs_service`ON`error_logs` (`service`)`
