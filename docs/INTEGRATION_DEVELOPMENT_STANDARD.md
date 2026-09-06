Synkra Integration Development Standard

Document type: Engineering / Architecture Standard
Applies to: "synkra-core" and "synkra-client-hub"
Status: Mandatory
Audience: Developers, AI coding agents, integration engineers, reviewers
Purpose: Prevent integration drift, duplicate architectures, runtime mismatches, and incomplete provider implementations.

---

1. Purpose

Every new Synkra integration MUST follow the existing integration architecture already established in the repositories.

The developer must not design a new integration architecture simply because a provider's API works differently.

Provider-specific differences belong inside the provider integration layer. They must not cause the overall Synkra workflow architecture to fragment.

This requirement exists because previous integrations were implemented using patterns that did not match the existing codebase. The result was several days of debugging caused by:

- duplicate dispatch mechanisms
- mismatched field names
- frontend/backend configuration differences
- unsupported action types
- missing configuration UI
- incorrect trigger payload assumptions
- duplicated workflow execution logic
- inconsistent provider fetch mechanisms
- code existing in one repository but not being wired into the runtime path
- static code appearing correct while the actual deployed code used a different implementation

The existing Synkra implementation is the source of truth.

Before writing integration code, the developer must understand and reuse that architecture.

---

2. Core Principle

Do not build an integration from scratch.

Build it by answering:

«“Which existing Synkra integration is structurally closest to this provider, and how do I implement the new provider using the same architecture?”»

The implementation should look like a natural extension of the existing codebase.

A new integration should normally consist of:

Provider
   │
   ├── OAuth / authentication
   │
   ├── Provider service
   │
   ├── Webhook/event route (if applicable)
   │
   ├── Workflow trigger definitions
   │
   ├── Workflow action definitions
   │
   ├── Configuration UI
   │
   ├── Variable definitions
   │
   └── Engine dispatch registration

The exact files and mechanisms must be determined by inspecting the current repositories.

Do not assume filenames or architecture. Inspect first.

---

3. Mandatory Pre-Implementation Audit

Before writing a single line of integration code, inspect both repositories.

At minimum inspect:

synkra-core
synkra-client-hub

The developer must identify:

Backend

- integration routers
- provider services
- authentication/OAuth implementation
- workflow engine
- supported action registry
- provider fetch registry
- webhook routes
- scheduled jobs
- execution creation/completion
- user/workspace resolution
- provider credential storage
- environment variables
- error handling
- logging patterns

Frontend

- "blocks.ts"
- "config-panel.tsx"
- workflow types
- block creation
- "blockSubtype()"
- "knownTriggerVariables()"
- validation
- publishing logic
- integration connection UI
- webhook configuration UI
- existing provider-specific components

Deployment/runtime

Inspect:

- Docker configuration
- application entrypoint
- router registration
- environment configuration
- deployment configuration
- scheduled worker configuration
- database/PocketBase dependencies

---

4. Choose a Reference Integration

Every new integration must have a reference implementation.

Examples:

New webhook integration
→ inspect an existing webhook integration.

New OAuth integration
→ inspect an existing OAuth integration.

New provider fetch/list integration
→ inspect the existing provider-fetch architecture.

New event trigger
→ inspect an existing event-trigger integration.

New CRUD actions
→ inspect an existing provider with equivalent CRUD operations.

The developer must document:

Reference integration:
Reference files:
Why it is structurally similar:
Patterns being reused:
Provider-specific differences:

Example:

Reference integration:
HubSpot

Why:
Both integrations receive provider events and execute published workflows.

Patterns reused:
- webhook routing
- user resolution
- published workflow lookup
- trigger matching
- trigger context construction
- run_blocks()
- execution lifecycle

Provider-specific:
- Zoho payload format
- Zoho authentication
- Zoho event naming

---

5. Never Create a Second Architecture

This is one of the most important rules.

If Synkra already has a central mechanism for something, use it.

Do not create a parallel mechanism.

Examples:

Provider fetches

If the repository has:

PROVIDER_FETCH_HANDLERS

do not create:

_ZOHO_FETCHERS
_SLACK_FETCHERS
_PROVIDER_LIST_FETCHERS
_MY_PROVIDER_DISPATCH

unless the architecture explicitly requires it.

The existing registry must remain the canonical dispatch mechanism.

Workflow execution

If workflows execute through:

run_blocks()

do not create:

run_provider_workflow()
execute_my_provider_workflow()
run_special_provider_blocks()

The provider must integrate with the existing execution engine.

Webhooks

