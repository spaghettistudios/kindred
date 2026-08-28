/* ============================================================
   Kindred Companion Sciences — Phase 2 interactions
   Guardrails: animate transform/opacity only; honor reduced motion;
   keyboard + focus friendly; fire-once on scroll.
   ============================================================ */

import SplitType from "https://cdn.jsdelivr.net/npm/split-type@0.3.4/+esm";

// The module is running — cancel the inline <head> script's reveal-failsafe
// timer (see index.html/privacy.html) so it can't force every scroll-reveal
// element visible just because the user hasn't scrolled to them yet. The
// failsafe should only ever fire if this module never loads/runs at all.
if (window.__revealFailsafeTimer) clearTimeout(window.__revealFailsafeTimer);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Shared by every scroll-reveal observer so headings and their body copy
// start observing at the same moment — see initImageFades() for why this
// matters (a body paragraph observing before fonts are ready could reveal
// and finish its fade before the heading above it even starts animating).
const fontsReady = Promise.race([
  document.fonts.ready,
  new Promise((r) => setTimeout(r, 1500)),
]);

/* ---------------------------------------------------------------
   4.4 — Anchor focus management (runs regardless of motion pref)
   Native CSS `scroll-behavior` does the scrolling; we only move
   focus to the landed section so keyboard / SR users continue there.
--------------------------------------------------------------- */
function initAnchorFocus() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.getAttribute("href").slice(1);
      if (!id) return;                       // bare "#" → no target
      const target = document.getElementById(id);
      if (!target) return;
      // targets already carry tabindex="-1"; preventScroll lets the
      // native smooth scroll play out without a competing jump.
      target.focus({ preventScroll: true });
    });
  });
}

/* ---------------------------------------------------------------
   4.3 — Direction-aware navbar
--------------------------------------------------------------- */
function initDirectionalNav() {
  const nav = document.querySelector(".nav-wrap");
  if (!nav) return;

  const THRESHOLD = 80;
  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    if (y <= THRESHOLD) {
      nav.classList.remove("is-hidden");       // always visible at the top
    } else if (y > lastY + 2) {
      nav.classList.add("is-hidden");          // scrolling down → hide
    } else if (y < lastY - 2) {
      nav.classList.remove("is-hidden");       // scrolling up → show
    }
    lastY = y;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}

/* ---------------------------------------------------------------
   4.2 — Fade-in on scroll into view (images, and body copy under a
   [data-split] heading). Waits on the same fontsReady signal as
   initHeadingReveals() so a body paragraph can't start observing (and
   racing its fixed post-heading delay) before the heading above it is
   even ready to animate.
--------------------------------------------------------------- */
function initImageFades() {
  const imgs = document.querySelectorAll("[data-fade]");
  if (!imgs.length) return;

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -20% 0px" }
  );

  fontsReady.then(() => imgs.forEach((img) => io.observe(img)));
}

/* ---------------------------------------------------------------
   4.1 — Section-header line reveal
--------------------------------------------------------------- */
function initHeadingReveals() {
  const headings = Array.from(document.querySelectorAll("[data-split]"));
  if (!headings.length) return;

  const revealed = new WeakSet();
  let splits = [];

  // Must match the CSS .line transition (see the no-preference block below):
  // per-line stagger and each line's own transition duration.
  const LINE_STEP = 0.12;
  const LINE_DURATION = 0.7;
  const BODY_FADE_BEAT = 0.1; // pause after the heading settles before its body copy starts

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealed.add(entry.target);
          io.unobserve(entry.target);          // never replay
        }
      });
    },
    { rootMargin: "0px 0px -20% 0px" }
  );

  const splitAll = () => {
    splits.forEach((s) => s.revert());
    splits = [];

    headings.forEach((h) => {
      const wasRevealed = revealed.has(h);
      const split = new SplitType(h, { types: "lines" });
      splits.push(split);

      const lines = split.lines || [];
      lines.forEach((line, i) => {
        line.style.transitionDelay = `${i * LINE_STEP}s`;   // stagger, top line first
      });

      // A heading's line count (and so its total reveal time) depends on how
      // it wraps at the current viewport width — recomputed on every re-split.
      // The paired body paragraph (its next sibling, if it's a [data-fade])
      // is delayed until the heading's last line has fully settled, so body
      // copy never starts before — or worse, finishes before — its heading.
      const bodyFade = h.nextElementSibling;
      if (bodyFade && bodyFade.hasAttribute("data-fade")) {
        const headingSettleTime = (lines.length - 1) * LINE_STEP + LINE_DURATION;
        bodyFade.style.transitionDelay = `${(headingSettleTime + BODY_FADE_BEAT).toFixed(2)}s`;
      }

      h.classList.add("is-split");                       // lines now control visibility

      if (wasRevealed) {
        // already shown before a resize re-split → snap to final, no replay
        h.classList.add("no-anim");
        h.classList.add("is-in");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => h.classList.remove("no-anim"))
        );
      } else {
        io.observe(h);
      }
    });
  };

  // Split only after fonts load (so lines break correctly), with a failsafe.
  fontsReady
    .then(() => {
      splitAll();
      // Recompute line breaks on resize (debounced).
      let rt;
      window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(splitAll, 200);
      });
    })
    .catch(() => {
      headings.forEach((h) => (h.style.opacity = "1"));  // never leave them hidden
    });
}

