(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const I18N = window.I18N || {};
  const FAVORITES = window.FAVORITES || [];
  const LANGS = ["en", "es", "ca", "ko"];
  let lang = "en";
  const t = (key) => (I18N[lang] && I18N[lang][key]) ?? (I18N.en && I18N.en[key]) ?? key;

  /* ---------- Ransom-note lettering (deterministic per string) ---------- */
  const hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const ransomize = (el, text) => {
    const rand = rng(hash(text));
    el.textContent = "";
    let last = -1;
    // split into words so a word never breaks across lines
    text.split(" ").forEach((word, wi, words) => {
      const w = document.createElement("span");
      w.className = "rw";
      [...word].forEach((ch) => {
        let style;
        do { style = Math.floor(rand() * 6); } while (style === last);
        last = style;
        const s = document.createElement("span");
        s.setAttribute("aria-hidden", "true");
        s.className = `rl s${style}`;
        s.textContent = ch;
        s.style.setProperty("--r", `${(rand() * 14 - 7).toFixed(1)}deg`);
        s.style.setProperty("--y", `${(rand() * 0.12 - 0.06).toFixed(2)}em`);
        w.appendChild(s);
      });
      el.appendChild(w);
      if (wi < words.length - 1) {
        const sp = document.createElement("span");
        sp.className = "rl space";
        sp.setAttribute("aria-hidden", "true");
        el.appendChild(sp);
      }
    });
    el.setAttribute("aria-label", text);
  };
  document.querySelectorAll("[data-ransom]").forEach((el) => ransomize(el, el.dataset.ransom));

  /* ---------- i18n ---------- */
  const applyLang = (next) => {
    lang = LANGS.includes(next) ? next : "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-ransom-key]").forEach((el) => ransomize(el, t(el.dataset.ransomKey)));
    document.querySelectorAll(".lang button").forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderShelves();
    if (dialog && dialog.open) fillDialog();
    try { localStorage.setItem("lang", lang); } catch (_) {}
  };

  const initialLang = () => {
    try {
      const saved = localStorage.getItem("lang");
      if (LANGS.includes(saved)) return saved;
    } catch (_) {}
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.includes(nav) ? nav : "en";
  };

  document.querySelectorAll(".lang button").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.lang === lang) return;
      flash();
      setTimeout(() => applyLang(b.dataset.lang), reduceMotion ? 0 : 300);
    });
  });

  /* ---------- Wipe transition + navigation ---------- */
  const wipe = document.querySelector(".wipe");
  let busy = false;
  const flash = () => {
    if (reduceMotion) return;
    wipe.classList.remove("run");
    void wipe.offsetWidth;
    wipe.classList.add("run");
    setTimeout(() => wipe.classList.remove("run"), 900);
  };
  const goTo = (hashId) => {
    const target = document.querySelector(hashId);
    if (!target) return;
    if (reduceMotion || busy) {
      target.scrollIntoView();
      history.replaceState(null, "", hashId);
      return;
    }
    busy = true;
    flash();
    setTimeout(() => {
      document.documentElement.style.scrollBehavior = "auto";
      target.scrollIntoView();
      document.documentElement.style.scrollBehavior = "";
      history.replaceState(null, "", hashId);
    }, 340);
    setTimeout(() => { busy = false; }, 900);
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
  const heroVisible = () => hero.getBoundingClientRect().bottom > window.innerHeight * 0.5;
  document.addEventListener("keydown", (e) => {
    if (dialog && dialog.open) return;
    if (!heroVisible()) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(sel + 1); menuLinks[sel].focus({ preventScroll: true }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(sel - 1); menuLinks[sel].focus({ preventScroll: true }); }
    else if (e.key === "Enter" && !document.activeElement.closest(".menu, .lang, button, a")) {
      e.preventDefault();
      goTo(menuLinks[sel].getAttribute("href"));
    }
  });

  /* ---------- Filters (missions + favorites) ---------- */
  const filterState = { missions: "all", fav: "all" };
  document.querySelectorAll(".filters").forEach((group) => {
    const name = group.dataset.group;
    const buttons = group.querySelectorAll(".filter");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        filterState[name] = btn.dataset.filter;
        if (name === "missions") filterMissions();
        else renderShelves(true);
      });
    });
  });
  const filterMissions = () => {
    const f = filterState.missions;
    document.querySelectorAll(".mission").forEach((m) => {
      const show = f === "all" || m.dataset.type === f;
      m.classList.toggle("hidden", !show);
      m.classList.remove("pop");
      if (show && !reduceMotion) { void m.offsetWidth; m.classList.add("pop"); }
    });
  };

  /* ---------- Off Duty: shelves of favorites ---------- */
  const shelvesEl = document.getElementById("shelves");
  const CATS = ["music", "games", "reads", "movies", "series"];
  let visible = []; // indexes into FAVORITES currently shown, in order

  function renderShelves(animate = false) {
    if (!shelvesEl) return;
    const f = filterState.fav;
    shelvesEl.textContent = "";
    visible = [];
    CATS.filter((c) => f === "all" || c === f).forEach((cat, ci) => {
      const shelf = document.createElement("div");
      shelf.className = `shelf shelf-${cat}`;
      const label = document.createElement("h3");
      label.className = "shelf-label";
      label.innerHTML = `<span>${String(ci + 1).padStart(2, "0")}</span>${t("cat." + cat)}`;
      shelf.appendChild(label);

      const row = document.createElement("ul");
      row.className = "shelf-row";
      FAVORITES.forEach((item, idx) => {
        if (item.cat !== cat) return;
        const pos = visible.push(idx) - 1;
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cover" + (item.square ? " square" : "");
        btn.style.setProperty("--tilt", `${((hash(item.title) % 9) - 4) * 0.8}deg`);
        btn.setAttribute("aria-label", `${item.title} — ${item.by}`);
        btn.innerHTML = `
          <img src="img/fav/${item.img}" alt="" loading="lazy" />
          <span class="cover-tag"><b>${item.title}</b><i>${item.by}</i></span>`;
        btn.addEventListener("click", () => openDialog(pos));
        if (animate && !reduceMotion) {
          btn.classList.add("pop");
          btn.style.animationDelay = `${pos * 40}ms`;
        }
        li.appendChild(btn);
        row.appendChild(li);
      });
      shelf.appendChild(row);
      shelvesEl.appendChild(shelf);
    });
  }

  /* Detail dialog */
  const dialog = document.getElementById("favDialog");
  let current = 0;
  function fillDialog() {
    const item = FAVORITES[visible[current]];
    if (!item) return;
    document.getElementById("favImg").src = `img/fav/${item.img}`;
    document.getElementById("favImg").alt = item.title;
    document.getElementById("favImg").parentElement.classList.toggle("square", !!item.square);
    document.getElementById("favCat").textContent = t("type." + item.type);
    document.getElementById("favTitle").textContent = item.title;
    document.getElementById("favBy").textContent = item.by;
    document.getElementById("favCount").textContent = `${String(current + 1).padStart(2, "0")} / ${String(visible.length).padStart(2, "0")}`;
  }
  function openDialog(pos) {
    current = pos;
    fillDialog();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  const step = (d) => {
    current = (current + d + visible.length) % visible.length;
    const inner = dialog.querySelector(".fd-inner");
    inner.classList.remove("swap");
    if (!reduceMotion) { void inner.offsetWidth; inner.classList.add("swap"); }
    fillDialog();
  };
  if (dialog) {
    dialog.querySelector(".fd-close").addEventListener("click", () => dialog.close());
    dialog.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => step(+b.dataset.step)));
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // backdrop
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });
  }

  /* ---------- Reveal on scroll + current section ---------- */
  const revealEls = document.querySelectorAll(".section-head, .card, .loadout, .mission, .shelf");
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealEls.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
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

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  applyLang(initialLang());
})();