If webhook handlers already resolve workflows and execute them through the established workflow lifecycle, do not create a separate execution pipeline.

Configuration

If existing blocks use the central configuration panel, the new integration must use the same system.

---

6. Backend Integration Structure

The backend should follow the existing provider architecture.

A typical integration consists of:

routers/
    provider.py
    provider_webhook.py

services/
    provider_service.py

integrations/
    provider-specific integration/authentication code

The exact structure must match the current repository.

Do not create new directories merely for organizational preference.

---

7. Provider Service

Provider API calls belong in the provider service layer.

The workflow engine should not contain raw provider API logic.

Bad:

workflow_engine.py
    → requests.get(provider API)

Correct architecture:

workflow_engine.py
    → provider service
        → provider API

The provider service should own:

- API requests
- authentication
- token usage
- provider-specific headers
- pagination
- provider response normalization where appropriate
- provider errors
- resource retrieval
- resource creation
- resource updates
- provider-specific transformations

---

8. Authentication

Before implementing OAuth, inspect the existing OAuth integrations.

Determine:

- OAuth authorization URL
- token endpoint
- scopes
- redirect handling
- token storage
- refresh-token handling
- connection records
- credential lookup
- disconnect behaviour
- frontend connection state

Do not introduce a new credential-storage architecture.

Use the existing Synkra mechanism.

Document provider-specific environment variables:

PROVIDER_CLIENT_ID
PROVIDER_CLIENT_SECRET
PROVIDER_REDIRECT_URI

Only add variables actually required by the provider.

---

9. Webhook Integrations

If the provider supports webhooks, determine whether Synkra should use webhooks rather than polling.

Do not implement polling simply because it is easier.

Inspect the provider's official webhook behaviour:

- event names
- payload structure
- signature mechanism
- timestamp validation
- verification/challenge requests
- subscription creation
- subscription deletion
- retry behaviour
- tenant/account identifiers
- resource IDs
- whether payloads are thin or complete

---

10. Webhook Security

Every webhook implementation must verify the provider's documented security mechanism.

Typical examples include:

HMAC-SHA256
signature headers
timestamp + body signatures
secret tokens
challenge verification

The handler must verify the signature against the raw request body when the provider requires raw-body signing.

Do not parse and reconstruct JSON before signature verification.

The general flow is:

HTTP request
    ↓
read raw body
    ↓
verify signature
    ↓
handle verification/challenge if applicable
    ↓
parse JSON
    ↓
resolve provider account/user
    ↓
find matching workflows
    ↓
construct trigger context
    ↓
execute workflow

Reject invalid signatures.

Reject stale signed requests where the provider requires timestamp validation.

---

11. Thin Webhook Payloads

Some providers send only an event notification.

For example:

{
  "resourceId": "123",
  "eventType": "invoice.updated"
}

Do not assume the webhook body contains the complete resource.

If the provider requires a follow-up API request:

Webhook
   ↓
resource ID
   ↓
provider service
   ↓
GET resource
   ↓
complete trigger context
   ↓
workflow

The implementation must follow the provider's actual API contract.

---

12. Trigger Architecture

Triggers must be represented using the existing Synkra trigger system.

The frontend definition must map to the backend's expected trigger type.

The following values must remain consistent:

blocks.ts
     ↓
createBlock()
     ↓
trigger_type
     ↓
backend workflow record
     ↓
webhook/event handler
     ↓
workflow lookup

Never invent a frontend trigger identifier that the backend does not recognize.

Never create a backend trigger type that the frontend cannot create/configure.

---

13. Trigger Matching

For event-driven integrations, the backend must:

1. receive the provider event
2. identify the Synkra user/account
3. find published workflows
4. identify workflows using the relevant trigger type
5. match the configured event/resource/channel/etc.
6. construct the trigger context
7. execute through the existing workflow engine

Conceptually:

published workflows
        ↓
trigger_type matches
        ↓
provider event matches configuration
        ↓
construct context
        ↓
run_blocks()

Do not execute every workflow belonging to the user.

Only matching published workflows should execute.

---

14. Trigger Context

The trigger context is part of the integration contract.

A typical structure is:

{
    "trigger": {
        # actual provider event fields
    },
    "user": user,
}

The fields inside "trigger" must correspond to the actual payload/context generated by the backend.

Do not advertise variables in the frontend that do not exist at runtime.

Do not rename provider fields arbitrarily unless the normalization is deliberate and documented.

If normalization occurs, document it.

Example:

Provider:
contact_name

Synkra:
trigger.contact_name

The frontend must then expose:

{{trigger.contact_name}}

---

15. Trigger Variables

