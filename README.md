<div align="center">

<img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/brand/icon.png" alt="Metriful" width="120" />

# Metriful

### Track meals. Close rings. Own your day.

**AI-powered nutrition & workout platform** — camera-first meal logging, Apple-Watch-style activity rings, and a three-model AI pipeline that turns a photo of your plate into macro breakdowns, personalized goals, and vector-similar recipe recommendations.

<br />

[![Download on the App Store](https://img.shields.io/badge/Download_on_the-App_Store-000000?style=for-the-badge&logo=apple&logoColor=white)](https://apps.apple.com/app/metriful/id6760930295)
[![Try the Web App](https://img.shields.io/badge/Try_the-Web_App-F97316?style=for-the-badge&logoColor=white)](https://aurafitness.org)

<br />

![Java 21](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=flat-square&logo=redis&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=000)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-Vision_+_LLM-8E75B2?style=flat-square&logo=google&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Embeddings-412991?style=flat-square&logo=openai&logoColor=white)
![Cloud Run](https://img.shields.io/badge/GCP_Cloud_Run-au--southeast2-4285F4?style=flat-square&logo=googlecloud&logoColor=white)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-Object_Storage-F38020?style=flat-square&logo=cloudflare&logoColor=white)

[**Live App**](https://aurafitness.org) · [**App Store**](https://apps.apple.com/app/metriful/id6760930295) · [**Measured Accuracy + LiDAR**](#measured-accuracy-and-the-depth-sensor-behind-it) · [**Architecture**](#architecture) · [**AI Pipeline**](#the-three-model-ai-pipeline) · [**Design Philosophy**](#design-philosophy--every-component-is-intentional) · [**Engineering Highlights**](#engineering-highlights)

</div>

---

> Snap your plate → AI macros + glycemic load + personalized goals + recipe recommendations, in under 5 seconds.

---

## On mobile

<table>
  <tr>
    <td align="center"><b>Landing</b><br/><sub>Camera-first hero, Apple Fitness-style ring metaphor.</sub></td>
    <td align="center"><b>AI meal review</b><br/><sub>Photo → instant macros: 3000 kcal, 205g protein, 164g carbs, 149g fat.</sub></td>
    <td align="center"><b>Item-level breakdown</b><br/><sub>Per-item kcal/macros + estimated blood-sugar impact (GL 79).</sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/mobile/01-landing.png" alt="Metriful mobile landing" width="280" /></td>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/mobile/02-meal-review.png" alt="AI meal analysis with macros" width="280" /></td>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/mobile/03-detected-items.png" alt="Per-item nutrition breakdown" width="280" /></td>
  </tr>
</table>

## On the web

<table>
  <tr>
    <td><b>Dashboard</b> — Bento-grid landing inspired by Apple WWDC '24 + Linear, with a glass-morphism nav and the same daily-plan flow as iOS.</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/web/01-dashboard.png" alt="Metriful web dashboard" /></td>
  </tr>
  <tr>
    <td><b>Workouts</b> — YouTube-API-backed exercise library with intelligent search by focus / duration / equipment.</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/web/02-workouts.png" alt="Metriful workouts library" /></td>
  </tr>
  <tr>
    <td><b>Recipes</b> — Vector-similarity recommendations using OpenAI embeddings stored in pgvector; "what should I cook tonight" answered against your nutrition history.</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Eliaaazzz/Metriful/main/docs/screenshots/web/03-recipes.png" alt="Metriful recipes recommendations" /></td>
  </tr>
</table>

---

## Why it exists

Traditional calorie-tracking apps (MyFitnessPal, Lose It!) are **database-search-first** — every meal is 6+ taps of typing, scrolling, and unit conversion. Adherence collapses inside two weeks. Newer apps (Noom, MacroFactor) replace search with coaching but keep the same friction floor.

Metriful's bet: **the friction floor itself is the bug**. If logging a meal takes longer than eating it, the data never lands. So:

- **Camera-first**: snap → 5 seconds → done. Three taps from launch to logged.
- **Single composite score**: Whoop-style 0–100 daily score replaces six numbers nobody reads.
- **Loss-aversion retention**: Duolingo-style 5-tier streak badges + Apple-Watch ring "closing" cues drive daily return without nag notifications.

Secondary positioning: **T2D / metabolic health** users who need consistent low-friction logging that incumbent apps actively under-serve.

---

## What makes it different

| | Metriful | MyFitnessPal | Noom | MacroFactor | Lose It! | Yazio |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| AI Meal Photo Scan | **Gemini Vision** | manual DB | — | — | basic | basic |
| Personalized AI Goals | **Gemini LLM** | — | coach (human) | algorithmic | — | — |
| Vector Food Recommendations | **pgvector + OpenAI** | — | — | — | — | — |
| Apple-Watch-style Rings | **Reanimated SVG** | — | — | bar charts | — | — |
| Daily Composite Score (0–100) | **Yes** | — | — | — | — | — |
| Exercise Video Library | **YouTube API** | — | — | — | own DB | — |
| Glass-morphism UI System | **Yes (full)** | — | — | — | — | — |
| Apple Sign In | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Pricing** | **Free → $9.99/mo** | $19.99/mo | $70/mo | $11.99/mo | $39.99/yr | $6.99/mo |

**Three unique differentiators no incumbent matches:**

1. **Multi-model AI stack as product narrative.** Gemini Vision *and* Gemini LLM *and* OpenAI embeddings working together — not one vendor, one pipeline.
2. **T2D-aware nutrition signals.** Estimated glycemic load surfaces alongside macros; competitors hide or omit this entirely.
3. **Zero-typing flow.** Logging a meal averages **<5 seconds** end-to-end. The closest competitor (Lose It! Snap It) averages 18+ seconds because it falls back to a database picker.

---

## The three-model AI pipeline

```
                                      ┌──────────────────────────┐
   📷  user snaps a meal photo  ──▶   │  Gemini Vision (1.5)     │  ── identifies foods, portions
                                      └────────────┬─────────────┘
                                                   ▼
                                      ┌──────────────────────────┐
   📊  macro & GL calculation  ◀──    │  Backend nutrition svc   │  ── joins USDA + cached embeddings
                                      └────────────┬─────────────┘
                                                   ▼
                                      ┌──────────────────────────┐
   🎯  daily goal generation    ◀──   │  Gemini LLM (Pro)        │  ── reasons over 7d history + body comp
                                      └────────────┬─────────────┘
                                                   ▼
                                      ┌──────────────────────────┐
   🍽️  recipe recommendations  ◀──    │  pgvector cosine search  │  ── OpenAI text-embedding-3 vectors
                                      └──────────────────────────┘
```

**Why three models, not one?** Each is best-in-class for its job and the cost profile is dramatically different:
- **Gemini Vision** — cheapest top-tier multimodal for food recognition; $0.0001/image.
- **Gemini LLM** — long context (1M tokens) lets us pass the user's full week of history into goal generation in a single call.
- **OpenAI text-embedding-3-small** — the cosine-similarity gold standard for recipe vector search; embeddings cached forever in `pgvector` so cost is one-time per recipe.

---

## Measured accuracy, and the depth sensor behind it

Photo→calorie is the product's core claim, so it is benchmarked rather than asserted.
Full method and results: **[calorie-accuracy-investigation.md](docs/calorie-accuracy-investigation.md)**
(benchmarks, failed levers, latency) and **[calorie-accuracy-roadmap-25-to-15.md](docs/calorie-accuracy-roadmap-25-to-15.md)**
(what a further 25%→15% would take, and why per-meal 15% is not honest to promise).

**The diagnosis came before the fix.** Across three independent Western benchmarks
(Nutrition5k, MetaFood3D, SimpleFood45 — all weighed ground truth) the portion error
*flips sign*: small servings are over-estimated, large ones under-estimated. That structure
held across capture rigs, cuisines and kitchens, which made it worth more than any
parameter fit.

**What ships.** A scene-level geometric-mean blend of the model's own estimate and a
physics estimate — `volume × FNDDS density × energy density` — where volume comes from the
phone's depth sensor. Two global constants, no per-user or per-domain calibration:
[`CaloriePhysicsRefinementService`](backend/src/main/java/com/fitnessapp/backend/nutrition/service/core/CaloriePhysicsRefinementService.java)
· [tests](backend/src/test/java/com/fitnessapp/backend/nutrition/service/core/CaloriePhysicsRefinementServiceTest.java)
(the suite is mostly no-op safety: missing volume, disabled config, noise-level readings
and bad clamp config must all leave the estimate untouched).

| | median calorie APE |
|---|---|
| raw model, hard domain | 30.5 % |
| **+ physics blend, zero-shot** (fit on cafe1 n=100, evaluated on cafe2 n=60, never tuned on it) | **27.7 %** |
| per-day aggregate (what weight management actually acts on) | **< 20 %** |
| oracle floor with perfect mass | 15.9 % |

**Negative results are in here too**, because they constrain the design more than the wins:

- **Per-item beats whole-plate — it doesn't.** Splitting a mixed plate and correcting each
  food separately measured **23.3 % vs 16.2 %** for whole-plate (N5k, n=100): per-food energy
  density amplifies partition noise, where a blended density averages it out. Shipped
  **default off**, with the measurement recorded next to the flag in [`application.yml`](backend/src/main/resources/application.yml).
- **Depth is not decorative.** On 2D benchmarks with no depth, the same correction fails
  outright (31.5 % → 35–38 %). The no-depth datasets are the negative control.

**Boundaries, stated up front:** per-meal cross-domain **< 20 % is not achieved** (17.5 % on
the easy domain, 27.7 % on the hard one); `<5s` is single-request latency, not a load-tested
P99; on-device work is depth→scale only, with volume geometry offline; per-item accuracy on
real mixed plates is **unmeasured** on device. The benchmark harness itself is not in this
repo — it ran against datasets (Nutrition5k, MetaFood3D, SimpleFood45, NutritionVerse) that
carry their own distribution terms.

### Where the LiDAR code lives

> **Looking for a depth package in `frontend/package.json`? There isn't one, and there
> shouldn't be.** Expo *local* native modules are autolinked from `frontend/modules/` via
> `expo-module.config.json` + `use_expo_modules!` — they never appear as npm dependencies.
> The Swift is in the tree:

| | |
|---|---|
| [`modules/metriful-lidar/ios/MetrifulLidarModule.swift`](frontend/modules/metriful-lidar/ios/MetrifulLidarModule.swift) | `builtInLiDARDepthCamera` + `AVCaptureDepthDataOutput`; camera intrinsics (`fx`) turn pixels into cm → `volumeCm3` / `areaCm2` / `meanHCm` |
| [`native-depth-plugin/ios/ARScaleModule.swift`](frontend/native-depth-plugin/ios/ARScaleModule.swift) | ARKit scale fallback for non-LiDAR devices |
| [`src/hooks/useLidarScale.ts`](frontend/src/hooks/useLidarScale.ts) | samples depth once at capture and attaches it to the upload metadata |

Requires an `eas build` on a LiDAR-equipped iPhone; it is not exercised by Expo Go or by CI.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend                                                    │
│  React Native 0.81 · Expo 54 · TypeScript 5.9                │
│  iOS (App Store) + Web (single codebase)                     │
│  Reanimated 4 · react-native-svg · expo-blur · expo-image    │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼─────────────────────────────────┐
│  Backend                                                     │
│  Spring Boot 3.3 · Java 21 · Gradle                          │
│  Spring Security + JWT · OAuth2 (Apple, Google)              │
│  Caffeine (hot cache) + Redis (shared cache)                 │
│  Flyway migrations · OpenAPI 3 spec                          │
└────────┬────────────────────┬───────────────────────┬────────┘
         ▼                    ▼                       ▼
┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ PostgreSQL 16  │  │  Redis (cache)   │  │  Cloudflare R2      │
│ + pgvector     │  │                  │  │  (S3-compatible     │
│ (embeddings)   │  │                  │  │   image storage)    │
└────────────────┘  └──────────────────┘  └─────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  AI Layer                                                    │
│  Gemini Vision (meal photos) · Gemini LLM (goals)            │
│  OpenAI text-embedding-3-small (recipe vectors)              │
│  YouTube Data API (exercise videos)                          │
└──────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Infra                                                       │
│  GCP Cloud Run (au-southeast2) · auto-scale 1 → N            │
│  GitHub Actions → Docker → GCR → Cloud Run                   │
│  Supabase managed Postgres · Cloudflare Pages (web)          │
└──────────────────────────────────────────────────────────────┘
```

**Repo layout (monorepo):**

```
Metriful/
├── backend/        Spring Boot 3.3 · Java 21 · Gradle (REST API + WebSocket)
├── frontend/       React Native 0.81 · Expo 54 (iOS + Web)
├── infrastructure/ docker-compose · supabase stack · cloudbuild.yaml
├── docs/           Architecture, design philosophy, release runbooks
├── scripts/        DB seed, ETL (USDA), deployment, smoke tests
└── .github/        CI workflows (build, test, deploy)
```

---

## Design philosophy — every component is intentional

Every UI component is modeled after a proven pattern from a top-tier consumer app. Not aesthetic copying — each choice solves a specific UX problem.

| Component | Inspired by | Why this pattern |
|---|---|---|
| Nutrition Rings | Apple Watch Activity Rings | Multi-metric progress at a glance without reading numbers — full 360° animated SVG arcs with rounded caps and Apple's signature "ring closed" overlap shadow when you exceed 100%. |
| Daily Score (0–100) | Whoop Recovery / Oura Readiness | Single composite metric reduces cognitive load — users check one number instead of parsing six. Weighted blend of calories + macros + hydration + streak. |
| Daily Tasks | Noom Daily Lessons / Duolingo Daily Quests | Micro-tasks create habit loops; completion dopamine drives retention. |
| Streak Badges | Duolingo Streak / Snapchat Streaks | Loss aversion is the strongest retention lever in consumer apps — five milestone tiers with flame animation. |
| Bento Dashboard | Apple WWDC '24 + Linear App | High information density without visual overwhelm; cards "breathe." Glass morphism via `backdrop-filter: blur(20–40px)`. |
| Liquid-glass Tab Bar | iOS 26 Liquid Glass | Platform-native premium feel; `expo-blur` intensity 56 + specular highlight + floating camera FAB. |
| Quick Log Bar | Spotify Search Bar / Instagram Story Camera | Zero-tap access to the primary action; reduces logging friction to **<3 seconds**. |
| Brand colour `#F97316` | Strava / Nike Training Club | Orange = energy + warmth; differentiates from medical-blue (MyFitnessPal) and clinical-green (Noom). |
| Dark-mode `#A78BFA` | Discord / Figma | Violet feels premium in dark contexts; avoids generic blue-on-dark. |
| Trend Charts | Apple Health weekly view | 7-day rolling window is actionable; longer ranges feel academic. |

---

## Engineering highlights

### AI / ML
- Integrated **three AI providers** (Gemini Vision, Gemini LLM, OpenAI Embeddings) into a single pipeline — photo → recognition → nutrition computation → personalized recommendations — with each provider chosen for its cost / capability fit, not vendor lock-in.
- Implemented **vector similarity search** using `pgvector` + OpenAI `text-embedding-3-small` for food and recipe recommendations; embeddings cached on first generation so recurring queries are sub-millisecond.
- Built an **AI goal generation system** that adapts to the user's nutritional history, body composition, and stated objectives by passing a 7-day window into Gemini's 1M-token context in a single call.

### Backend
- Architected a **Spring Boot 3.3 / Java 21** REST API with Redis (shared) + Caffeine (local hot cache) two-tier caching, OAuth2 (Apple Sign In + Google), Flyway-managed Postgres migrations, and OpenAPI-spec-driven contracts.
- Designed a **PostgreSQL schema with `pgvector`** for embedding storage and cosine-similarity queries, enabling semantic recipe search without a separate vector DB.
- Built a **USDA FoodData Central ETL pipeline** seeding ~400k canonical foods + macro micros, joined to AI recognition output for accuracy verification.

### Frontend
- Built a **cross-platform React Native 0.81 + Expo 54** app with TypeScript strict mode — single codebase ships to **iOS (App Store)** and **Web** with no per-platform forks for the data layer.
- Implemented a **custom glass-morphism tab bar** with `backdrop-filter: blur()`, specular highlights, and Reanimated 4 spring animations (damping 12, stiffness 150).
- Built a **responsive Bento-grid dashboard** with animated SVG charts (custom Apple-Watch-style activity rings using Reanimated `useAnimatedProps` driving `strokeDashoffset` on the UI thread, with `<feDropShadow>` overlap effect for closed rings).

### Infra & DevOps
- Deployed containerized backend to **GCP Cloud Run** (au-southeast2) with **GitHub Actions** CI/CD, multi-stage Docker builds, and 1 → N auto-scaling.
- Configured **Cloudflare R2** (S3-compatible) for image storage with presigned URL uploads, materially reducing egress cost vs S3.
- Set up **Supabase managed Postgres** with connection pooling for production database management; local dev runs the same image via `docker-compose`.

### Product & Design
- Designed and shipped a **consumer health app to the App Store** (Metriful, AU) with AI-powered meal recognition, gamified habit tracking, and a Whoop-inspired daily health score.
- Built a **design system** with glass morphism, animated SVG nutrition rings, and 5-tier streak badges modeled after Duolingo's retention mechanics.
- Conducted **competitive analysis vs 6 incumbent fitness apps** (MyFitnessPal, Noom, MacroFactor, Fitbod, Lose It!, Yazio) to identify and fill feature gaps — the differentiator table at the top of this README is the result.

---

## Run it locally

### Prerequisites
- Java 21+ · Node.js 18+ · PostgreSQL 16 with `pgvector` · Docker · Xcode (iOS) or Android Studio (Android)

### Setup
```bash
git clone https://github.com/Eliaaazzz/Metriful.git
cd Metriful
npm install
cp .env.example .env  # then fill in API keys
npm run docker:up     # spins up Postgres + Redis
```

### Run
```bash
# Backend (Spring Boot, port 8080)
npm run backend:run

# Frontend (Expo, choose target)
npm run frontend:ios     # iOS simulator
npm run frontend:android # Android emulator
npm run frontend:web     # browser at localhost:8081
```

### Test
```bash
npm test                # full suite (backend + frontend)
npm run backend:test    # JUnit + integration
npm run frontend:test   # Jest + RTL
```

### Build & deploy
```bash
npm run backend:build         # Docker image, push to GCR
npm run frontend:build        # web bundle into frontend/dist
npm run deploy:hosting        # Firebase Hosting / Cloudflare Pages
```

See `cloudbuild.yaml` and `firebase.json` for the production deploy contracts.

---

## Roadmap

| | Status |
|---|---|
| iOS App Store launch | ✅ Live ([id6760930295](https://apps.apple.com/app/metriful/id6760930295)) |
| Web app | ✅ Live at [aurafitness.org](https://aurafitness.org) |
| Camera-first AI meal logging | ✅ Shipped |
| Apple-Watch-style activity rings | ✅ Shipped |
| Vector recipe recommendations | ✅ Shipped |
| YouTube workout library | ✅ Shipped |
| Android (Google Play) | 🚧 In review |
| RevenueCat subscription gating | 🚧 In progress |
| HealthKit / Google Fit integration | 📋 Planned |
| Apple Watch companion app | 📋 Planned |

---

## Acknowledgements

Built with [Spring Boot](https://spring.io/projects/spring-boot), [React Native](https://reactnative.dev/), [Expo](https://expo.dev/), [PostgreSQL](https://www.postgresql.org/), [pgvector](https://github.com/pgvector/pgvector), [Reanimated](https://docs.swmansion.com/react-native-reanimated/), [react-native-svg](https://github.com/software-mansion/react-native-svg), [Google Cloud Run](https://cloud.google.com/run), [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/), [Gemini](https://ai.google.dev/), and the [OpenAI API](https://platform.openai.com/).

App Store and Google Play badges are official artwork from Apple and Google, used per their respective branding guidelines.

---

## License

Proprietary · © 2026 Metriful. All rights reserved.
