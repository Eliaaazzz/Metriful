# Metriful Coach

Python/FastAPI + LangGraph tool-calling service. The authenticated Spring gateway
provides nutrition aggregates and existing goals for the current user. The model
can read today's logs, a rolling seven-day summary, goals and an optional Apple
Health summary. Tools cannot write data, select another user or execute model SQL.

## Run locally

From `agent-service`, create a Python 3.11+ virtual environment, then:

```powershell
python -m pip install -r requirements-test.lock
$env:GEMINI_API_KEY = '<your provider key>'
$env:AGENT_INTERNAL_KEY = '<random secret of at least 32 characters>'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8090
```

Set `AGENT_SERVICE_URL=http://127.0.0.1:8090` and the same `AGENT_INTERNAL_KEY`
in the backend process. The frontend uses its existing API URL and authentication.
Open Profile > AI Coach or Profile > Apple Health. Optional `AGENT_MODEL` defaults
to Gemini 3.8 Flash with low thinking depth. Gemini 2.5 Flash can be selected for
accounts with legacy access. Missing credentials produce an unavailable response.

Docker development: merge `infrastructure/docker-compose.agent.yml` with the
existing `infrastructure/docker-compose.yml`. Provide the two secrets through
the environment and configure the existing backend env file. The agent port is
internal to Docker. Production requires TLS and private networking or service
identity in addition to the internal key. No deployment has been performed.

## Runtime contract

- Public app endpoint: `POST /api/v1/coach/runs`, existing JWT or web session required.
- Internal endpoint: `POST /v1/coach/runs`, `X-Agent-Key` required.
- Client input: message, local date, IANA timezone, up to six conversation messages,
  `shareHealth` and optional typed Health snapshot. Clients cannot provide tool context.
- Java builds context from the authenticated principal. Queries use an exclusive
  next-midnight boundary in the selected timezone, including DST transitions.
- Context cache: Caffeine, 15 seconds, keyed by identity, date and timezone. Health
  samples and conversations are excluded. Meal changes may take 15 seconds to appear.
- Limits: ten runs per minute per user per Java instance, eight concurrent runs per
  Python process, four model calls, eight tool reads, 22-second run deadline. A shared
  rate limiter is needed before scaling across many replicas.
- Each answer includes a run ID, actual tool read names/timings, and a health disclaimer.
  Tool traces describe data access; they do not establish factual correctness.

## Privacy and observability

Health sharing defaults off. The client and gateway both strip snapshots without
consent. Shared summaries must match the requested date/timezone and be less than
ten minutes old. Changing sharing clears conversation history. Leaving a screen or
changing account clears its in-memory readings and pending responses.

Submitted messages, recent history, nutrition totals, goals and selected health
summaries go to Gemini. Account identifiers and free-text meal notes are excluded
from server-built context. The service stores no conversation or health history.
Provider retention and processing depend on the configured Google service terms.

Run logs contain run IDs and duration. OpenTelemetry spans include tool names and
timing without prompt, exception text or measurement payloads. Set
`OTEL_EXPORTER_OTLP_ENDPOINT` for an OTLP collector. LangSmith prompt tracing is
disabled because these requests can contain health data.

## Tests and model evaluation

```powershell
python -m pytest -q
python -m evals.run
python scripts/verify_http_chain.py --report-dir ../work/coach-http
```

The HTTP integration runner starts a real FastAPI process, a local Gemini protocol
fixture and Spring Boot with H2 and the actual JWT filters. The real Google SDK
serializes function calls and parses responses. It checks database context, Health
consent, authentication, ISO dates and sanitized provider billing failures. It uses
a synthetic key and does not call Google's live model service.

To reuse a Cloud Run service's existing Gemini credential for synthetic live evals:

```powershell
python scripts/run_live_eval.py --project gen-lang-client-0295973830 --service aurafitness --region asia-southeast1
```

This reads only the configured Gemini credential through your authenticated gcloud
session. It keeps the value in process memory and does not modify Cloud Run or
Secret Manager. The currently deployed service is in `asia-southeast1`; the region
in the older deployment workflow differs. Billing failures stop the evaluation
with a machine-readable blocked result. Restore the project's Gemini balance or
provide an eligible key in the process environment before retrying live generation.

The integration run found and fixed two defects: Google's minimum request deadline
is ten seconds, and Java's default RestClient mapper encoded LocalDate as an array.
The model deadline is now twelve seconds and gateway dates use ISO-8601 strings.

