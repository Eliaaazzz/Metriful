/**
 * prerender-landing.mjs — inject static marketing content + SEO meta into the Expo web export.
 *
 * Why: `expo export --platform web` produces an empty SPA shell (`<div id="root"></div>` +
 * "You need to enable JavaScript"). Search engines, link-preview bots, no-JS/slow-network
 * visitors and some assistive tech therefore saw nothing at aurafitness.org. This script runs
 * after the export and prerenders the landing content directly into the HTML shell. When the
 * React app boots it replaces #root's children, so hydrated users see the full app; everyone
 * else still gets real content.
 *
 * Design language ("instrument-grade warmth" — mirrors src/utils/theme.ts):
 *   paper #F8F7F3 · ink #171511 · copper #C96A34 · sage #2F7A6A  (dark: #12100E / #E2A479)
 *   type: Bricolage Grotesque (display) · Instrument Sans (body) · Space Mono (all data)
 *   signature: the hero "scan receipt" — viewfinder corners, one scanline pass, itemized
 *   foods with grams/kcal/confidence, one line flagged for review.
 *
 * Usage: node scripts/prerender-landing.mjs [path/to/dist/index.html]   (default: dist/index.html)
 * Idempotent: re-running replaces the previously injected blocks (comment markers).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', process.argv[2] ?? 'dist/index.html');

const TITLE = 'Metriful — AI meal scanner with depth-aware portions';
const DESCRIPTION =
  'Snap a meal and get an editable nutrition estimate. Metriful uses iPhone depth (LiDAR) to ' +
  'estimate portions, itemizes every food with a confidence level, and tells you the best next ' +
  'step for today. By Aura Fitness.';
const APP_STORE_URL = 'https://apps.apple.com/app/metriful/id6760930295';
const CANONICAL = 'https://aurafitness.org/';

/* Fonts load from <head>, so they survive hydration — the React landing uses the same
   families on web (see components/landing). */
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800' +
  '&family=Instrument+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap';

const HEAD_START = '<!--METRIFUL-HEAD:START-->';
const HEAD_END = '<!--METRIFUL-HEAD:END-->';

const META = `${HEAD_START}
    <meta name="description" content="${DESCRIPTION}" />
    <link rel="canonical" href="${CANONICAL}" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F8F7F3" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12100E" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Metriful by Aura Fitness" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:url" content="${CANONICAL}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="${FONTS_HREF}" />
    <style>html,body{margin:0;padding:0}</style>
    ${HEAD_END}`;

/* Styles are scoped under #prerender; the wrapper itself scrolls because the Expo reset sets
   body{overflow:hidden}. React removes the whole node on mount, taking the styles' target away. */