Every trigger must have corresponding variable definitions where the Synkra UI exposes trigger variables.

Variables must be derived from the actual runtime payload.

For each variable verify:

Provider field
        ↓
Webhook/service extraction
        ↓
context["trigger"]
        ↓
knownTriggerVariables()
        ↓
{{trigger.field}}

A variable is not valid simply because the provider's documentation says the field may exist.

It must actually be available in the Synkra runtime context for that trigger.

---

16. Actions

Every action must have three aligned layers:

Frontend block
       ↓
action_type
       ↓
Backend supported action
       ↓
Provider service method

For example:

blocks.ts
    provider_create_contact

        ↓

action_type:
provider_create_contact

        ↓

workflow_engine.py
    execute_action_block()

        ↓

provider_service.py
    create_contact()

If any layer is missing, the action is incomplete.

---

17. Supported Action Registry

Whenever a new action is introduced, verify that the backend supports it.

Do not assume that adding the frontend block makes an action executable.

Check:

SUPPORTED_ACTION_TYPES

and the actual dispatch mechanism inside the workflow engine.

An action is only complete when:

definition exists
AND
configuration exists
AND
supported action exists
AND
dispatch exists
AND
provider service exists

---

18. Provider Fetches

Provider list/fetch operations must use the existing canonical provider-fetch architecture.

Before adding a fetch operation:

1. Search "PROVIDER_FETCH_HANDLERS".
2. Search existing fetch specifications.
3. Determine whether the requested provider/resource already has an equivalent action.
4. Reuse an existing provider-fetch pattern where possible.
5. Add the new provider fetch to the canonical registry.

Do not introduce a second fetch dispatch table.

For example, avoid creating:

_PROVIDER_FETCHERS = {}
_LIST_FETCHERS = {}
_MY_PROVIDER_FETCHERS = {}

when a canonical registry already exists.

---

19. List Operations

For list-oriented actions such as:

list contacts
list invoices
list records
list messages
list pipelines

determine whether the existing architecture already supports:

provider fetch
→ list_fetch

If so, integrate through that architecture.

Do not implement an independent list execution path unless the architecture explicitly requires one.

---

20. Loops and Logic Blocks

Provider integrations must work with existing workflow primitives.

Do not create provider-specific loop logic.

Existing primitives such as:

list_fetch
filter_list
sort_list
aggregate_list
for_each
if_else

must continue to operate through the standard workflow engine.

A provider's list result should therefore be usable as input to:

list_fetch
    ↓
filter_list
    ↓
sort_list
    ↓
for_each

The integration must not require a special provider-specific loop implementation.

---

21. Frontend Block Definition

Every new block must be added according to the structure used in "blocks.ts".

Verify:

- unique block key
- correct category
- correct type
- correct subtype
- correct provider/integration requirement
- correct label
- description
- icon
- defaults
- configuration fields
- variable requirements
- action/trigger type

Do not create a simplified block definition just to make the UI appear.

---

22. Configuration Panel

Every configurable block must have a corresponding configuration path in "config-panel.tsx".

The developer must verify:

block definition
      ↓
runtime subtype
      ↓
config-panel branch
      ↓
configuration fields
      ↓
saved config
      ↓
backend-required keys

The field names must match exactly.

Example:

If the backend requires:

form_id

the frontend must save:

form_id

not:

formId

unless an explicit transformation exists.

---

23. Required Configuration

For every action determine the backend-required fields.

Then verify that the UI can actually collect them.

A block is broken if:

backend requires:
base_id
table

but:

frontend:
provides no configuration fields

Defaults do not count as configuration if the provider requires a user-specific value.

---

24. Configuration Validation

The frontend's "isConfigured()" behaviour must agree with the backend.

If the backend requires:

to
subject
body

the frontend should not allow publication when those are missing.

Likewise, do not make fields mandatory in the frontend when the backend treats them as optional.

Frontend validation and backend validation must represent the same contract.

---

25. Publishing

If an integration requires setup when publishing a workflow, inspect the existing publishing flow.

Determine whether the workflow needs:

- provider connection
- webhook subscription
- environment variable
- credential
- provider-specific configuration

Reuse the existing publishing mechanism.

Do not create a provider-specific publishing workflow unless absolutely necessary.

If webhook registration is required, verify:

publish
    ↓
ensure webhook/subscription
    ↓
provider
    ↓
Synkra endpoint

and ensure repeated publishing is idempotent.

---

26. Endpoint Registration

Creating a router is not enough.

Every new backend router must be registered in the application's main router/entrypoint.

Verify:

router file exists
        ↓