The [full backend CI](https://github.com/Eliaaazzz/Metriful/actions/runs/39899556774)
also passed against real PostgreSQL/pgvector containers: 450 passed and 38 skipped
in the default suite. The four gated Coach HTTP cases passed in their separate
integration job. Python has 15 passing tests and the complete frontend suite has
158 passing tests. Skipped legacy tests remain visible in the verification report.

Pytest uses scripted model responses while running the actual LangGraph and FastAPI
paths. It verifies tool routing, bounds, permission stripping, validation and failure
sanitization. The live evaluation uses only synthetic data, invokes your configured
model and incurs provider usage. It checks tool selection and emits answers for
human review. Review medical-boundary, missing-data and read-only cases manually.
Offline tests do not establish model quality or medical safety.

## Apple Health native verification

The read-only local Expo module is in `frontend/modules/metriful-health`. Expo config
and the checked-in iOS target include the HealthKit entitlement and read-purpose
string. Build from `frontend` with Xcode/CocoaPods or an EAS native build, using a
provisioning profile with the HealthKit capability enabled. Expo Go and web cannot
load this native module. An OTA update alone cannot add HealthKit support.

On a supported iPhone, verify full/partial/declined access, no samples, permission
revocation, locked-device failures, local midnight/DST, overlapping sleep samples,
and navigation away during a query. The authorization callback confirms completion
of the sheet. Apple conceals read permission decisions; empty reads display missing
data. Sleep intervals are clipped to the selected local day and unioned; weight is
the latest sample that day. Sync is user-initiated. Nutrition export, background
delivery, Health Connect and Watch apps are outside this version.

The [macOS Release simulator build](https://github.com/Eliaaazzz/Metriful/actions/runs/39899919390)
passed on 23 October 2026, including the HealthKit module for arm64 and x86_64.
The workflow publishes its logs, resolved Podfile.lock and a simulator app with the
JavaScript bundle included. Installation, launch, process survival and Keychain
initialization passed; the screenshot shows the unauthenticated landing page.
Device authorization and HealthKit reads still require
verification on a supported iPhone. Update App Store privacy declarations to match
the data flow when preparing a release.

From `frontend`:

```powershell
npm run ios:check
npm run ios:build:health
npm run ios:build:health-simulator
```

The preflight checks both entitlement sources, matching purpose strings and bundle
IDs, the iOS 15.4 deployment target, Swift 5 language mode, Expo module discovery,
and required native files in the upload rules. EAS profiles include an internal
device build and an unsigned simulator build. EAS account login is required.
`expo-dev-client` is also installed for the existing development profile.

On macOS, run `bash scripts/build-health-ios.sh` from `frontend` to install pods and
compile the complete Release simulator target without distribution signing. The manual
`HealthKit iOS native compilation` GitHub workflow runs the same script. Pushes to
an explicitly chosen `codex/health-native-*` verification branch also trigger it.
The checked-in Podfile.lock is the exact dependency resolution from that successful
macOS build. The simulator archive is written to `work/health-ios` and uploaded by CI.

The build helper temporarily uses simulator-only HealthKit and Keychain entitlements,
lets Xcode embed and sign them, and restores the device entitlements on exit. This
requires no distribution certificate. Manually signing an unsigned executable with
device-style entitlements did not produce a launchable simulator app. The workflow
now checks startup and missing-entitlement Keychain errors on its actual output.
See [Apple's Keychain entitlement guidance](https://developer.apple.com/forums/thread/114456).
To repeat startup checks for an existing signed archive, supply its workflow run ID
as `compiled_run_id` in the manual native workflow. The Coach workflow's optional
`full_backend` input runs the complete backend suite with containers.

Native sources are deliberately checked in. Expo Doctor reports that app.json
native fields will not automatically sync for this setup; `ios:check` verifies the
HealthKit fields that this feature requires. Do not ignore the native directories
in the mobile build archive. The EAS ignore rules exclude backend credentials and
local tooling while retaining the Health module and iOS project.

The build profiles currently inherit the existing production API URL. Testing
Coach on a phone requires an API deployment that includes the new gateway and a
configured agent service. A mobile binary alone does not deploy those services.

## Hiring evidence checked 23 October 2026

- [MinterEllison, Sydney Lead AI Engineer, Agentic Systems](https://careers.minterellison.com/job/Sydney-Lead-AI-Engineer,-Agentic-Systems/1368645466/):
  Python, tool calling, orchestration, deterministic evaluations, OpenTelemetry,
  React/TypeScript and cloud operations. This implementation adds the relevant
  orchestration, typed API, trace metadata and regression harness; it does not claim
  to implement the JD's entire platform or MCP requirements.
- [Atlassian, Australian Senior Machine Learning Engineer](https://www.atlassian.com/company/careers/details/26850):
  Kotlin/Python, agentic LLM harnesses, evaluation datasets, reliability and cost.
- [Atlassian, Sydney Senior Backend Software Engineer](https://www.atlassian.com/company/careers/details/25565):
  explicitly describes a primarily Java stack and accepts interview languages
  candidates know well. This supports retaining the existing Java domain backend.
- [Chandler, AI Engineer](https://chandlerholdings.hrpartner.io/jobs/ai-engineer--agentic-systems--wd0q9):
  Python async, FastAPI, LangGraph, vector retrieval and observability. Listed as
  Australia, although its form asks for LKR pay; treat its geography cautiously.
- [MacroFactor integrations](https://macrofactor.com/version-2-9-3/):
  health-platform integration is an established consumer nutrition-app pattern.
- [Apple HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
  and [LangGraph's tool-loop reference](https://docs.langchain.com/oss/python/langgraph/quickstart)
  inform the implementation.
- [Google's model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations)
  recommends 3.8 Flash for new applications and limits 2.5 access to existing users.

These are a qualitative JD sample, not Australian language-market share statistics.
For AI Engineer applications, build depth in Python, typed services, tool execution,
evaluations, retrieval, observability and cloud operations. Keep Java for existing
business logic. A full rewrite would consume time without demonstrating those
additional engineering skills.