const CONTENT = `<div id="prerender" data-prerender="metriful">
<style>
  #prerender{
    --bg:#F8F7F3; --card:#FFFFFF; --panel:#171511;
    --ink:#171511; --body-c:#3E3C38; --muted:#6D6860; --faint:#96907F;
    --line:rgba(23,21,17,.11); --line-soft:rgba(23,21,17,.065); --line-strong:rgba(23,21,17,.17);
    --copper:#C96A34; --copper-deep:#A7552A; --copper-press:#8F4722; --btn-ink:#FFFFFF;
    --sage:#2F7A6A;
    --tint-copper:rgba(201,106,52,.07); --tint-sage:rgba(47,122,106,.07);
    --hl:rgba(201,106,52,.32); --glow:rgba(201,106,52,.07);
    --dot:rgba(23,21,17,.09);
    --scan-soft:rgba(201,106,52,.14); --scan:#C96A34;
    --chip-bg:rgba(47,122,106,.10); --chip-ink:#2F7A6A;
    --shadow:0 24px 64px rgba(23,21,17,.08),0 3px 10px rgba(23,21,17,.04);
    --panel-ink:#F7F2EC; --panel-muted:rgba(247,242,236,.62); --panel-faint:rgba(247,242,236,.42);
    --f-display:'Bricolage Grotesque','Instrument Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
    --f-body:'Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    --f-mono:'Space Mono',ui-monospace,'Cascadia Mono','Segoe UI Mono',Menlo,monospace;
    height:100%;width:100%;overflow-y:auto;overflow-x:clip;-webkit-overflow-scrolling:touch;
    scroll-behavior:smooth;background:var(--bg);color:var(--ink);
    font:16px/1.6 var(--f-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  }
  @media (prefers-color-scheme:dark){
    #prerender{
      --bg:#12100E; --card:#221E1B; --panel:#2B2521;
      --ink:#F7F2EC; --body-c:#D2C8BD; --muted:#A79C8E; --faint:#7E756A;
      --line:rgba(255,248,239,.13); --line-soft:rgba(255,248,239,.08); --line-strong:rgba(255,248,239,.22);
      --copper:#E2A479; --copper-deep:#E2A479; --copper-press:#F3C6A7; --btn-ink:#171310;
      --sage:#78B6A5;
      --tint-copper:rgba(226,164,121,.09); --tint-sage:rgba(120,182,165,.09);
      --hl:rgba(226,164,121,.34); --glow:rgba(226,164,121,.055);
      --dot:rgba(255,248,239,.08);
      --scan-soft:rgba(226,164,121,.16); --scan:#E2A479;
      --chip-bg:rgba(120,182,165,.14); --chip-ink:#78B6A5;
      --shadow:0 24px 64px rgba(0,0,0,.42);
    }
  }
  #prerender,#prerender *,#prerender *::before,#prerender *::after{box-sizing:border-box}
  #prerender ::selection{background:var(--hl)}
  #prerender a:focus-visible{outline:2px solid var(--copper);outline-offset:3px;border-radius:6px}
  #prerender .wrap{max-width:1140px;margin:0 auto;padding-left:24px;padding-right:24px}
  @media (max-width:640px){#prerender .wrap{padding-left:18px;padding-right:18px}}

  /* ── nav ── */
  #prerender .nav{position:sticky;top:0;z-index:20;background:var(--bg);
    background:color-mix(in srgb,var(--bg) 86%,transparent);
    -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
    border-bottom:1px solid var(--line-soft)}
  #prerender .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px}
  #prerender .brand{display:inline-flex;align-items:baseline;gap:10px;text-decoration:none;color:var(--ink);
    font-family:var(--f-display);font-weight:800;font-size:19px;letter-spacing:-.02em}
  #prerender .brand-tick{width:10px;height:10px;flex:none;align-self:center;
    border-left:2px solid var(--copper);border-top:2px solid var(--copper)}
  #prerender .byline{font:400 11px/1 var(--f-mono);color:var(--muted);letter-spacing:.06em}
  #prerender .nav-links{display:flex;align-items:center;gap:22px}
  #prerender .mono-link{font:400 12.5px/1 var(--f-mono);color:var(--muted);text-decoration:none;letter-spacing:.03em}
  #prerender .mono-link:hover{color:var(--ink);text-decoration:underline}
  #prerender .navcta{font:600 13.5px/1 var(--f-body);color:var(--ink);text-decoration:none;
    border:1px solid var(--line-strong);border-radius:999px;padding:10px 16px;transition:border-color .15s}
  #prerender .navcta:hover{border-color:var(--ink)}
  @media (max-width:600px){#prerender .mono-link,#prerender .byline{display:none}}

  /* ── hero ── */
  #prerender .hero{display:grid;grid-template-columns:1.02fr .98fr;gap:56px;align-items:center;
    padding-top:76px;padding-bottom:92px;
    background:radial-gradient(880px 460px at 86% -10%,var(--glow),transparent 64%)}
  @media (max-width:980px){#prerender .hero{grid-template-columns:1fr;gap:44px;padding-top:52px;padding-bottom:64px}}
  #prerender .hero > *{min-width:0}
  #prerender .eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 18px;
    font:700 11px/1 var(--f-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--copper)}
  #prerender .eyebrow::before{content:"";width:22px;height:2px;background:var(--copper);flex:none}
  #prerender h1{margin:0 0 20px;font-family:var(--f-display);font-weight:800;
    font-size:clamp(34px,5.4vw,61px);line-height:1.04;letter-spacing:-.035em;text-wrap:balance}
  #prerender .hl{background:linear-gradient(var(--hl),var(--hl)) 0 87%/100% .13em no-repeat}
  #prerender .lede{margin:0 0 30px;font-size:17.5px;line-height:1.65;color:var(--muted);max-width:33em}
  #prerender .cta-row{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 20px}
  #prerender .btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;
    font:600 15.5px/1 var(--f-body);color:var(--btn-ink);background:var(--copper-deep);
    padding:16px 24px;border-radius:12px;transition:background .15s,transform .12s}
  #prerender .btn:hover{background:var(--copper-press)}
  #prerender .btn:active{transform:translateY(1px)}
  #prerender .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line-strong);padding:15px 23px}
  #prerender .btn.ghost:hover{background:transparent;border-color:var(--ink)}
  #prerender .micro{margin:0;font:400 11.5px/1.9 var(--f-mono);letter-spacing:.02em;color:var(--faint)}
  #prerender .sect-head{display:grid;grid-template-columns:1fr auto;align-items:end;gap:28px}
  #prerender .spot{width:212px;height:auto;justify-self:end}
  @media (max-width:640px){#prerender .sect-head{grid-template-columns:1fr}
    #prerender .spot{width:158px;justify-self:start;margin-top:4px}}
  /* dark mode: transparent-bg illustrations sit on a paper chip so ink lines stay legible */
  @media (prefers-color-scheme:dark){
    #prerender .spot,#prerender .acc-fig img,#prerender .faq-fig{background:#F4EFE7;border-radius:18px;padding:12px}
  }

  /* ── the scan receipt (signature) ── */
  #prerender .receipt{position:relative;margin:0;background-color:var(--card);
    background-image:radial-gradient(var(--dot) 1px,transparent 1.4px);background-size:20px 20px;
    border:1px solid var(--line-soft);border-radius:20px;box-shadow:var(--shadow);
    padding:26px 26px 20px;overflow:hidden;min-width:0;max-width:min(560px,100%);width:100%;justify-self:end}
  @media (max-width:980px){#prerender .receipt{justify-self:stretch;max-width:560px;margin:0 auto}}
  #prerender .c{position:absolute;width:18px;height:18px;border:0 solid var(--copper);pointer-events:none}
  #prerender .c.tl{top:10px;left:10px;border-top-width:2px;border-left-width:2px}
  #prerender .c.tr{top:10px;right:10px;border-top-width:2px;border-right-width:2px}
  #prerender .c.bl{bottom:10px;left:10px;border-bottom-width:2px;border-left-width:2px}
  #prerender .c.br{bottom:10px;right:10px;border-bottom-width:2px;border-right-width:2px}
  #prerender .scanline{position:absolute;left:14px;right:14px;top:40px;height:54px;opacity:0;pointer-events:none;
    background:linear-gradient(180deg,transparent,var(--scan-soft) 42%,var(--scan) 50%,var(--scan-soft) 58%,transparent);
    animation:scan 2.7s cubic-bezier(.45,.05,.35,1) .35s 1 both}
  @keyframes scan{0%{top:40px;opacity:0}9%{opacity:.9}86%{opacity:.9}100%{top:calc(100% - 88px);opacity:0}}
  #prerender .r-head{display:flex;justify-content:space-between;align-items:center;gap:10px;
    padding-bottom:14px;border-bottom:1px solid var(--line);
    font:700 10.5px/1 var(--f-mono);letter-spacing:.15em;color:var(--muted)}
  #prerender .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;
    background:var(--chip-bg);color:var(--chip-ink);font:700 9.5px/1 var(--f-mono);letter-spacing:.13em}
  #prerender .chip .dot{width:6px;height:6px;border-radius:50%;background:var(--sage)}
  #prerender .r-rows{list-style:none;margin:0;padding:4px 0 0}
  #prerender .r-row{display:grid;grid-template-columns:1fr 50px 66px 54px 38px;gap:10px;align-items:center;
    padding:11.5px 0;border-bottom:1px dashed var(--line-soft);animation:rise .5s ease var(--d) both}
  #prerender .r-row:last-child{border-bottom:0}
  @keyframes rise{from{opacity:0;transform:translateY(7px)}}
  #prerender .r-name{font:500 14.5px/1.3 var(--f-body);color:var(--ink);min-width:0;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #prerender .tag{font:700 9px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--copper);
    background:var(--tint-copper);border-radius:5px;padding:3px 6px;margin-left:7px;vertical-align:2px}
  #prerender .r-g{font:400 12px/1 var(--f-mono);color:var(--muted);text-align:right}
  #prerender .r-kcal{font:400 12px/1 var(--f-mono);color:var(--ink);text-align:right}
  #prerender .r-bar{height:4px;border-radius:99px;background:var(--line-soft);overflow:hidden}
  #prerender .r-bar i{display:block;height:100%;width:var(--w);border-radius:99px;background:var(--sage);
    animation:fill .9s cubic-bezier(.25,.75,.3,1) calc(var(--d) + .4s) both}
  @keyframes fill{from{width:0}}
  #prerender .r-conf{font:700 11px/1 var(--f-mono);color:var(--sage);text-align:right}
  #prerender .flag .r-bar i{background:var(--copper)}
  #prerender .flag .r-conf{color:var(--copper)}
  @media (max-width:440px){
    #prerender .r-row{grid-template-columns:1fr 46px 62px 36px}
    #prerender .r-bar{display:none}
    #prerender .receipt{padding:20px 18px 16px}
    #prerender .r-total{flex-wrap:wrap}
    #prerender .r-total .r-tlabel{font-size:9.5px;letter-spacing:.08em}
    #prerender .r-total strong{font-size:19px}
    #prerender .r-macros{flex-wrap:wrap}
  }
  #prerender .r-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
    margin-top:2px;padding-top:15px;border-top:1px solid var(--line);
    font:400 10.5px/1 var(--f-mono);color:var(--muted)}
  #prerender .r-total .r-tlabel{letter-spacing:.14em;text-transform:uppercase}
  #prerender .r-total strong{font:700 22px/1 var(--f-mono);letter-spacing:-.02em;color:var(--ink)}
  #prerender .r-macros{display:flex;justify-content:space-between;gap:12px;margin-top:8px;
    font:400 11.5px/1.5 var(--f-mono);color:var(--muted)}
  #prerender .r-note{margin:14px 0 0;padding-top:12px;border-top:1px dashed var(--line);
    font:400 11.5px/1.6 var(--f-mono);color:var(--faint)}

  /* ── sections ── */
  #prerender .sect{padding-top:78px;padding-bottom:78px}
  @media (max-width:640px){#prerender .sect{padding-top:56px;padding-bottom:56px}}
  #prerender h2{margin:0 0 14px;font-family:var(--f-display);font-weight:800;
    font-size:clamp(27px,3.5vw,40px);line-height:1.08;letter-spacing:-.03em}
  #prerender .sub{margin:0;font-size:16.5px;line-height:1.65;color:var(--muted);max-width:38em}

  /* process rail */
  #prerender .steps{list-style:none;margin:36px 0 0;padding:0;display:grid;
    grid-template-columns:repeat(4,1fr);gap:30px;border-top:1px solid var(--line)}
  @media (max-width:960px){#prerender .steps{grid-template-columns:1fr 1fr}}
  @media (max-width:600px){#prerender .steps{grid-template-columns:1fr;gap:24px}}
  #prerender .step{position:relative;padding-top:24px}
  #prerender .step::before{content:"";position:absolute;top:-2px;left:0;width:30px;height:3px;background:var(--copper)}
  #prerender .step .n{display:block;margin-bottom:10px;font:700 12px/1 var(--f-mono);letter-spacing:.12em;color:var(--copper)}
  #prerender .step h3{margin:0 0 8px;font:600 17px/1.3 var(--f-body);color:var(--ink)}
  #prerender .step p{margin:0;font-size:14.5px;line-height:1.62;color:var(--muted)}

  /* accuracy spec sheet */
  #prerender .acc-grid{display:grid;grid-template-columns:1fr 296px;gap:48px;align-items:center}
  @media (max-width:920px){#prerender .acc-grid{grid-template-columns:1fr}
    #prerender .acc-fig{display:none}}
  #prerender .acc-fig{margin:36px 0 0}
  #prerender .acc-fig img{width:100%;height:auto}
  #prerender .spec{margin:36px 0 0;border-top:1px solid var(--line)}
  #prerender .spec-row{display:grid;grid-template-columns:172px 1fr;gap:26px;padding:21px 0;
    border-bottom:1px solid var(--line-soft)}
  @media (max-width:700px){#prerender .spec-row{grid-template-columns:1fr;gap:8px;padding:18px 0}}
  #prerender .spec-row dt{font:700 11.5px/1.5 var(--f-mono);letter-spacing:.17em;text-transform:uppercase;
    color:var(--copper);padding-top:4px}
  #prerender .spec-row dd{margin:0;display:flex;justify-content:space-between;align-items:baseline;gap:24px;flex-wrap:wrap}
  #prerender .spec-row dd .txt{font-size:15.5px;line-height:1.6;color:var(--body-c);max-width:56ch}
  #prerender .spec-tag{flex:none;margin-left:auto;font:400 11px/1 var(--f-mono);color:var(--faint);
    white-space:nowrap;border:1px solid var(--line-soft);border-radius:999px;padding:5px 10px}

  /* honesty lab-notes */
  #prerender .notes{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px}
  @media (max-width:860px){#prerender .notes{grid-template-columns:1fr}}
  #prerender .note{border-left:3px solid var(--copper);background:var(--tint-copper);
    border-radius:6px 14px 14px 6px;padding:22px 24px}
  #prerender .note.sage{border-left-color:var(--sage);background:var(--tint-sage)}
  #prerender .note h3{margin:0 0 12px;font:600 16px/1.35 var(--f-body)}
  #prerender .note p{margin:0 0 10px;font-size:14.5px;line-height:1.68;color:var(--body-c)}
  #prerender .note p:last-child{margin-bottom:0}
  #prerender .fine{margin:14px 0 0;font:400 11.5px/1.7 var(--f-mono);color:var(--faint)}
  #prerender .fine a{color:var(--muted)}

  /* faq */
  #prerender .faq-grid{display:grid;grid-template-columns:minmax(0,760px) 1fr;gap:56px;align-items:start}
  @media (max-width:920px){#prerender .faq-grid{grid-template-columns:1fr}
    #prerender .faq-fig{display:none}}
  #prerender .faq-fig{width:100%;max-width:320px;height:auto;justify-self:center;margin-top:56px}
  #prerender .faq{margin:32px 0 0;max-width:820px}
  #prerender .qa{padding:21px 0;border-bottom:1px solid var(--line-soft)}
  #prerender .qa dt{margin:0 0 8px;font:600 16.5px/1.4 var(--f-body);color:var(--ink)}
  #prerender .qa dd{margin:0;font-size:15px;line-height:1.65;color:var(--muted);max-width:65ch}

  /* cta panel */
  #prerender .ctapanel{position:relative;overflow:hidden;background:var(--panel);color:var(--panel-ink);
    border-radius:24px;padding:52px 54px;display:grid;grid-template-columns:1.5fr auto;gap:44px;align-items:center}
  @media (max-width:860px){#prerender .ctapanel{grid-template-columns:1fr;padding:38px 28px;gap:32px}}
  #prerender .ctapanel h2{color:var(--panel-ink);margin:0 0 10px}
  #prerender .ctapanel p{margin:0 0 22px;font-size:15.5px;line-height:1.6;color:var(--panel-muted);max-width:34em}
  #prerender .ctapanel .c{border-color:var(--copper)}
  @media (prefers-color-scheme:dark){#prerender .ctapanel .c{border-color:var(--scan)}}
  #prerender .cta-copy{display:flex;flex-direction:column;align-items:flex-start}
  #prerender .cta-copy .panel-note{margin-top:14px}
  #prerender .cta-copy .panel-mail{margin-top:8px}
  #prerender .polaroid{margin:0;background:var(--bg);border-radius:14px;padding:13px 13px 10px;
    width:min(288px,100%);justify-self:end;transform:rotate(-2.2deg);
    box-shadow:0 20px 48px rgba(0,0,0,.3)}
  @media (max-width:860px){#prerender .polaroid{justify-self:center}}
  #prerender .polaroid img{display:block;width:100%;height:auto;border-radius:7px}
  #prerender .polaroid figcaption{padding-top:9px;text-align:center;font:400 11.5px/1.5 var(--f-mono);color:var(--muted)}
  #prerender .btn.onpanel{background:#E2A479;color:#171310}
  #prerender .btn.onpanel:hover{background:#F3C6A7}
  #prerender .panel-note{font:400 11.5px/1.6 var(--f-mono);letter-spacing:.03em;color:var(--panel-faint)}
  #prerender .panel-mail{font:400 12.5px/1 var(--f-mono);color:var(--panel-muted);text-decoration:underline;text-underline-offset:3px}
  #prerender .panel-mail:hover{color:var(--panel-ink)}

  /* footer */
  #prerender .foot{margin-top:44px;border-top:1px solid var(--line)}
  #prerender .foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;gap:32px;padding:52px 24px 36px}
  @media (max-width:860px){#prerender .foot-grid{grid-template-columns:1fr 1fr}}
  @media (max-width:520px){#prerender .foot-grid{grid-template-columns:1fr}}
  #prerender .f-brand p{margin:12px 0 0;font-size:13.5px;line-height:1.6;color:var(--muted);max-width:26ch}
  #prerender .f-col h4{margin:0 0 14px;font:700 10.5px/1 var(--f-mono);letter-spacing:.17em;
    text-transform:uppercase;color:var(--faint)}
  #prerender .f-col a{display:block;margin:9px 0;font-size:14px;line-height:1.5;color:var(--body-c);text-decoration:none}
  #prerender .f-col a:hover{color:var(--ink);text-decoration:underline}
  #prerender .legal{border-top:1px solid var(--line-soft);padding:20px 24px 30px;
    font:400 11.5px/1.8 var(--f-mono);color:var(--faint)}
  #prerender .legal a{color:var(--muted)}

  @media (prefers-reduced-motion:reduce){
    #prerender{scroll-behavior:auto}
    #prerender *{animation:none !important;transition:none !important}
  }
</style>

<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="/"><span class="brand-tick"></span>Metriful <span class="byline">by Aura Fitness</span></a>
    <nav class="nav-links" aria-label="Site">
      <a class="mono-link" href="#accuracy">Accuracy</a>
      <a class="mono-link" href="/about.html">About</a>
      <a class="mono-link" href="/support.html">Support</a>
      <a class="navcta" href="${APP_STORE_URL}">App Store ↗</a>
    </nav>
  </div>
</header>

<main>
  <!-- CTA panel is the very first section on purpose: the App Store download
       entry must be the first thing visitors see (mirrors the React landing). -->
  <section class="wrap sect">
    <div class="ctapanel">
      <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
      <div class="cta-copy">
        <h2>Scan your first meal today.</h2>
        <p>See an itemized, editable estimate in seconds — and one concrete next step for the rest of the day.</p>
        <a class="btn onpanel" href="${APP_STORE_URL}">Download on the App Store</a>
        <span class="panel-note">Free to start, no card needed.</span>
        <a class="panel-mail" href="mailto:support@aurafitness.org">Questions? support@aurafitness.org</a>
      </div>
      <figure class="polaroid">
        <img src="/illustrations/hero-healthy-eating.svg" alt="" width="500" height="500" loading="lazy" />
        <figcaption>lunch, logged — back to eating</figcaption>
      </figure>
    </div>
  </section>

  <section class="wrap hero">
    <div>
      <p class="eyebrow">Photo → editable estimate</p>
      <h1>Snap a meal.<br/>Get an <span class="hl">editable</span> nutrition estimate.</h1>
      <p class="lede">Depth-aware portions, itemized macros, and a clear next step. Metriful shows every
      food it found — grams, calories, confidence — so you can fix anything in one tap.</p>
      <div class="cta-row">
        <a class="btn" href="${APP_STORE_URL}">Download on the App Store</a>
        <a class="btn ghost" href="/">Open the web app</a>
      </div>
      <p class="micro">Works on any iPhone — LiDAR just makes the portions sharper.</p>
    </div>

    <figure class="receipt" aria-label="Example meal scan: five foods itemized with grams, calories and confidence">
      <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
      <div class="scanline" aria-hidden="true"></div>
      <div class="r-head"><span>MEAL SCAN · 12:42</span><span class="chip"><span class="dot"></span>DEPTH OK</span></div>
      <ul class="r-rows">
        <li class="r-row" style="--d:.15s"><span class="r-name">Grilled salmon</span><span class="r-g">142 g</span><span class="r-kcal">289 kcal</span><span class="r-bar"><i style="--w:94%"></i></span><span class="r-conf">94%</span></li>
        <li class="r-row" style="--d:.3s"><span class="r-name">Brown rice</span><span class="r-g">186 g</span><span class="r-kcal">216 kcal</span><span class="r-bar"><i style="--w:91%"></i></span><span class="r-conf">91%</span></li>
        <li class="r-row" style="--d:.45s"><span class="r-name">Roasted broccoli</span><span class="r-g">95 g</span><span class="r-kcal">33 kcal</span><span class="r-bar"><i style="--w:88%"></i></span><span class="r-conf">88%</span></li>
        <li class="r-row" style="--d:.6s"><span class="r-name">Avocado</span><span class="r-g">64 g</span><span class="r-kcal">102 kcal</span><span class="r-bar"><i style="--w:76%"></i></span><span class="r-conf">76%</span></li>
        <li class="r-row flag" style="--d:.75s"><span class="r-name">Olive-oil dressing<span class="tag">review</span></span><span class="r-g">~12 g</span><span class="r-kcal">45 kcal</span><span class="r-bar"><i style="--w:61%"></i></span><span class="r-conf">61%</span></li>
      </ul>
      <div class="r-total"><span class="r-tlabel">Total · all lines editable</span><strong>685 kcal</strong></div>
      <div class="r-macros"><span>P 37 g · C 56 g · F 35 g</span><span>5 items · 1 flagged</span></div>
      <figcaption class="r-note">AI estimate — dressings and hidden oils are easy to miss, so that line asks for your eyes first.</figcaption>
    </figure>
  </section>

  <section class="wrap sect" id="flow">
    <div class="sect-head">
      <div>
        <p class="eyebrow">The flow</p>
        <h2>From photo to logged meal</h2>
      </div>
      <img class="spot" src="/illustrations/snap-camera.svg" alt="" width="500" height="500" loading="lazy" />
    </div>
    <ol class="steps">
      <li class="step"><span class="n">01</span><h3>Snap</h3><p>Point the camera at your plate. On LiDAR iPhones, depth measures the scene while you shoot.</p></li>
      <li class="step"><span class="n">02</span><h3>Review each food</h3><p>Every detected item is listed with grams, calories and a confidence level — no black-box total.</p></li>
      <li class="step"><span class="n">03</span><h3>Confirm in one tap</h3><p>High-confidence items pass by default; only uncertain ones ask you a quick question.</p></li>
      <li class="step"><span class="n">04</span><h3>Know what's next</h3><p>After each log: what's left today and one concrete suggestion — never a lecture.</p></li>
    </ol>
  </section>

  <section class="wrap sect" id="accuracy">
    <p class="eyebrow">Accuracy</p>
    <h2>How accuracy works</h2>
    <p class="sub">Nutrition from a photo is an estimate. We make it a good one — and we show our work.</p>
    <div class="acc-grid">
      <dl class="spec">
        <div class="spec-row"><dt>Identify</dt><dd><span class="txt">A vision model names each food and its likely ingredients.</span><span class="spec-tag">vision model</span></dd></div>
        <div class="spec-row"><dt>Portion</dt><dd><span class="txt">Depth (LiDAR) measures your plate, so portions come from geometry — not a guess from a flat photo.</span><span class="spec-tag">LiDAR geometry</span></dd></div>
        <div class="spec-row"><dt>Nutrition</dt><dd><span class="txt">Per-item calories and macros, cross-referenced against USDA FoodData Central.</span><span class="spec-tag">USDA FDC</span></dd></div>
        <div class="spec-row"><dt>You correct</dt><dd><span class="txt">Everything is editable in one tap. Low-confidence items are flagged, never buried.</span><span class="spec-tag">one tap</span></dd></div>
      </dl>
      <figure class="acc-fig"><img src="/illustrations/data-trends.svg" alt="" width="750" height="500" loading="lazy" /></figure>
    </div>
    <div class="notes">
      <aside class="note">
        <h3>Where we're honest about limits</h3>
        <p>A photo can't see butter melted into rice, oil already in the pan, or dressing tossed
        through a salad — those tend to run low. Stews and curries are harder to split apart than
        foods sitting separately on a plate. And when a dish is shared, only you know how much of
        it was yours.</p>
        <p class="fine">So when we're less sure, the line gets flagged for review — we'd rather ask than pretend.</p>
      </aside>
      <aside class="note sage">
        <h3>Your photos, your data</h3>
        <p>Meal photos upload securely, go into your log, and stay attached to your account —
        that's the whole trip. Delete a meal and its photo goes with it; delete the account and
        everything does. Every AI number is labeled as the estimate it is, with sources you can check.</p>
        <p class="fine">The fine print: <a href="/privacy-policy.html">Privacy Policy</a> · <a href="/data-deletion.html">Data Deletion</a></p>
      </aside>
    </div>
  </section>

  <section class="wrap sect" id="faq">
    <p class="eyebrow">Questions</p>
    <h2>Frequently asked questions</h2>
    <div class="faq-grid">
    <dl class="faq">
      <div class="qa"><dt>How accurate is it?</dt>
        <dd>Portion size is the hardest part of photo nutrition. Metriful measures it with depth where
        available and keeps every number editable. Treat results as good estimates, not lab measurements.</dd></div>
      <div class="qa"><dt>Do I need a LiDAR iPhone?</dt>
        <dd>No. Depth improves portion accuracy on iPhone Pro models; on other devices Metriful still
        itemizes your meal from the photo and you can adjust portions in one tap.</dd></div>
      <div class="qa"><dt>What happens to my meal photos?</dt>
        <dd>They're uploaded securely to create your log and stay attached to your account until you
        delete the meal or the account. See the Data Deletion page for the full process.</dd></div>
      <div class="qa"><dt>Is the glycemic estimate medical advice?</dt>
        <dd>No. It's a general estimate derived from carbohydrate content — not a personal blood-glucose
        prediction. Metriful provides general wellness information, not medical advice.</dd></div>
    </dl>
    <img class="faq-fig" src="/illustrations/fruit-salad.svg" alt="" width="500" height="500" loading="lazy" />
    </div>
  </section>

</main>

<footer class="foot">
  <div class="wrap foot-grid">
    <div class="f-brand">
      <a class="brand" href="/"><span class="brand-tick"></span>Metriful</a>
      <p>The meal scanner that shows its work — by Aura Fitness.</p>
    </div>
    <nav class="f-col" aria-label="Product">
      <h4>Product</h4>
      <a href="#flow">How it works</a>
      <a href="#accuracy">Accuracy</a>
      <a href="/release-notes.html">Release notes</a>
    </nav>
    <nav class="f-col" aria-label="Company">
      <h4>Company</h4>
      <a href="/about.html">About us</a>
      <a href="/about.html#team">The team</a>
      <a href="/about.html#contact">Contact</a>
    </nav>
    <nav class="f-col" aria-label="Support">
      <h4>Support</h4>
      <a href="/support.html">Help centre</a>
      <a href="/accessibility.html">Accessibility</a>
      <a href="mailto:support@aurafitness.org">support@aurafitness.org</a>
    </nav>
    <nav class="f-col" aria-label="Legal">
      <h4>Legal</h4>
      <a href="/privacy-policy.html">Privacy Policy</a>
      <a href="/terms-of-service.html">Terms of Service</a>
      <a href="/data-deletion.html">Data Deletion</a>
    </nav>
  </div>
  <div class="wrap legal">© 2026 Metriful by Aura Fitness · AI numbers are estimates — verify with a healthcare
  professional. · Illustrations by <a href="https://storyset.com" rel="noopener">Storyset</a></div>
</footer>
</div>`;

