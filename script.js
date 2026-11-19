(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Ransom-note lettering ----------
     Deterministic per string so the layout doesn't jump between visits. */
  const hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  document.querySelectorAll("[data-ransom]").forEach((el) => {
    const text = el.dataset.ransom;
    const rand = rng(hash(text));
    el.textContent = "";
    let last = -1;
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      if (ch === " ") {
        span.className = "rl space";
      } else {
        let style;
        do { style = Math.floor(rand() * 6); } while (style === last);
        last = style;
        span.className = `rl s${style}`;
        span.textContent = ch;
        span.style.setProperty("--r", `${(rand() * 14 - 7).toFixed(1)}deg`);
        span.style.setProperty("--y", `${(rand() * 0.12 - 0.06).toFixed(2)}em`);
      }
      el.appendChild(span);
    });
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", text);
  });

  /* ---------- Wipe transition + navigation ---------- */
  const wipe = document.querySelector(".wipe");
  let busy = false;

  const goTo = (hash) => {
    const target = document.querySelector(hash);
    if (!target) return;
    if (reduceMotion || busy) {
      target.scrollIntoView();
      history.replaceState(null, "", hash);
      return;
    }
    busy = true;
    wipe.classList.remove("run");
    void wipe.offsetWidth; // restart animation
    wipe.classList.add("run");
    // Jump while the screen is covered
    setTimeout(() => {
      document.documentElement.style.scrollBehavior = "auto";
      target.scrollIntoView();
      document.documentElement.style.scrollBehavior = "";
      history.replaceState(null, "", hash);
    }, 340);
    setTimeout(() => {
      wipe.classList.remove("run");
      busy = false;
    }, 900);
  };

  document.querySelectorAll("a[data-nav]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href.startsWith("#")) return;
      e.preventDefault();
      goTo(href);
    });
  });

  /* ---------- Keyboard-driven main menu ---------- */
  const menuLinks = [...document.querySelectorAll(".menu a")];
  let sel = 0;
  const setActive = (i) => {
    sel = (i + menuLinks.length) % menuLinks.length;
    menuLinks.forEach((l, j) => l.classList.toggle("active", j === sel));
  };
  setActive(0);
  menuLinks.forEach((l, i) => {
    l.addEventListener("mouseenter", () => setActive(i));
    l.addEventListener("focus", () => setActive(i));
  });

  const hero = document.querySelector(".hero");
  const heroVisible = () => {
    const r = hero.getBoundingClientRect();
    return r.bottom > window.innerHeight * 0.5;
  };
  document.addEventListener("keydown", (e) => {
    if (!heroVisible()) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(sel + 1); menuLinks[sel].focus({ preventScroll: true }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(sel - 1); menuLinks[sel].focus({ preventScroll: true }); }
    else if (e.key === "Enter" && !document.activeElement.closest(".menu")) {
      e.preventDefault();
      goTo(menuLinks[sel].getAttribute("href"));
    }
  });

  /* ---------- Mission filters ---------- */
  const filters = document.querySelectorAll(".filter");
  const missions = document.querySelectorAll(".mission");
  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      const f = btn.dataset.filter;
      missions.forEach((m) => {
        const show = f === "all" || m.dataset.type === f;
        m.classList.toggle("hidden", !show);
        m.classList.remove("pop");
        if (show && !reduceMotion) { void m.offsetWidth; m.classList.add("pop"); }
      });
    });
  });

  /* ---------- Reveal on scroll + current section in top nav ---------- */
  const revealEls = document.querySelectorAll(
    ".section-head, .card, .loadout, .mission, .note"
  );
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealEls.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  }

  const navLinks = document.querySelectorAll(".topnav a");
  if ("IntersectionObserver" in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = "#" + en.target.id;
          navLinks.forEach((l) => l.classList.toggle("current", l.getAttribute("href") === id));
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main > section").forEach((s) => so.observe(s));
  }

  /* ---------- Footer year ---------- */
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