/* ---------------------------------------------------------------
   Scroll-triggered reveal groups — add .is-in once when the element
   enters view; CSS owns the per-child stagger.
   Used by the timeline, the science steps, and the stats numbers.
--------------------------------------------------------------- */
function revealOnEnter(selector, rootMargin) {
  const el = document.querySelector(selector);
  if (!el) return;

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin }
  );
  io.observe(el);
}

/* ---------------------------------------------------------------
   Science steps — the 3-step cascade starts at the same moment its body
   paragraph (.science__lead) does, so the two read as one connected
   reveal rather than two independently-timed animations. Watches the
   lead paragraph itself (rather than using its own scroll trigger) and
   reuses whatever delay initHeadingReveals() computed for it as the base,
   stacking each step's existing relative stagger on top of that base.
--------------------------------------------------------------- */
function initScienceStepsSync() {
  const lead = document.querySelector(".science__lead");
  const steps = document.querySelector(".science__steps");
  if (!lead || !steps) return;

  const STEP_OFFSETS = [0, 0.35, 0.7, 1.05, 1.4]; // matches the CSS nth-child stagger

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        // waiting on fontsReady (below) guarantees initHeadingReveals() has
        // already set this by the time it's ever read here
        const baseDelay = parseFloat(lead.style.transitionDelay) || 0;
        Array.from(steps.children).forEach((child, i) => {
          child.style.transitionDelay = `${(baseDelay + (STEP_OFFSETS[i] || 0)).toFixed(2)}s`;
        });
        steps.classList.add("is-in");
      });
    },
    // matches initImageFades()'s threshold exactly — both observers watch
    // .science__lead, so using the same rootMargin guarantees they fire on
    // the same scroll frame, keeping the two reveals truly simultaneous
    { rootMargin: "0px 0px -20% 0px" }
  );
  fontsReady.then(() => io.observe(lead));
}

/* ---------------------------------------------------------------
   Footer monogram easter egg — clicking it floats a handwritten
   "boop" up from the click point. Each click spawns its own, so
   rapid clicks stack. Honors reduced motion (CSS skips the animation;
   we still show + remove the word).
--------------------------------------------------------------- */
function initBoop() {
  const mark = document.querySelector(".footer__mark");
  if (!mark) return;
  const life = prefersReduced ? 600 : 800;   // a touch longer than the 0.75s animation

  // deter casual saving/dragging of the monogram (not a hard lock — devtools,
  // screenshots, and the direct asset URL can always reach it)
  mark.addEventListener("dragstart", (e) => e.preventDefault());
  mark.addEventListener("contextmenu", (e) => e.preventDefault());

  mark.addEventListener("click", (e) => {
    const boop = document.createElement("span");
    boop.className = "boop";
    boop.textContent = "boop";
    boop.setAttribute("aria-hidden", "true");
    boop.style.left = `${e.clientX}px`;
    boop.style.top = `${e.clientY - 12.5}px`;   // float ~3.5px above the cursor so it doesn't cover the word
    document.body.appendChild(boop);
    setTimeout(() => boop.remove(), life);
  });
}