const NOSCRIPT =
  '<noscript><p style="margin:12px 20px;color:#6b7280;font:14px system-ui">' +
  'The interactive app needs JavaScript — but everything above is real. ' +
  `Get Metriful on the <a href="${APP_STORE_URL}">App Store</a>.</p></noscript>`;

/* ── Google Analytics 4 ─────────────────────────────────────────────────────
 * The measurement ID comes from the same env files the app bundle reads
 * (react-native-dotenv): the FIRST existing of .env.local > .env.production >
 * .env wins outright — files are not merged — mirroring babel.config.js
 * getEnvPath in production mode. A non-empty EXPO_PUBLIC_GA_MEASUREMENT_ID
 * process env var (e.g. set in CI) overrides the files. Empty/missing → no
 * snippet is injected and the runtime service (src/services/analytics.ts)
 * no-ops too, so analytics stays fully off until an ID is configured.
 */
const GA_START = '<!--METRIFUL-GA:START-->';
const GA_END = '<!--METRIFUL-GA:END-->';

function readGaMeasurementId() {
  let raw = (process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();
  if (!raw) {
    for (const file of ['.env.local', '.env.production', '.env']) {
      const envPath = resolve(here, '..', file);
      if (!existsSync(envPath)) continue;
      const match = readFileSync(envPath, 'utf8').match(/^\s*EXPO_PUBLIC_GA_MEASUREMENT_ID\s*=(.*)$/m);
      raw = (match?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
      break; // first existing file decides, exactly like the app build
    }
  }
  // The id lands inside a URL and a JS string literal — only accept the plain
  // "G-XXXXXXXXXX" charset so a bad value can't break (or inject into) the HTML.
  if (raw && !/^[A-Za-z0-9-]+$/.test(raw)) {
    console.warn(`prerender-landing: EXPO_PUBLIC_GA_MEASUREMENT_ID "${raw}" does not look like a G-XXXX id — skipping GA injection.`);
    return '';
  }
  return raw;
}

/* The gtag config auto-sends the initial page_view, so the landing and the
 * static pages are measured even when no JS app ever hydrates. In-app screen
 * changes are tracked by src/services/analytics.ts, which reuses this snippet.
 * The click listener catches App Store taps in the prerendered/static HTML;
 * after hydration those anchors are gone (React renders its own buttons and
 * tracks them itself), so nothing double-fires. */
const gaSnippet = (id) => `${GA_START}
    <script>
      /* Stash + strip an OAuth return fragment (#…id_token=…) synchronously,
         BEFORE gtag.js — or any future tag — can observe location.href: the
         fragment carries a base64-decodable JWT (email/name/sub). Login still
         completes because src/services/webGoogleRedirect.ts consumes the stash
         (key literal must stay in sync with GOOGLE_OAUTH_RETURN_HASH_KEY). */
      (function () {
        var h = location.hash;
        if (h && h.indexOf('id_token=') !== -1) {
          try { sessionStorage.setItem('google_oauth_return_hash', h); } catch (err) {}
          history.replaceState(null, '', location.pathname + location.search);
        }
      })();
    </script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      /* page_location must never include the #fragment: OAuth redirects land
         with #id_token=<JWT> in the hash, and gtag.js (async, small) usually
         executes before the app bundle (defer, large) strips it. */
      gtag('config', '${id}', { page_location: location.origin + location.pathname + location.search });
      document.addEventListener('click', function (e) {
        var t = e.target;
        var a = t && t.closest ? t.closest('a[href*="apps.apple.com"]') : null;
        if (a) gtag('event', 'app_store_click', { placement: 'static_html' });
      }, true);
    </script>
    ${GA_END}`;

/** Strip any previously injected GA block, then add the current one (marker-based, idempotent). */
function withGaSnippet(pageHtml, id) {
  const start = pageHtml.indexOf(GA_START);
  if (start !== -1) {
    const end = pageHtml.indexOf(GA_END, start);
    if (end === -1) {
      console.error('prerender-landing: found GA START marker without END — refusing to edit.');
      process.exit(1);
    }
    pageHtml = pageHtml.slice(0, start) + pageHtml.slice(end + GA_END.length);
  }
  if (!id) return pageHtml;
  return pageHtml.replace('</head>', `${gaSnippet(id)}\n  </head>`);
}

if (!existsSync(target)) {
  console.error(`prerender-landing: ${target} not found — run "expo export --platform web" first.`);
  process.exit(1);
}

let html = readFileSync(target, 'utf8');

// 1. Title
html = html.replace(/<title>.*?<\/title>/s, `<title>${TITLE}</title>`);

// 2. Head block (marker-based; also strip the legacy unmarked injection from older builds)
const headStart = html.indexOf(HEAD_START);
if (headStart !== -1) {
  const headEnd = html.indexOf(HEAD_END, headStart);
  if (headEnd === -1) {
    console.error('prerender-landing: found HEAD START marker without END — refusing to edit.');
    process.exit(1);
  }
  html = html.slice(0, headStart) + html.slice(headEnd + HEAD_END.length);
}
html = html.replace(/\n?\s*<meta name="description"[\s\S]*?<meta name="twitter:description"[^>]*\/>/, '');
html = html.replace('</head>', `${META}\n  </head>`);

// 3. Prerendered content into #root. Idempotent via explicit comment markers — regex over the
//    nested-div content is not reliable, so do plain index surgery instead.
const START = '<!--PRERENDER:START-->';
const END = '<!--PRERENDER:END-->';
const startIdx = html.indexOf(START);
if (startIdx !== -1) {
  const endIdx = html.indexOf(END, startIdx);
  if (endIdx === -1) {
    console.error('prerender-landing: found START marker without END — refusing to edit.');
    process.exit(1);
  }
  html = html.slice(0, startIdx) + html.slice(endIdx + END.length);
}
const rootTag = '<div id="root">';
const rootIdx = html.indexOf(rootTag);
if (rootIdx === -1) {
  console.error('prerender-landing: could not find <div id="root"> in the export.');
  process.exit(1);
}
const insertAt = rootIdx + rootTag.length;
html = html.slice(0, insertAt) + START + CONTENT + END + html.slice(insertAt);

// 4. Friendlier noscript
html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, NOSCRIPT);

// 5. Google Analytics head snippet (no-op until a measurement ID is configured).
const gaId = readGaMeasurementId();
html = withGaSnippet(html, gaId);
if (gaId) console.log(`prerender-landing: injected GA4 snippet (${gaId})`);

writeFileSync(target, html);
console.log(`prerender-landing: injected static landing + SEO meta into ${target}`);

// 6. Patch `import.meta` out of the exported bundles. Expo serves them as CLASSIC
//    <script defer> tags, where `import.meta` is a parse error — the whole app then
//    never boots and visitors only ever see the static prerender above. (Culprit:
//    zustand's devtools middleware checks `import.meta.env.MODE`.) Replacing the
//    token with `({})` keeps the expression valid and takes the production branch.
const bundleDir = join(dirname(target), '_expo', 'static', 'js', 'web');
if (existsSync(bundleDir)) {
  for (const file of readdirSync(bundleDir)) {
    if (!file.endsWith('.js')) continue;
    const bundlePath = join(bundleDir, file);
    const src = readFileSync(bundlePath, 'utf8');
    const patched = src.replaceAll('import.meta', '({})');
    if (patched !== src) {
      writeFileSync(bundlePath, patched);
      const n = (src.length - src.replaceAll('import.meta', '').length) / 'import.meta'.length;
      console.log(`prerender-landing: patched ${n} import.meta usage(s) in ${file} (classic-script compat)`);
    }
  }
}

// 7. GA into the sibling static pages (support/privacy/… — present once the CI
//    "Copy public assets" step has copied frontend/public into dist). Same
//    snippet, same markers, idempotent. No React app runs on these pages, so
//    their page_view + App-Store clicks come entirely from the snippet.
if (gaId) {
  const distDir = dirname(target);
  for (const file of readdirSync(distDir)) {
    if (!file.endsWith('.html') || file === basename(target)) continue;
    const pagePath = join(distDir, file);
    const src = readFileSync(pagePath, 'utf8');
    const out = withGaSnippet(src, gaId);
    if (out !== src) {
      writeFileSync(pagePath, out);
      console.log(`prerender-landing: injected GA4 snippet into ${file}`);
    }
  }
}