router imported
        ↓
router included
        ↓
application starts
        ↓
endpoint appears in registered routes

A route that exists in source but isn't registered is considered incomplete.

---

27. Scheduler Integrations

If an integration genuinely requires polling or scheduled processing, inspect the existing scheduler architecture first.

Do not create a new scheduler mechanism.

Determine:

- scheduler registration
- interval
- timezone
- locking
- cursor/state storage
- duplicate prevention
- failure handling
- execution semantics

Scheduled processing must remain compatible with the existing execution model.

---

28. PocketBase

If an integration requires new PocketBase collections, fields, indexes, relations, or records, treat those as part of the integration's deployment contract.

The implementation is not complete merely because the Python/TypeScript code exists.

Document:

Collection:
Field:
Type:
Required:
Relation:
Index:
Rule:
Purpose:

Distinguish clearly between:

code change

and:

live PocketBase change

Do not assume that a collection exists because code references it.

Likewise, do not assume that a collection is missing simply because a local schema file does not contain it.

Verify the live environment separately.

---

29. Environment Variables

Every new environment variable must be documented.

For each variable record:

Name
Purpose
Required/optional
Used by
Where configured
Production requirement
Development requirement

Example:

SLACK_SIGNING_SECRET

Purpose:
Verify Slack Events API signatures.

Required:
Yes for Slack webhook events.

Used by:
Slack webhook router.

Production:
Must be configured in deployment environment.

Do not hardcode secrets.

---

30. Error Handling

Provider errors must not silently disappear.

At minimum distinguish:

authentication failure
authorization failure
invalid configuration
provider API failure
rate limit
not found
invalid webhook
workflow execution failure

Use the existing Synkra error-handling/logging patterns.

Do not introduce provider-specific error semantics into the generic workflow engine unless necessary.

---

31. Idempotency and Duplicate Events

Webhook providers may retry events.

Before implementing a webhook, determine whether the provider guarantees uniqueness.

If not, inspect existing Synkra mechanisms for:

- event IDs
- sequence numbers
- timestamps
- cursors
- execution deduplication

Do not blindly execute duplicate webhook deliveries.

---

32. Provider-Specific Normalization

Provider APIs can be inconsistent.

Provider-specific normalization belongs in the provider integration/service layer.

Do not pollute the generic workflow engine with provider-specific conditions such as:

if platform == "new_provider":
    ...

The generic engine should understand Synkra's workflow model.

The provider service should understand the provider.

---

33. Do Not Modify Unrelated Integrations

When implementing a new provider:

Do not refactor unrelated integrations.

Only touch existing shared infrastructure when there is a demonstrated architectural requirement.

If shared infrastructure must change:

1. explain why
2. identify all affected integrations
3. verify backwards compatibility
4. test the existing integrations
5. document the change

---

34. Static Verification

Before declaring an integration complete, perform repository-wide searches.

Check for:

provider name
action types
trigger types
service methods
router paths
environment variables
supported actions
fetch registrations
frontend block keys
config-panel branches
known trigger variables

Look for references in both directions.

Frontend → backend

Every frontend action/trigger must have backend support.

Backend → frontend

Every newly exposed trigger/action intended for users must have a frontend representation.

---

35. Integration Completeness Matrix

Every integration must satisfy:

Layer| Required
Provider authentication| If required
Provider service| Yes
Router| If required
Webhook handler| If webhook-based
Router registration| If router exists
Trigger definition| If trigger exists
Action definitions| If actions exist
Supported action registration
If actions exist
Engine dispatch
If actions exist
Provider fetch registration
If fetch exists
Configuration UI
If configurable
Validation
If configurable
Trigger variables
If trigger exposes variables
Publishing integration
If provider setup requires it
Environment variables
If required
PocketBase changes
If required
Scheduler
Only if required
An integration is not complete because the provider service works in isolation.

---

36. End-to-End Trace Requirement
Before approval, produce an explicit trace.
For every trigger:
Provider event
→ HTTP endpoint
→ signature verification
→ provider/account resolution
→ user resolution
→ published workflow lookup
→ trigger matching
→ trigger context
→ execution creation
→ run_blocks()
→ action dispatch
→ provider service
→ provider API
→ execution completion
For every action:
Builder block
→ action_type
→ configuration
→ publish validation
→ workflow persistence
→ run_blocks()
→ execute_action_block()
→ supported action
→ provider service
→ provider API
→ result added to context
If the trace breaks at any point, the integration is incomplete.
37. Testing Strategy
Testing should happen in layers.
Layer 1 — Static
Verify:
files
imports
routes
registrations
action types
trigger types
configuration keys
variable names
dispatch mappings
Layer 2 — Application
Run:
typecheck
lint
build
Python syntax/import checks
backend tests
frontend tests
where supported by the repository.
Layer 3 — Workflow simulation
Test:
trigger
→ context
→ workflow engine
→ action
→ result
using controlled/mock provider responses where possible.
Layer 4 — Live provider
Test:
OAuth
webhook verification
real event delivery
workflow matching
provider API request
workflow completion
Layer 5 — Live PocketBase
Verify:
collections
credentials
workflow records
execution records
indexes
scheduler state
permissions
relations
Do not claim Layer 4 or Layer 5 is complete based solely on static code inspection.