/* ---------------------------------------------------------------
   Hero headline — fade the words in one at a time on load:
   "Everyone" → "deserves" → "a" → (quickly) "dog.". Wait for fonts so the
   script word ("deserves") doesn't swap face mid-fade; failsafe on a timeout.
--------------------------------------------------------------- */
function initHero() {
  const headline = document.querySelector(".hero__headline");
  if (!headline) return;
  Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 1200)),
  ]).then(() => {
    // reveal on the next frame so the transition runs from the hidden state
    requestAnimationFrame(() => headline.classList.add("is-in"));
  });
}

/* ---------------------------------------------------------------
   Stats numbers — fade each character in one at a time, left→right
   across all three columns, with a longer pause between columns.
   Delays are accumulated in JS so the column gap is independent of how
   many characters each number has; each label follows its own number.
--------------------------------------------------------------- */
function initStatNumbers() {
  const blocks = document.querySelector(".stats__blocks");
  if (!blocks) return;
  const stats = Array.from(blocks.querySelectorAll(".stat"));
  if (!stats.length) return;

  const CHAR_STEP = 0.08;   // s between characters
  const COL_GAP = 0.55;     // extra pause between columns
  const LABEL_GAP = 0.15;   // pause before a label after its number

  // split each number into per-character spans
  stats.forEach((stat) => {
    const num = stat.querySelector(".stat__num");
    if (!num) return;
    const text = num.textContent;
    num.textContent = "";
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "stat__char";
      span.textContent = ch;
      if (ch === " ") span.dataset.space = "1";  // spaces don't consume a beat
      num.appendChild(span);
    }
  });
  blocks.classList.add("chars-ready");           // hides chars + labels

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);

        let delay = 0;
        stats.forEach((stat) => {
          stat.querySelectorAll(".stat__char").forEach((sp) => {
            sp.style.transitionDelay = `${delay.toFixed(2)}s`;
            if (sp.dataset.space !== "1") delay += CHAR_STEP;
          });
          const label = stat.querySelector(".stat__label");
          if (label) label.style.transitionDelay = `${(delay + LABEL_GAP).toFixed(2)}s`;
          delay += COL_GAP;                        // pause before the next column
        });

        entry.target.classList.add("is-in");       // triggers the staggered fade
      });
    },
    { rootMargin: "0px 0px -15% 0px" }
  );
  io.observe(blocks);
}

/* ---------------------------------------------------------------
   FAQ — smooth expand/collapse via the grid-rows (0fr↔1fr) technique.
   (Sanctioned exception to the transform/opacity-only rule.)
   Under reduced motion we leave the native <details> snap behavior.
--------------------------------------------------------------- */
function initFaq() {
  document.querySelectorAll(".faq__item").forEach((item) => {
    const ans = item.querySelector(".faq__a");
    if (!ans) return;

    // wrap the answer so we can animate its grid row 0fr → 1fr.
    // inner element (no padding) is the collapsing one, so it reaches a true 0 height.
    const wrap = document.createElement("div");
    wrap.className = "faq__a-wrap";
    const inner = document.createElement("div");
    inner.className = "faq__a-inner";
    ans.parentNode.insertBefore(wrap, ans);
    inner.appendChild(ans);
    wrap.appendChild(inner);

    const summary = item.querySelector("summary");
    summary.addEventListener("click", (e) => {
      if (prefersReduced) return;        // native instant toggle
      e.preventDefault();
      if (item.dataset.busy) return;
      item.dataset.busy = "1";

      const opening = !item.open;
      if (opening) { item.open = true; item.classList.add("is-open"); } // render + rotate icon
      else { item.classList.remove("is-open"); }

      // set start value, force a reflow to commit it, then set end → guarantees the transition runs
      wrap.style.gridTemplateRows = opening ? "0fr" : "1fr";
      void wrap.offsetHeight;
      wrap.style.gridTemplateRows = opening ? "1fr" : "0fr";

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (!opening) item.open = false;   // hide content only after the collapse animates
        wrap.style.gridTemplateRows = "";   // hand back to CSS
        delete item.dataset.busy;
        wrap.removeEventListener("transitionend", onEnd);
      };
      const onEnd = (ev) => { if (ev.propertyName === "grid-template-rows") finish(); };
      wrap.addEventListener("transitionend", onEnd);
      setTimeout(finish, 450);             // fallback if transitionend is missed
    });
  });
}

