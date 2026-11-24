// Nami Reads on the web: the article page and the list, drawn from the
// published articles in Supabase. The editor's preview uses the same
// drawing code, so what the founder sees while writing is what goes out.
//
// Needs: marked, DOMPurify, assets/nami-config.js.
(function () {
  "use strict";

  const CFG = window.NAMI_CONFIG;
  const SITE = CFG.site;
  const TOPICS = {
    pay_tax: "Pay & tax",
    spending: "Spending",
    borrowing: "Borrowing",
    saving: "Saving",
  };
  const TOPIC_ORDER = ["pay_tax", "spending", "borrowing", "saving"];
  const params = new URLSearchParams(location.search);
  // Opened from inside the Nami app: no "get the app" button.
  const inApp = params.has("in_app");
  if (inApp) document.documentElement.classList.add("in-app");

  // ---------- data ----------

  const COLUMNS =
    "id,listed,title,dek,topic,art,sort_order,minutes,sources,sections,checked,related,updated_at";

  async function rest(path) {
    const response = await fetch(CFG.supabaseUrl + "/rest/v1/" + path, {
      headers: { apikey: CFG.publishableKey, Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Request failed (" + response.status + ")");
    return response.json();
  }

  function publishedArticles() {
    return rest(
      "articles?select=" + COLUMNS + "&status=eq.published&order=sort_order.asc,id.asc"
    );
  }

  // ---------- helpers ----------

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children || [])) {
      if (child) node.append(child);
    }
    return node;
  }

  function scene(article) {
    return article.art || "topic-" + String(article.topic || "").replace(/_/g, "-");
  }

  // Art made in the editor lives in the article-images bucket; its
  // thumbnail sits beside it as <name>-thumb.jpg.
  const MADE_ART = CFG.supabaseUrl + "/storage/v1/object/public/article-images/art/";

  function artURL(article, thumb) {
    const art = String(article.art || "");
    if (art.startsWith(MADE_ART) && /\.jpg$/.test(art)) return thumb ? art.replace(/\.jpg$/, "-thumb.jpg") : art;
    return SITE + "/reads/art/" + scene(article) + (thumb ? "-thumb" : "") + ".jpg";
  }

  function readURL(id) {
    return SITE + "/reads/?id=" + encodeURIComponent(id) + (inApp ? "&in_app=1" : "");
  }

  function words(article) {
    return (article.sections || []).reduce((sum, section) => {
      const text = String(section.text || "").trim();
      return sum + (text ? text.split(/\s+/).length : 0);
    }, 0);
  }

  function minutes(article) {
    return article.minutes || Math.max(1, Math.ceil(words(article) / 160));
  }

  function longDate(value) {
    if (!value) return "";
    const date = new Date(value + "T12:00:00Z");
    if (isNaN(date)) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }

  // A link to another read keeps the reader inside the site (and inside the
  // app's browser); any other link opens on its own.
  function fixLink(anchor) {
    const href = anchor.getAttribute("href") || "";
    let url;
    try {
      url = new URL(href, SITE + "/reads/");
    } catch (_) {
      anchor.removeAttribute("href");
      return;
    }
    if (!/^https?:$/.test(url.protocol) && url.protocol !== "mailto:") {
      anchor.removeAttribute("href");
      return;
    }
    // A read on this site, or on an address the site used to have: point it
    // at this site.
    let isRead = false;
    for (const base of [SITE].concat(CFG.sites || [])) {
      const site = new URL(base);
      const prefix = site.pathname.replace(/\/$/, "") + "/reads";
      if (url.origin === site.origin && (url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        url = new URL(SITE + url.pathname.slice(prefix.length - "/reads".length) + url.search + url.hash);
        isRead = true;
        break;
      }
    }
    if (isRead) {
      if (inApp) url.searchParams.set("in_app", "1");
      anchor.setAttribute("href", url.toString());
      anchor.classList.add("read-link");
    } else {
      anchor.setAttribute("href", url.toString());
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener");
    }
  }

  // Markdown to safe HTML: paragraphs, ### sub-headings, bullet and
  // numbered lists, bold, italics, links, and a picture on its own line
  // (its description becomes the caption).
  function markdown(text) {
    const html = window.marked.parse(String(text || ""), { gfm: true, breaks: false });
    const clean = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "b", "i", "a", "img", "br", "blockquote"],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "start"],
    });
    const template = document.createElement("template");
    template.innerHTML = clean;
    template.content.querySelectorAll("p").forEach((p) => {
      const kids = [...p.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
      if (kids.length === 1 && kids[0].nodeName === "IMG") {
        const img = kids[0];
        img.loading = "lazy";
        const figure = el("figure", {}, [img]);
        if (img.alt) figure.append(el("figcaption", { text: img.alt }));
        p.replaceWith(figure);
      }
    });
    template.content.querySelectorAll("img").forEach((img) => {
      if (!/^https:\/\//.test(img.getAttribute("src") || "")) img.remove();
    });
    template.content.querySelectorAll("a").forEach(fixLink);
    return template.content;
  }

  function chips(article) {
    return el("div", { class: "chips" }, [
      el("span", { class: "chip chip-brand" }, [
        el("img", { src: SITE + "/assets/nami-icon.png", alt: "" }),
        "Nami Reads",
      ]),
      el("span", { class: "chip", text: TOPICS[article.topic] || article.topic }),
      el("span", { class: "chip", text: article.listed === false ? "Explainer" : minutes(article) + " min read" }),
    ]);
  }

  function card(article) {
    return el("a", { class: "card", href: readURL(article.id) }, [
      el("div", { class: "card-art" }, [el("img", { src: artURL(article, false), alt: "", loading: "lazy" })]),
      el("div", { class: "card-body" }, [
        chips(article),
        el("h3", { text: article.title }),
        article.dek ? el("p", { text: article.dek }) : null,
      ]),
    ]);
  }

  // ---------- the article ----------

  function articleNode(article, all) {
    const root = el("article", { class: "read" });

    const hero = el("div", { class: "hero" }, [el("img", { src: artURL(article, false), alt: "" })]);
    hero.querySelector("img").addEventListener("error", function () {
      this.remove();
      hero.classList.add("hero-plain", "topic-" + article.topic);
    });
    root.append(hero);

    const head = el("header", { class: "read-head" }, [
      el("a", { class: "back", href: SITE + "/reads/" + (inApp ? "?in_app=1" : "") }, ["‹ All reads"]),
      chips(article),
      el("h1", { text: article.title }),
      article.dek ? el("p", { class: "dek", text: article.dek }) : null,
    ]);
    root.append(head);

    const body = el("div", { class: "read-body" });
    for (const section of article.sections || []) {
      const block = el("section");
      if (section.heading) block.append(el("h2", { class: "section-title", text: section.heading }));
      block.append(markdown(section.text));
      body.append(block);
    }

    const sources = (article.sources || []).filter((s) => s && s.name);
    const foot = el("section", { class: "sources" });
    if (sources.length) {
      foot.append(el("p", { class: "sources-label", text: "Sources" }));
      const list = el("ul");
      for (const source of sources) {
        const anchor = el("a", { href: source.url || "#", text: source.name });
        fixLink(anchor);
        list.append(el("li", {}, [anchor]));
      }
      foot.append(list);
    }
    const checked = longDate(article.checked);
    foot.append(
      el("p", {
        class: "stamp",
        text: (checked ? "Checked " + checked + ". " : "") + "General information, not financial advice.",
      })
    );
    body.append(foot);
    root.append(body);

    const related = relatedTo(article, all || []);
    if (related.length) {
      root.append(
        el("aside", { class: "related" }, [
          el("h2", { text: "Related reads" }),
          el("div", { class: "cards" }, related.map(card)),
        ])
      );
    }
    return root;
  }

  // The articles the writer named, then the same topic, then the rest; two
  // of them, never the article itself.
  function relatedTo(article, all) {
    const others = all.filter((a) => a.id !== article.id);
    const picked = [];
    const add = (a) => {
      if (a && !picked.includes(a) && picked.length < 2) picked.push(a);
    };
    (article.related || []).forEach((id) => add(others.find((a) => a.id === id)));
    others.filter((a) => a.listed !== false && a.topic === article.topic).forEach(add);
    others.filter((a) => a.listed !== false).forEach(add);
    return picked;
  }

  // ---------- the list ----------

  function listNode(all) {
    const root = el("div", { class: "library" });
    const listed = all.filter((a) => a.listed !== false);
    for (const topic of TOPIC_ORDER) {
      const inTopic = listed.filter((a) => a.topic === topic);
      if (!inTopic.length) continue;
      root.append(
        el("section", { class: "library-group" }, [
          el("h2", { text: TOPICS[topic] }),
          el("div", { class: "cards" }, inTopic.map(card)),
        ])
      );
    }
    const explainers = all.filter((a) => a.listed === false);
    if (explainers.length) {
      const list = el("ul", { class: "explainers" });
      explainers.forEach((a) =>
        list.append(el("li", {}, [el("a", { href: readURL(a.id), text: a.title }), a.dek ? el("span", { text: a.dek }) : null]))
      );
      root.append(el("section", { class: "library-group" }, [el("h2", { text: "Words explained" }), list]));
    }
    return root;
  }

  // ---------- the page ----------

  async function start() {
    const mount = document.getElementById("reads-root");
    if (!mount) return;
    const id = params.get("id");
    if (id) {
      document.documentElement.classList.add("is-article");
      mount.replaceChildren(el("p", { class: "loading", text: "Loading…" }));
    }
    let all;
    try {
      all = await publishedArticles();
    } catch (error) {
      if (id) {
        mount.replaceChildren(
          el("div", { class: "notice" }, [
            el("h1", { text: "This read didn't load" }),
            el("p", { text: "Check your connection and try again." }),
            el("p", {}, [el("a", { href: location.href, text: "Try again" })]),
          ])
        );
      }
      return; // The list keeps the copy the site was built with.
    }
    if (id) {
      const article = all.find((a) => a.id === id);
      if (!article) {
        mount.replaceChildren(
          el("div", { class: "notice" }, [
            el("h1", { text: "This read isn't available" }),
            el("p", { text: "It may have been moved or taken down." }),
            el("p", {}, [el("a", { href: SITE + "/reads/" + (inApp ? "?in_app=1" : ""), text: "See all reads" })]),
          ])
        );
        return;
      }
      document.title = article.title + ", Nami Reads";
      const description = document.querySelector('meta[name="description"]');
      if (description && article.dek) description.setAttribute("content", article.dek);
      mount.replaceChildren(articleNode(article, all));
      window.scrollTo(0, 0);
    } else {
      const target = document.getElementById("library-root");
      if (!target) return;
      target.replaceChildren(
        all.length
          ? listNode(all)
          : el("div", { class: "notice" }, [el("p", { text: "No reads are published right now. Check back soon." })])
      );
    }
  }

  window.NamiReads = { markdown, articleNode, listNode, artURL, minutes, words, TOPICS, scene, MADE_ART };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