38. AI Coding Agent Rules
When an AI agent implements an integration, it MUST follow these rules.
Rule 1
Inspect before editing.
Never begin by generating files from assumptions.
Rule 2
Find the closest existing implementation.
Use it as the architectural template.
Rule 3
Reuse existing infrastructure.
Do not create parallel registries, dispatchers, execution engines, schedulers, or configuration systems.
Rule 4
Follow actual runtime field names.
Do not infer names from provider documentation alone.
Rule 5
Trace both repositories.
Frontend-only implementation is incomplete.
Backend-only implementation is incomplete.
Rule 6
Check the deployed/runtime path.
A duplicate or shadowed file can make a correct-looking implementation irrelevant.
Rule 7
Do not declare completion because files exist.
The entire execution path must be traceable.
Rule 8
Do not hide uncertainty.
If something requires:
PocketBase
credentials
provider configuration
live webhook
production environment
mark it explicitly as blocked rather than pretending it was verified.
Rule 9
Fix only demonstrated defects.
Do not perform unrelated refactors during integration development.
Rule 10
Self-debug before reporting completion.
The agent must search for:
duplicate implementations
stale references
unsupported action types
missing imports
missing route registration
configuration mismatches
field-name mismatches
orphaned frontend blocks
orphaned backend actions
incorrect variable paths
old architecture references

39. Required Implementation Report
Every completed integration must produce this report:
Integration
Provider:
Reference integration:
Implementation date:
Backend
Service:
Router:
Webhook:
Authentication:
Supported actions:
Provider fetches:
Scheduler:
Frontend
Blocks:
Triggers:
Actions:
Configuration UI:
Validation:
Variables:
Publishing:
Runtime
Trigger type:
Action types:
Context shape:
Execution path:
Provider API calls:
Infrastructure
Environment variables:
PocketBase changes:
Deployment changes:
Verification
Typecheck:
Lint:
Build:
Backend tests:
Workflow tests:
Live webhook:
Live provider:
PocketBase:
Known limitations
List only confirmed limitations.
40. Definition of Done
A new Synkra integration is considered DONE only when:
Architecture
Existing integration architecture was inspected.
A reference integration was selected.
Existing infrastructure was reused.
No unnecessary duplicate architecture was introduced.
Backend
Provider service exists.
Authentication follows existing architecture.
Required router exists.
Router is registered.
Webhook is implemented where required.
Webhook security is implemented.
Trigger matching is correct.
Trigger context is correct.
Actions are registered.
Provider fetches use the canonical fetch mechanism.
Workflow execution uses run_blocks().
Frontend
Blocks exist.
Runtime subtype/type is correct.
Configuration UI exists.
Required fields are exposed.
Configuration names match backend names.
Validation matches backend requirements.
Trigger variables match actual runtime context.
Publishing behaviour is correct.
Infrastructure
Required environment variables documented.
Required PocketBase changes identified.
Deployment requirements identified.
Verification
Repository-wide consistency search completed.
No duplicate dispatch mechanism introduced.
No orphaned frontend blocks.
No orphaned backend actions.
No missing route registrations.
No stale references to previous architecture.
Typecheck completed.
Build completed.
Backend verification completed.
Live testing completed where credentials/environment permit.
PocketBase verification completed separately.
41. Final Engineering Principle
The objective is not:
“Make the new integration work.”
The objective is:
“Make the new integration work as a native part of the Synkra architecture.”
A provider should be different because its API is different.
It should not be different because we implemented it using a different Synkra architecture.
If the repository already has a mechanism for:
authentication
webhooks
triggers
actions
provider fetches
workflow execution
configuration
variables
scheduling
persistence
then the new integration must use that mechanism unless there is a documented architectural reason not to.
Inspect → Identify pattern → Implement within pattern → Trace end-to-end → Verify → Only then declare complete.
This standard is mandatory for all future Synkra integrations.