/* ---------------------------------------------------------------
   Subtle vertical parallax on the full-bleed photo bands and the hero.
   The image is oversized (bands via CSS height:120%; the hero via its
   framing scale) and we nudge it ± a few % of the container height.
   Bands own their whole transform, so we write it directly. The hero
   image already uses transform for its framing crop, so there we write
   the shift to a CSS var (--parallax-y) the framing transform composes
   with, instead of clobbering it.
--------------------------------------------------------------- */
function initParallax() {
  const items = Array.from(document.querySelectorAll(".band img")).map((img) => ({
    img,
    box: img.parentElement, // the .band section
    mode: "transform",
  }));
  const heroImg = document.querySelector(".hero__bg img");
  if (heroImg) items.push({ img: heroImg, box: heroImg.parentElement, mode: "var" });
  if (!items.length) return;

  const FACTOR = 0.07;          // max shift ≈ 7% of container height each way

  const update = () => {
    const vh = window.innerHeight;
    items.forEach(({ img, box, mode }) => {
      const r = box.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;        // offscreen → skip
      // progress: +1 just entering (bottom), 0 centered, -1 leaving (top)
      const progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      const shift = -progress * r.height * FACTOR;   // image lags the scroll slightly
      if (mode === "var") {
        img.style.setProperty("--parallax-y", `${shift.toFixed(1)}px`);
      } else {
        img.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      }
    });
  };

  // transform-only writes don't trigger reflow, so a direct passive handler is fine
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
}

/* ---------------------------------------------------------------
   Signup — two-step form wired to Basin via AJAX.
   Step 1 (name + email) is captured immediately; on success the
   optional follow-up questions replace it in place and post as a
   second, email-linked submission. Degrades to a normal Basin POST
   without JS (the <form action> handles step 1).
--------------------------------------------------------------- */
function initSignup() {
  const section = document.querySelector(".signup");
  if (!section) return;
  const step1 = section.querySelector("#signup-step1");
  const step2 = section.querySelector("#signup-step2");
  if (!step1 || !step2) return;
  const title = section.querySelector(".signup__title");
  const lead = section.querySelector(".signup__lead");
  const fine = section.querySelector(".signup__fine");
  const status = section.querySelector(".signup__status");

  const send = (form) =>
    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    })
      .then((r) => r.ok)
      .catch(() => false);

  const setBusy = (form, busy) => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = busy;
      btn.textContent = busy ? "Submitting…" : "Submit";
    }
  };
  const showStatus = (msg) => {
    if (!status) return;
    status.textContent = msg;
    status.hidden = false;
  };

  // Cloudflare Turnstile. A widget renders inside each form step, injecting a hidden
  // "cf-turnstile-response" input that rides along in the FormData Basin verifies.
  // Step 2 is hidden until step 1 succeeds, so it mounts on reveal (Turnstile can't
  // reliably render into a display:none element). ts*Id gate the per-step token checks.
  const TURNSTILE_SITEKEY = "0x4AAAAAAD4IbMy8xQPzBO6z";
  let ts1Id = null, ts2Id = null;
  const renderTurnstile = (selector) =>
    window.turnstile
      ? window.turnstile.render(selector, { sitekey: TURNSTILE_SITEKEY })
      : null;
  if (window.turnstileReady) window.turnstileReady.then(() => { ts1Id = renderTurnstile("#ts-step1"); });
  // true only when a widget exists but hasn't produced a token yet (challenge still running)
  const awaitingToken = (id) => window.turnstile && id !== null && !window.turnstile.getResponse(id);

  step1.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!step1.reportValidity()) return;
    if (awaitingToken(ts1Id)) { showStatus("Just a moment — finishing the human check."); return; }
    if (status) status.hidden = true;
    setBusy(step1, true);
    const ok = await send(step1);
    if (!ok) {
      setBusy(step1, false);
      showStatus("Something went wrong — please try again.");
      if (window.turnstile && ts1Id !== null) window.turnstile.reset(ts1Id);  // fresh token for retry
      return;
    }
    // Google Ads conversion — fires once step 1 (name + email) succeeds, the actual "join the list" moment
     if (window.gtag) gtag('event', 'conversion', { send_to: 'AW-18371553882/bOGoCKPov94cENrUnrhE' });
    // carry name + email into the follow-up so Basin can link the answers
    step2.querySelector('input[name="name"]').value = step1.querySelector('input[name="name"]').value;
    step2.querySelector('input[name="email"]').value = step1.querySelector('input[name="email"]').value;
    // swap the name/email step for the questions
    if (title) title.textContent = "Thanks for joining us";
    if (lead) lead.hidden = true;
    if (fine) fine.textContent = "Your answers help us understand the people and families following Kindred.";
    step1.hidden = true;
    step2.hidden = false;
    if (ts2Id === null) ts2Id = renderTurnstile("#ts-step2");  // mount now that it's visible
    requestAnimationFrame(() => step2.classList.add("is-in"));
  });

  step2.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (awaitingToken(ts2Id)) { showStatus("Just a moment — finishing the human check."); return; }
    if (status) status.hidden = true;
    setBusy(step2, true);
    const ok = await send(step2);
    if (!ok) {
      setBusy(step2, false);
      showStatus("Something went wrong — please try again.");
      if (window.turnstile && ts2Id !== null) window.turnstile.reset(ts2Id);  // fresh token for retry
      return;
    }
    step2.hidden = true;
    if (fine) fine.hidden = true;
    showStatus("You're all set — thank you.");
  });
}

