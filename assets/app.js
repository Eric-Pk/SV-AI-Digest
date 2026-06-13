// SV AI Digest — client-side search + bookmarks + permalink copy.
// Loaded by both index.html (search + stars panel) and posts/*.html (star toggle + #-anchor copy).

(function () {
  "use strict";

  const STORAGE_KEY = "sv_digest_stars_v1";
  const PAGE = document.body.dataset.page; // "index" | "post"

  // ─── Bookmark store ──────────────────────────────────────────────
  function loadStars() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveStars(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* quota etc — silently ignore */
    }
  }

  const stars = loadStars();

  // ─── Star button wiring (works on both index search results and post pages) ──
  function hydrateStarButtons(root) {
    root.querySelectorAll(".star-btn").forEach((btn) => {
      const eid = btn.dataset.eid;
      if (!eid) return;
      const on = stars.has(eid);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (stars.has(eid)) {
          stars.delete(eid);
        } else {
          stars.add(eid);
        }
        saveStars(stars);
        // Re-hydrate every visible matching button (search list + archive both).
        document.querySelectorAll(`.star-btn[data-eid="${eid}"]`).forEach((b) => {
          const v = stars.has(eid);
          b.classList.toggle("on", v);
          b.setAttribute("aria-pressed", v ? "true" : "false");
        });
        // Update counter on index page.
        const counter = document.getElementById("stars-count");
        if (counter) counter.textContent = String(stars.size);
        // If currently viewing stars tab, refresh it.
        const starsPanel = document.getElementById("stars-panel");
        if (starsPanel && !starsPanel.hidden) renderStarsPanel();
      });
    });
  }

  // ─── Permalink copy on # anchor click ────────────────────────────
  function hydrateAnchors(root) {
    root.querySelectorAll(".entry-anchor").forEach((a) => {
      if (a.dataset.bound === "1") return;
      a.dataset.bound = "1";
      a.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const href = a.getAttribute("href");
        const abs = new URL(href, window.location.href).toString();
        // Update hash so the entry highlights and URL is shareable from address bar too.
        history.replaceState(null, "", href);
        try {
          await navigator.clipboard.writeText(abs);
          flashAnchor(a, "已复制");
        } catch (e) {
          flashAnchor(a, "复制失败");
        }
      });
    });
  }

  function flashAnchor(el, text) {
    const original = el.textContent;
    el.textContent = text;
    el.classList.add("flash");
    setTimeout(() => {
      el.textContent = original;
      el.classList.remove("flash");
    }, 1100);
  }

  // ─── Highlight target entry on first paint when URL has #e-xxx ───
  function highlightHash() {
    if (!window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    el.classList.add("hash-target");
    setTimeout(() => el.classList.remove("hash-target"), 2400);
  }

  // ─── Search (index page only) ────────────────────────────────────

  let INDEX_DATA = null;

  async function loadSearchIndex() {
    if (INDEX_DATA) return INDEX_DATA;
    // Prefer the inlined script (works under file://, no CORS); fall back to fetch
    // for the JSON file when served over http(s).
    if (Array.isArray(window.SV_DIGEST_INDEX)) {
      INDEX_DATA = window.SV_DIGEST_INDEX;
      return INDEX_DATA;
    }
    try {
      const res = await fetch("assets/search_index.json", { cache: "no-cache" });
      INDEX_DATA = await res.json();
      return INDEX_DATA;
    } catch (e) {
      // file:// browsers block fetch — surface a clearer hint to the user.
      if (window.location.protocol === "file:") {
        throw new Error(
          "本地 file:// 打开时浏览器禁止 fetch JSON。请重新跑一次渲染脚本生成 search_index.js,或用 `python3 -m http.server` 起一个本地服务再访问。"
        );
      }
      throw e;
    }
  }

  // Parse a query into {terms, source, minPts}.
  function parseQuery(q) {
    const terms = [];
    let source = null;
    let minPts = null;
    q.trim()
      .split(/\s+/)
      .forEach((tok) => {
        if (!tok) return;
        const m = tok.match(/^source:(.+)$/i);
        if (m) {
          source = m[1].toLowerCase();
          return;
        }
        const mn = tok.match(/^min:(\d+)$/i);
        if (mn) {
          minPts = parseInt(mn[1], 10);
          return;
        }
        terms.push(tok.toLowerCase());
      });
    return { terms, source, minPts };
  }

  function matches(rec, parsed) {
    if (parsed.source) {
      const src = (rec.source || "").toLowerCase();
      // Allow "hn" to match "HN" (Hacker News rows).
      if (!src.includes(parsed.source)) return false;
    }
    if (parsed.minPts !== null) {
      if (typeof rec.pts !== "number" || rec.pts < parsed.minPts) return false;
    }
    if (parsed.terms.length === 0) return parsed.source || parsed.minPts !== null;
    const hay = (rec.title + " \n " + rec.summary).toLowerCase();
    return parsed.terms.every((t) => hay.includes(t));
  }

  function escapeHTML(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlight(text, terms) {
    if (!text) return "";
    let safe = escapeHTML(text);
    if (!terms.length) return safe;
    // Build a single regex matching any term (escape regex specials, sort longest-first).
    const escaped = terms
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp("(" + escaped.join("|") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }

  function renderResultRow(rec, parsed) {
    const titleHTML = highlight(rec.title, parsed.terms);
    const summaryHTML = highlight(rec.summary || "", parsed.terms);
    const permalink = `posts/${rec.date}.html#${rec.id}`;
    const sourceHTML = rec.source ? `<span class="r-source">${escapeHTML(rec.source)}</span>` : "";
    const ptsHTML =
      typeof rec.pts === "number" ? `<span class="r-pts">▲ ${rec.pts}</span>` : "";
    const starOn = stars.has(rec.id);
    return `<li class="result-row" id="r-${rec.id}">
      <div class="r-head">
        <button class="star-btn ${starOn ? "on" : ""}" data-eid="${rec.id}" aria-pressed="${starOn ? "true" : "false"}" title="收藏">★</button>
        <span class="r-date">${escapeHTML(rec.date)}</span>
        ${sourceHTML}
        ${ptsHTML}
        <a class="r-title" href="${escapeHTML(rec.url)}" target="_blank" rel="noopener">${titleHTML}</a>
        <a class="r-perma" href="${escapeHTML(permalink)}" title="跳到当日上下文">↗ 当日</a>
      </div>
      ${summaryHTML ? `<div class="r-summary">${summaryHTML}</div>` : ""}
    </li>`;
  }

  function renderResults(query) {
    const panel = document.getElementById("search-results");
    const archive = document.getElementById("archive-list");
    const starsPanel = document.getElementById("stars-panel");
    if (!panel || !archive || !INDEX_DATA) return;

    const q = query.trim();
    if (!q) {
      panel.hidden = true;
      panel.innerHTML = "";
      archive.hidden = false;
      starsPanel.hidden = true;
      setActiveTab("archive");
      return;
    }

    const parsed = parseQuery(q);
    const hits = INDEX_DATA.filter((rec) => matches(rec, parsed));
    // Sort: newer first, then higher HN points.
    hits.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.pts || 0) - (a.pts || 0);
    });

    const HEADER = `<div class="results-meta">命中 <b>${hits.length}</b> 条 · 关键词 <code>${escapeHTML(q)}</code></div>`;
    if (hits.length === 0) {
      panel.innerHTML = HEADER + `<div class="empty">没有匹配的条目。试试更短的关键词,或 <code>source:openai</code> 限定信源。</div>`;
    } else {
      const MAX = 200;
      const sliced = hits.slice(0, MAX);
      const tail =
        hits.length > MAX ? `<div class="empty">仅显示前 ${MAX} 条,请添加更多关键词缩小范围。</div>` : "";
      panel.innerHTML = HEADER + `<ul class="result-list">${sliced.map((r) => renderResultRow(r, parsed)).join("")}</ul>` + tail;
    }
    panel.hidden = false;
    archive.hidden = true;
    starsPanel.hidden = true;
    hydrateStarButtons(panel);
  }

  // ─── Stars panel ─────────────────────────────────────────────────
  function renderStarsPanel() {
    const panel = document.getElementById("stars-panel");
    const archive = document.getElementById("archive-list");
    const results = document.getElementById("search-results");
    if (!panel || !INDEX_DATA) return;

    // Group by id — but the search index may have multiple date-entries per id; pick newest.
    const byId = new Map();
    for (const rec of INDEX_DATA) {
      const cur = byId.get(rec.id);
      if (!cur || rec.date > cur.date) byId.set(rec.id, rec);
    }

    const items = Array.from(stars)
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const HEADER = `<div class="results-meta">★ 收藏 <b>${items.length}</b> 条 · 数据存于本机 localStorage</div>`;
    if (items.length === 0) {
      panel.innerHTML =
        HEADER +
        `<div class="empty">还没有收藏。打开任意一天,点条目左侧的 ★ 即可加入这里。</div>`;
    } else {
      panel.innerHTML =
        HEADER +
        `<ul class="result-list">${items.map((r) => renderResultRow(r, { terms: [] })).join("")}</ul>`;
    }
    panel.hidden = false;
    archive.hidden = true;
    if (results) results.hidden = true;
    hydrateStarButtons(panel);
  }

  function setActiveTab(name) {
    document.querySelectorAll(".search-tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
  }

  function wireIndexPage() {
    const input = document.getElementById("search-input");
    const tabs = document.querySelectorAll(".search-tabs .tab");
    const starsCount = document.getElementById("stars-count");
    if (starsCount) starsCount.textContent = String(stars.size);

    loadSearchIndex().catch((e) => {
      console.error("search index load failed", e);
      const hint = document.getElementById("search-hint");
      if (hint) hint.textContent = "搜索索引加载失败:" + e.message;
    });

    if (input) {
      let timer = null;
      input.addEventListener("input", () => {
        clearTimeout(timer);
        const q = input.value;
        timer = setTimeout(() => {
          if (!INDEX_DATA) {
            loadSearchIndex().then(() => renderResults(q));
          } else {
            renderResults(q);
          }
          setActiveTab(q.trim() ? "" : "archive");
        }, 80);
      });
      // Focus with `/` shortcut
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "/" && document.activeElement !== input) {
          ev.preventDefault();
          input.focus();
          input.select();
        }
      });
    }

    tabs.forEach((b) => {
      b.addEventListener("click", () => {
        const name = b.dataset.tab;
        setActiveTab(name);
        if (name === "archive") {
          document.getElementById("search-results").hidden = true;
          document.getElementById("stars-panel").hidden = true;
          document.getElementById("archive-list").hidden = false;
          if (input) input.value = "";
        } else if (name === "stars") {
          if (!INDEX_DATA) {
            loadSearchIndex().then(() => renderStarsPanel());
          } else {
            renderStarsPanel();
          }
        }
      });
    });

    // Deep-link: /index.html#stars opens collection directly.
    if (window.location.hash === "#stars") {
      setActiveTab("stars");
      loadSearchIndex().then(() => renderStarsPanel());
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────
  if (PAGE === "post") {
    hydrateStarButtons(document);
    hydrateAnchors(document);
    highlightHash();
  } else if (PAGE === "index") {
    wireIndexPage();
  }
})();
