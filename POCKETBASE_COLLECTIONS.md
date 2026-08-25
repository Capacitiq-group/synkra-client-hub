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

| Field                                                                                                             | Type                                 | Notes                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `name`                                                                                                            | text                                 | Display name.                                                                           |
| `business_name`, `business_industry`, `business_address`                                                          | text                                 | Business profile.                                                                       |
| `whatsapp_number`, `review_link`                                                                                  | text                                 | Integration helpers.                                                                    |
| `is_tester`                                                                                                       | bool                                 | Beta tester flag.                                                                       |
| `user_type`                                                                                                       | select `beta` \| `paid`              | Legacy account classification.                                                          |
| `trial_ends_at`                                                                                                   | date                                 |                                                                                         |
| `theme_preference`                                                                                                | select `dark` \| `light` \| `system` |                                                                                         |
| `notify_on_failure`, `notify_weekly_summary`, `notify_on_success`, `notify_credit_low`, `notify_platform_updates` | bool                                 | Notification prefs.                                                                     |
| `notification_email`                                                                                              | email                                |                                                                                         |
| `credit_emails`, `credit_emails_used`, `credit_workflows`, `credit_workflows_used`                                | number                               | Legacy beta credits.                                                                    |
| `onboarding_completed`                                                                                            | bool                                 |                                                                                         |
| `onboarding_step`                                                                                                 | number                               |                                                                                         |
| **`tier`**                                                                                                        | select `free` \| `basic` \| `pro`    | Plan tier. Read by `@/lib/plans` (`normalizeTier`); drives every limit including seats. |
| **`billing_period_start`**                                                                                        | date                                 | Start of the current monthly counting window.                                           |
| **`executions_used_this_month`**                                                                                  | number                               | Incremented by `startExecution()` only.                                                 |
| **`ai_ops_used_this_month`**                                                                                      | number                               | AI operation counter.                                                                   |
| **`emails_used_this_month`**                                                                                      | number                               | Email send counter.                                                                     |
| **`storage_used_mb`**                                                                                             | number                               | Storage counter.                                                                        |

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

## `execution_pack_purchases` (base, server-only)

Purpose: one row per purchased execution top-up pack. Separate from
`addon_purchases` — the add-on system (`ai_ops`, `sms`, `whatsapp`,
`voice_minutes`, `storage_gb`) is untouched by this kind.

| Field                     | Type                                                                                | Notes                                              |
| ------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `user_id`                 | text, required                                                                      | `users.id`.                                        |
| `kind`                    | select `executions`, required                                                       | The new purchasable kind.                          |
| `pack_id`                 | select `exec_250` \| `exec_1000` \| `exec_5000` \| `exec_10000` \| `exec_25000`     | Published pack. Prices live in `execution-packs.ts`.|
| `units`                   | number                                                                              | Executions granted by the pack.                    |
| `amount_cents`            | number                                                                              | Recomputed server-side, never sent by the browser. |
| `currency`, `provider`    | text                                                                                | `ZAR`, `paystack`.                                 |
| `reference`               | text, required                                                                      | `SYN-EXECPACK-<units>-<uuid>`.                     |
| `authorization_url`, `access_code` | text                                                                       | Paystack checkout handles.                         |
| `status`                  | select `pending` \| `paid` \| `failed`, required                                    |                                                    |
| `provider_transaction_id` | text                                                                                |                                                    |
| `paid_at`                 | date                                                                                |                                                    |
| `error_message`           | text                                                                                |                                                    |

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