/* ---------------------------------------------------------------
   CMS-managed content (Pages CMS → content/*.json). Hydrates the two
   client-editable areas on load: the science "Read the paper" link and
   the "In the news" section. Both default to hidden in the markup and
   are revealed here only when the content says so, so a fetch/parse
   failure just leaves them hidden — a safe default.
--------------------------------------------------------------- */
const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

// Build one news card with DOM APIs (never innerHTML) so author-entered
// text can't inject markup and only http(s) links are ever set.
function buildNewsCard(a) {
  const card = document.createElement("article");
  card.className = "news-card";

  const media = document.createElement("div");
  media.className = "news-card__media";
  if (a.image) {
    const img = document.createElement("img");
    img.src = a.image;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);
  }
  card.appendChild(media);

  if (a.headline) {
    const h = document.createElement("h3");
    h.className = "news-card__title";
    h.textContent = a.headline;
    card.appendChild(h);
  }

  if (isHttpUrl(a.url)) {
    const link = document.createElement("a");
    link.className = "btn btn--text news-card__link";
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.append("Read more ");
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    link.appendChild(arrow);
    card.appendChild(link);
  }

  return card;
}

function initContent() {
  // "Read the paper" — reveal + link only when the CMS says show + a valid URL.
  // The footnote marker on "Healthy pups are born¹" is toggled in sync so it never
  // dangles without its link.
  const paperLink = document.querySelector(".science__paper");
  const paperFootnote = document.querySelector(".paper-footnote");
  if (paperLink) {
    fetch("content/paper.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((paper) => {
        if (paper && paper.show && isHttpUrl(paper.url)) {
          paperLink.href = paper.url;
          paperLink.target = "_blank";
          paperLink.rel = "noopener";
          paperLink.hidden = false;
          if (paperFootnote) paperFootnote.hidden = false;
        }
      })
      .catch(() => {});
  }

  // "In the news" — reveal the section and build cards from the article list.
  const section = document.querySelector(".news");
  const grid = section && section.querySelector(".news__grid");
  if (section && grid) {
    fetch("content/news.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((news) => {
        if (!news || !news.visible || !Array.isArray(news.articles)) return;
        const cards = news.articles
          .filter((a) => a && (a.headline || a.image))
          .map(buildNewsCard);
        if (!cards.length) return;
        grid.replaceChildren(...cards);
        section.hidden = false;
      })
      .catch(() => {});
  }
}

/* --------------------------------------------------------------- */
initAnchorFocus(); // a11y scroll-to-section focus works in all motion modes
initFaq();         // handles its own reduced-motion fallback
initBoop();        // footer monogram easter egg (handles its own reduced-motion)
initSignup();      // two-step Basin form (works in all motion modes)
initContent();     // CMS-managed paper link + news section (all motion modes)

if (!prefersReduced) {
  initHero();
  initDirectionalNav();
  // headings must split (and set their paired body copy's delay) before
  // initImageFades starts observing — both wait on the same fontsReady
  // promise, and .then() callbacks run in attachment order, so this call
  // order is what guarantees the delay is set before it's ever needed.
  initHeadingReveals();
  initImageFades();
  revealOnEnter(".timeline__track", "0px 0px -10% 0px");
  initScienceStepsSync(); // starts the step cascade with .science__lead's own fade
  initStatNumbers();
  initParallax();
}
