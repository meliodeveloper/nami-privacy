// Nami's article editor. Signs in with Supabase (email and password),
// lists every article, and writes them straight to public.articles. The
// database decides who may write (public.content_editors); this page only
// draws the forms. Pictures go to the article-images storage bucket.
(function () {
  "use strict";

  const CFG = window.NAMI_CONFIG;
  const SITE = CFG.site;
  const EDITOR_URL = SITE + "/reads/editor/";
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const $ = (id) => document.getElementById(id);

  const SCENES = [
    ["", "Topic scene"],
    ["reads", "Reads"],
    ["topic-pay-tax", "Pay & tax"],
    ["topic-spending", "Spending"],
    ["topic-borrowing", "Borrowing"],
    ["topic-saving", "Saving"],
    ["tax-code", "Tax code"],
    ["payslip", "Payslip"],
    ["student-loan", "Student loan"],
    ["pension-match", "Pension"],
    ["new-tax-year", "New tax year"],
    ["last-week", "Payday"],
    ["subscriptions", "Subscriptions"],
    ["overdraft-fees", "Overdraft"],
    ["pay-later", "Pay later"],
    ["emergency-pot", "Emergency pot"],
  ];
  const FEET = [
    ["payslip", "A payslip"],
    ["budget", "Budget"],
    ["income", "Income"],
    ["net_wealth", "Net Wealth"],
    ["subscriptions", "Subscriptions"],
    ["insights_fees", "Fees, on Insights"],
    ["account_credit", "A credit or pay later account"],
  ];
  const SIGNALS = [
    ["payslip_tax_code_unusual", "Their saved tax code is not the standard one"],
    ["payslip_first_read", "They've read a payslip in Nami"],
    ["payslip_student_loan", "Their job has a student loan plan saved"],
    ["payslip_pension", "Their job has a workplace pension saved"],
    ["budget_ahead_of_spread", "Their budget is running ahead of an even spread"],
    ["subscriptions_four_plus", "They pay for four or more subscriptions"],
    ["fees_this_month", "They paid fees or interest this month"],
    ["flex_account", "They have a pay later account in Nami"],
    ["season_new_tax_year", "It's the new tax year season (15 March to 30 April)"],
  ];
  const NUMBERS = [
    ["none", "No box"],
    ["tax_code", "Their tax code"],
    ["payslip_deductions", "Their payslip deductions"],
    ["student_loan_payslip", "Their student loan on a payslip"],
    ["pension_payslip", "Their pension on a payslip"],
    ["budget_pace", "Their budget pace"],
    ["subscriptions_month", "Their subscriptions this month"],
    ["fees_month", "Their fees this month"],
    ["flex_balance", "Their pay later balance"],
  ];

  let user = null;
  let articles = [];
  let filter = "all";
  let model = null; // the article being edited
  let originalId = null; // its id in the database, or null when new
  let dirty = false;
  let busy = false;

  // ---------- small helpers ----------

  function show(view) {
    for (const id of ["viewSignIn", "viewNewPassword", "viewNotEditor", "viewHome", "viewEdit"]) $(id).hidden = id !== view;
    window.scrollTo(0, 0);
  }

  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2600);
  }

  function setError(id, text) {
    $(id).textContent = text || "";
    $(id).hidden = !text;
  }

  // Database and network errors in plain words.
  function plain(error) {
    const message = String((error && (error.message || error.error_description)) || error || "");
    const code = error && error.code;
    if (code === "23505" || /duplicate key/.test(message)) return "Another article already uses this address. Pick a different one.";
    if (/address cannot change/.test(message)) return "The address can't change once an article has been published.";
    if (code === "42501" || /row-level security|permission denied/.test(message))
      return "This login isn't allowed to change articles. Sign out and in again, or ask Claude to check your editor access.";
    if (code === "23514" || /check constraint/.test(message)) return "Something in the form isn't allowed. Check the title, address and dates.";
    if (/Invalid login credentials/.test(message)) return "That email and password don't match. Try again, or reset your password.";
    if (/Failed to fetch|NetworkError|Load failed/.test(message)) return "Couldn't reach Nami's server. Check your connection and try again.";
    if (/Password should be/.test(message)) return "Use a password of at least 8 characters.";
    if (/already registered/.test(message)) return "There's already a login with this email. Sign in instead.";
    return message || "Something went wrong. Try again.";
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/^the basics:\s*/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "");
  }

  function ago(iso) {
    if (!iso) return "";
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
    if (seconds < 90) return "just now";
    if (seconds < 3600) return Math.round(seconds / 60) + " min ago";
    if (seconds < 86400) return Math.round(seconds / 3600) + " h ago";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function readLink(id) {
    return SITE + "/reads/?id=" + id;
  }

  // ---------- signing in ----------

  let mode = "signin"; // signin | create | reset

  function setMode(next) {
    mode = next;
    setError("signInError", "");
    $("signInOk").hidden = true;
    $("passwordField").hidden = next === "reset";
    $("password").required = next !== "reset";
    $("password").autocomplete = next === "create" ? "new-password" : "current-password";
    $("signInTitle").textContent =
      next === "create" ? "Create your editor login" : next === "reset" ? "Reset your password" : "Sign in to write articles";
    $("signInHint").textContent =
      next === "create"
        ? "Pick an email you read and a password of at least 8 characters. This login is only for writing articles."
        : next === "reset"
        ? "We'll email you a link to choose a new password."
        : "Use your editor login. This is separate from signing in to Nami with Apple.";
    $("signInButton").textContent = next === "create" ? "Create login" : next === "reset" ? "Email me a link" : "Sign in";
    $("toCreate").hidden = next !== "signin";
    $("toReset").hidden = next !== "signin";
    $("toSignIn").hidden = next === "signin";
  }

  $("toCreate").onclick = () => setMode("create");
  $("toReset").onclick = () => setMode("reset");
  $("toSignIn").onclick = () => setMode("signin");

  $("signInForm").onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    setError("signInError", "");
    const email = $("email").value.trim();
    const password = $("password").value;
    try {
      if (mode === "create") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: EDITOR_URL } });
        if (error) throw error;
        if (!data.session) {
          $("signInOk").textContent = "Check your email and press the link to finish, then sign in here.";
          $("signInOk").hidden = false;
          setMode("signin");
          $("signInOk").hidden = false;
        }
      } else if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: EDITOR_URL });
        if (error) throw error;
        setMode("signin");
        $("signInOk").textContent = "If there's a login for that email, a reset link is on its way.";
        $("signInOk").hidden = false;
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setError("signInError", plain(error));
    } finally {
      busy = false;
    }
  };

  $("newPasswordForm").onsubmit = async (event) => {
    event.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $("newPassword").value });
    if (error) return setError("newPasswordError", plain(error));
    toast("Password saved");
    route();
  };

  $("signOut").onclick = async () => {
    if (dirty && !(await ask("Sign out without saving?", "Your latest changes to this article will be lost.", "Sign out"))) return;
    dirty = false;
    await sb.auth.signOut();
  };

  let recovering = false;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      user = session && session.user;
      show("viewNewPassword");
      return;
    }
    const next = session ? session.user : null;
    const changed = (next && next.id) !== (user && user.id);
    user = next;
    $("who").textContent = user ? user.email : "";
    $("signOut").hidden = !user;
    if ((event === "INITIAL_SESSION" || changed) && !recovering) route();
  });

  async function route() {
    recovering = false;
    if (!user) {
      setMode("signin");
      return show("viewSignIn");
    }
    const { data, error } = await sb.from("content_editors").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !data) {
      $("editorLine").textContent = "Make " + user.email + " an article editor (" + user.id + ")";
      return show("viewNotEditor");
    }
    await loadList();
    const wanted = new URLSearchParams(location.search).get("edit");
    if (wanted && articles.some((a) => a.id === wanted)) openArticle(wanted);
    else show("viewHome");
  }

  $("copyLine").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("editorLine").textContent);
      toast("Copied");
    } catch (_) {
      toast("Select the line and copy it");
    }
  };
  $("recheck").onclick = () => route();

  // ---------- the list ----------

  async function loadList() {
    setError("homeError", "");
    const { data, error } = await sb
      .from("articles")
      .select("id,status,listed,title,dek,topic,art,sort_order,updated_at,minutes,sections,sources,checked,related")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      setError("homeError", plain(error));
      articles = [];
    } else {
      articles = data;
    }
    drawList();
  }

  function drawList() {
    const list = $("articleList");
    list.replaceChildren();
    const shown = articles.filter((a) =>
      filter === "all" ? true : filter === "explainer" ? a.listed === false : a.status === filter
    );
    if (!shown.length) {
      const li = document.createElement("li");
      li.style.cssText = "padding:12px;color:var(--ink-soft)";
      li.textContent = articles.length ? "Nothing here." : "No articles yet. Press New article to write the first.";
      list.append(li);
      return;
    }
    for (const a of shown) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      const img = document.createElement("img");
      img.src = window.NamiReads.artURL(a, true);
      img.alt = "";
      const text = document.createElement("div");
      const title = document.createElement("div");
      title.className = "t";
      title.textContent = a.title;
      const meta = document.createElement("div");
      meta.className = "m";
      const span = (text) => {
        const node = document.createElement("span");
        node.textContent = text;
        return node;
      };
      meta.append(pill(a.status));
      if (a.listed === false) meta.append(pill("explainer"));
      meta.append(span(window.NamiReads.TOPICS[a.topic] || ""), span("Edited " + ago(a.updated_at)));
      text.append(title, meta);
      button.append(img, text);
      button.onclick = () => openArticle(a.id);
      li.append(button);
      list.append(li);
    }
  }

  function pill(kind) {
    const span = document.createElement("span");
    span.className = "ed-pill " + kind;
    span.textContent = kind === "published" ? "Published" : kind === "draft" ? "Draft" : "Explainer";
    return span;
  }

  $("filters").onclick = (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    for (const b of $("filters").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
    drawList();
  };

  $("newArticle").onclick = () => {
    originalId = null;
    model = {
      id: "",
      status: "draft",
      listed: true,
      title: "",
      dek: "",
      topic: "pay_tax",
      art: null,
      sort_order: 1000,
      minutes: null,
      shows_when: [],
      foot_of: [],
      your_numbers: "none",
      ask: "",
      related: [],
      sources: [],
      sections: [{ heading: "", text: "" }],
      checked: today(),
      review_by: null,
      min_app_version: null,
      published_at: null,
    };
    dirty = false;
    drawForm();
    show("viewEdit");
    $("fTitle").focus();
  };

  // ---------- one article ----------

  async function openArticle(id) {
    const { data, error } = await sb.from("articles").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setError("homeError", error ? plain(error) : "That article isn't there any more.");
      return show("viewHome");
    }
    originalId = data.id;
    model = data;
    if (!Array.isArray(model.sections) || !model.sections.length) model.sections = [{ heading: "", text: "" }];
    dirty = false;
    drawForm();
    show("viewEdit");
  }

  $("backHome").onclick = async () => {
    if (dirty && !(await ask("Leave without saving?", "Your latest changes to this article will be lost.", "Leave"))) return;
    dirty = false;
    await loadList();
    history.replaceState(null, "", EDITOR_URL);
    show("viewHome");
  };

  function drawForm() {
    setError("editError", "");
    const published = model.status === "published";
    $("fTitle").value = model.title || "";
    $("fDek").value = model.dek || "";
    $("fListed").value = String(model.listed !== false);
    $("fTopic").value = model.topic || "pay_tax";
    $("fId").value = model.id || "";
    // Fixed from the first save, so links, history and the app's ticks all
    // keep pointing at the same article.
    $("fId").disabled = !!originalId;
    $("idHint").textContent = originalId
      ? "The address is fixed once an article is saved: " + readLink(model.id)
      : "Lower case words and hyphens. It's part of the link, so it can't change after the first save.";
    $("fChecked").value = model.checked || "";
    $("fReviewBy").value = model.review_by || "";
    $("fOrder").value = model.sort_order ?? 1000;
    $("fAsk").value = model.ask || "";
    $("fRelated").value = (model.related || []).join(", ");
    $("fMinVersion").value = model.min_app_version || "";
    drawChecks("fFoot", FEET, model.foot_of || []);
    drawChecks("fShows", SIGNALS, model.shows_when || []);
    const numbers = $("fNumbers");
    numbers.replaceChildren(...NUMBERS.map(([v, l]) => new Option(l, v)));
    numbers.value = model.your_numbers || "none";
    drawScenes();
    drawSections();
    drawSources();
    $("appCard").hidden = model.listed === false;
    $("dangerCard").hidden = !originalId;
    $("editStatus").replaceChildren(pill(published ? "published" : "draft"));
    $("unpublish").hidden = !published;
    $("saveDraft").textContent = published ? "Save changes" : "Save draft";
    $("saveDraft").classList.toggle("primary", published);
    $("publish").hidden = published;
    $("openOnSite").hidden = !published;
    $("openOnSite").href = readLink(model.id);
    $("showHistory").hidden = !originalId;
    if (originalId) history.replaceState(null, "", EDITOR_URL + "?edit=" + encodeURIComponent(originalId));
    drawPreview();
  }

  function drawChecks(id, options, chosen) {
    const box = $(id);
    box.replaceChildren();
    for (const [value, label] of options) {
      const l = document.createElement("label");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.value = value;
      c.checked = chosen.includes(value);
      c.onchange = () => {
        const list = new Set(id === "fFoot" ? model.foot_of : model.shows_when);
        c.checked ? list.add(value) : list.delete(value);
        if (id === "fFoot") model.foot_of = [...list];
        else model.shows_when = [...list];
        changed(false);
      };
      l.append(c, document.createTextNode(label));
      box.append(l);
    }
  }

  function drawScenes() {
    const box = $("scenes");
    box.replaceChildren();
    for (const [value, label] of SCENES) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String((model.art || "") === value));
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = SITE + "/reads/art/" + (value || "topic-" + model.topic.replace(/_/g, "-")) + "-thumb.jpg";
      const span = document.createElement("span");
      span.textContent = label;
      b.append(img, span);
      b.onclick = () => {
        model.art = value || null;
        drawScenes();
        changed();
      };
      box.append(b);
    }
  }

  // ---------- sections ----------

  function drawSections() {
    const box = $("sections");
    box.replaceChildren();
    model.sections.forEach((section, index) => {
      const wrap = document.createElement("div");
      wrap.className = "ed-section";

      const head = document.createElement("div");
      head.className = "ed-section-head";
      const heading = document.createElement("input");
      heading.className = "ed-input";
      heading.placeholder = "Section heading, e.g. Personal Allowance at a glance";
      heading.value = section.heading || "";
      heading.oninput = () => {
        section.heading = heading.value;
        changed();
      };
      head.append(heading);
      head.append(smallButton("↑", "Move up", index === 0, () => move(index, -1)));
      head.append(smallButton("↓", "Move down", index === model.sections.length - 1, () => move(index, 1)));
      head.append(smallButton("Remove", "Remove this section", model.sections.length === 1, async () => {
        if (await ask("Remove this section?", section.heading || "This section", "Remove")) {
          model.sections.splice(index, 1);
          drawSections();
          changed();
        }
      }));

      const text = document.createElement("textarea");
      text.className = "ed-textarea";
      text.placeholder = "Write here. Leave an empty line between paragraphs.";
      text.value = section.text || "";
      text.oninput = () => {
        section.text = text.value;
        changed();
      };

      const tools = document.createElement("div");
      tools.className = "ed-tools";
      const tool = (label, title, action) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.title = title;
        b.onclick = () => {
          action(text);
          section.text = text.value;
          changed();
        };
        tools.append(b);
      };
      tool("B", "Bold", (t) => wrapSelection(t, "**", "**", "bold words"));
      tool("I", "Italics", (t) => wrapSelection(t, "*", "*", "words"));
      tool("Sub-heading", "A smaller heading inside the section, e.g. 1. Detraining", (t) => prefixLines(t, "### ", "Sub-heading"));
      tool("• List", "Bullet points", (t) => prefixLines(t, "- ", "Point"));
      tool("1. List", "Numbered list", (t) => numberLines(t));
      tool("What to do", "A bullet with a bold lead-in, like Bevel's", (t) => insertBlock(t, "- **What to do:** ", "what to do"));
      tool("Link", "Link to a web page", (t) => linkDialog(t));
      tool("Link to article", "Link to another Nami article", (t) => readDialog(t));
      tool("Picture", "Add a picture", (t) => pictureUpload(t, section));

      wrap.append(head, tools, text);
      box.append(wrap);
    });
  }

  function smallButton(label, title, disabled, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-btn small";
    b.textContent = label;
    b.title = title;
    b.disabled = disabled;
    b.onclick = action;
    return b;
  }

  function move(index, by) {
    const [section] = model.sections.splice(index, 1);
    model.sections.splice(index + by, 0, section);
    drawSections();
    changed();
  }

  $("addSection").onclick = () => {
    model.sections.push({ heading: "", text: "" });
    drawSections();
    changed();
    const all = $("sections").querySelectorAll(".ed-section input");
    all[all.length - 1].focus();
  };

  // A link typed straight after a word gets a space before it.
  function spaced(t, start, end, text) {
    const before = t.value.slice(0, start);
    return start === end && before && !/\s$/.test(before) ? " " + text : text;
  }

  function replaceRange(t, start, end, text, selectFrom, selectTo) {
    t.focus();
    t.setRangeText(text, start, end, "end");
    if (selectFrom !== undefined) t.setSelectionRange(start + selectFrom, start + selectTo);
  }

  function wrapSelection(t, before, after, placeholder) {
    const { selectionStart: s, selectionEnd: e } = t;
    const inner = t.value.slice(s, e) || placeholder;
    replaceRange(t, s, e, before + inner + after, before.length, before.length + inner.length);
  }

  // The current line(s), from the start of the first to the end of the last.
  function lineRange(t) {
    const v = t.value;
    const start = v.lastIndexOf("\n", t.selectionStart - 1) + 1;
    let end = v.indexOf("\n", t.selectionEnd);
    if (end === -1) end = v.length;
    return [start, end];
  }

  function prefixLines(t, prefix, placeholder) {
    const [start, end] = lineRange(t);
    const lines = t.value.slice(start, end).split("\n");
    const text = lines.map((l) => prefix + (l.replace(/^(#{1,6} |- |\* |\d+\. )/, "") || placeholder)).join("\n");
    replaceRange(t, start, end, text);
  }

  function numberLines(t) {
    const [start, end] = lineRange(t);
    const lines = t.value.slice(start, end).split("\n");
    const text = lines.map((l, i) => i + 1 + ". " + (l.replace(/^(#{1,6} |- |\* |\d+\. )/, "") || "Point")).join("\n");
    replaceRange(t, start, end, text);
  }

  // A new paragraph or block at the cursor, with blank lines around it.
  function insertBlock(t, text, selectWord) {
    const v = t.value;
    const at = t.selectionEnd;
    const before = v.slice(0, at);
    const lead = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const insert = lead + text + "\n\n";
    replaceRange(t, at, at, insert);
    if (selectWord) {
      const from = at + lead.length + text.length;
      t.setRangeText(selectWord, from, from, "select");
    }
  }

  function closeOn(dialog) {
    dialog.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => dialog.close()));
  }
  document.querySelectorAll("dialog").forEach(closeOn);

  function linkDialog(t) {
    const { selectionStart: s, selectionEnd: e } = t;
    $("linkText").value = t.value.slice(s, e);
    $("linkURL").value = "https://";
    $("dlgLink").showModal();
    $("linkInsert").onclick = () => {
      let url = $("linkURL").value.trim();
      if (!/^https?:\/\/\S+\.\S+/.test(url) && !/^mailto:/.test(url)) return toast("Enter a full web address, starting https://");
      const words = $("linkText").value.trim() || url;
      $("dlgLink").close();
      replaceRange(t, s, e, spaced(t, s, e, "[" + words + "](" + url + ")"));
      t.dispatchEvent(new Event("input"));
    };
  }

  function readDialog(t) {
    const { selectionStart: s, selectionEnd: e } = t;
    $("readText").value = t.value.slice(s, e);
    const list = $("readPick");
    list.replaceChildren();
    const others = articles.filter((a) => a.id !== originalId);
    if (!others.length) {
      const li = document.createElement("li");
      li.textContent = "No other articles yet.";
      list.append(li);
    }
    for (const a of others) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.title;
      const small = document.createElement("small");
      small.textContent = (a.status === "draft" ? "Draft, not on the site yet. " : "") + (a.listed === false ? "Explainer" : "Read");
      b.append(small);
      b.onclick = () => {
        const words = $("readText").value.trim() || a.title;
        $("dlgRead").close();
        replaceRange(t, s, e, spaced(t, s, e, "[" + words + "](" + readLink(a.id) + ")"));
        t.dispatchEvent(new Event("input"));
      };
      li.append(b);
      list.append(li);
    }
    $("dlgRead").showModal();
  }

  // ---------- pictures ----------

  function pictureUpload(t, section) {
    const input = $("picFile");
    input.value = "";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const at = t.selectionEnd;
      try {
        toast("Uploading the picture…");
        const blob = await shrink(file);
        const folder = slugify(model.id || model.title) || "article";
        const path = folder + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
        const { error } = await sb.storage
          .from("article-images")
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const { data } = sb.storage.from("article-images").getPublicUrl(path);
        const line = "![Describe the picture](" + data.publicUrl + ")";
        if (!t.isConnected || !model.sections.includes(section)) {
          // The sections were redrawn while it uploaded: add it to the end of
          // the same section's words rather than to a box no longer shown.
          if (model.sections.includes(section)) {
            section.text = String(section.text || "").replace(/\s+$/, "") + "\n\n" + line + "\n";
            drawSections();
          }
        } else {
          t.setSelectionRange(Math.min(at, t.value.length), Math.min(at, t.value.length));
          insertBlock(t, line, null);
          // Select the caption so it can be typed over straight away.
          const start = t.value.indexOf(line);
          if (start >= 0) t.setSelectionRange(start + 2, start + 2 + "Describe the picture".length);
          section.text = t.value;
        }
        changed();
        toast("Picture added. Type its caption over the selected words.");
      } catch (error) {
        setError("editError", "The picture didn't upload. " + plain(error));
      }
    };
    input.click();
  }

  // At most 1600 pixels wide, as a JPEG, so pictures stay light on phones.
  async function shrink(file) {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error("That file isn't a picture this browser can open. Try a JPEG or PNG.");
    const scale = Math.min(1, 1600 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the picture."))), "image/jpeg", 0.86)
    );
  }

  // ---------- sources ----------

  function drawSources() {
    const box = $("sources");
    box.replaceChildren();
    (model.sources || []).forEach((source, index) => {
      const row = document.createElement("div");
      row.className = "ed-source";
      const name = document.createElement("input");
      name.className = "ed-input";
      name.placeholder = "Name, e.g. GOV.UK, Tax codes";
      name.value = source.name || "";
      name.oninput = () => {
        source.name = name.value;
        changed();
      };
      const url = document.createElement("input");
      url.className = "ed-input";
      url.placeholder = "https://www.gov.uk/tax-codes";
      url.value = source.url || "";
      url.oninput = () => {
        source.url = url.value.trim();
        changed();
      };
      row.append(name, url, smallButton("Remove", "Remove this source", false, () => {
        model.sources.splice(index, 1);
        drawSources();
        changed();
      }));
      box.append(row);
    });
  }

  $("addSource").onclick = () => {
    model.sources = model.sources || [];
    model.sources.push({ name: "", url: "" });
    drawSources();
    changed(false);
  };

  // ---------- simple fields ----------

  function bind(id, apply) {
    $(id).addEventListener("input", () => {
      apply($(id).value);
      changed();
    });
  }
  bind("fTitle", (v) => {
    const auto = !originalId && (!model.id || model.id === slugify(model.title));
    model.title = v;
    if (auto) {
      model.id = slugify(v);
      $("fId").value = model.id;
    }
  });
  bind("fDek", (v) => (model.dek = v));
  bind("fId", (v) => (model.id = v.trim()));
  bind("fChecked", (v) => (model.checked = v || null));
  bind("fReviewBy", (v) => (model.review_by = v || null));
  bind("fOrder", (v) => (model.sort_order = parseInt(v, 10) || 1000));
  bind("fAsk", (v) => (model.ask = v));
  bind("fRelated", (v) => (model.related = v.split(",").map((s) => s.trim()).filter(Boolean)));
  bind("fMinVersion", (v) => (model.min_app_version = v.trim() || null));
  $("fNumbers").onchange = () => {
    model.your_numbers = $("fNumbers").value;
    changed(false);
  };
  $("fListed").onchange = () => {
    model.listed = $("fListed").value === "true";
    $("appCard").hidden = !model.listed;
    changed();
  };
  $("fTopic").onchange = () => {
    model.topic = $("fTopic").value;
    drawScenes();
    changed();
  };

  let previewTimer = null;
  function changed(redraw = true) {
    dirty = true;
    if (redraw) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(drawPreview, 200);
    }
  }

  function drawPreview() {
    const box = $("preview");
    try {
      box.replaceChildren(window.NamiReads.articleNode(model, []));
    } catch (_) {
      /* a half-typed link is fine; the next keystroke redraws */
    }
  }

  $("togglePreview").onclick = () => {
    const split = $("split");
    split.classList.toggle("show-preview");
    $("togglePreview").textContent = split.classList.contains("show-preview") ? "Edit" : "Preview";
    window.scrollTo(0, 0);
  };

  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  // ---------- saving ----------

  function problems(publishing) {
    const out = [];
    if (!String(model.title || "").trim()) out.push("Give it a title.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(model.id || "")) out.push("The address needs lower case words and hyphens only, e.g. personal-allowance.");
    if (publishing) {
      if (!model.sections.some((s) => String(s.text || "").trim())) out.push("Write at least one section before publishing.");
      if (model.sections.some((s) => String(s.text || "").includes("Describe the picture")))
        out.push("A picture still says “Describe the picture”. Type its caption first.");
    }
    for (const s of model.sources || []) {
      if ((s.name || s.url) && !/^https:\/\//.test(s.url || "")) out.push("Each source needs a web address starting https://");
    }
    if (model.checked && model.review_by && model.review_by < model.checked) out.push("The check-again date is before the checked date.");
    return [...new Set(out)];
  }

  function row(status) {
    return {
      id: model.id,
      status,
      listed: model.listed !== false,
      title: String(model.title || "").trim(),
      dek: String(model.dek || "").trim(),
      topic: model.topic,
      art: model.art || null,
      sort_order: model.sort_order ?? 1000,
      shows_when: model.listed === false ? [] : model.shows_when || [],
      foot_of: model.listed === false ? [] : model.foot_of || [],
      your_numbers: model.listed === false ? "none" : model.your_numbers || "none",
      ask: model.listed === false ? "" : model.ask || "",
      related: model.related || [],
      sources: (model.sources || []).filter((s) => s.name && s.url),
      sections: model.sections
        .map((s) => ({ heading: String(s.heading || "").trim(), text: String(s.text || "").replace(/\s+$/, "") }))
        .filter((s) => s.heading || s.text),
      checked: model.checked || null,
      review_by: model.review_by || null,
      min_app_version: model.min_app_version || null,
    };
  }

  async function save(status, message) {
    if (busy) return;
    const issues = problems(status === "published");
    if (issues.length) return setError("editError", issues.join(" "));
    setError("editError", "");
    busy = true;
    // Nothing can be typed while saving, so nothing typed is lost when the
    // saved article comes back.
    $("split").inert = true;
    for (const b of ["saveDraft", "publish", "unpublish"]) $(b).disabled = true;
    try {
      const values = row(status);
      // Only over the version this page opened: a save from another tab or
      // device in between is never overwritten without a word.
      const query = originalId
        ? sb.from("articles").update(values).eq("id", originalId).eq("updated_at", model.updated_at)
        : sb.from("articles").insert(values);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error(
          "This article was changed somewhere else (another tab or device) since you opened it. Copy anything you want to keep, then go back to All articles and open it again."
        );
      }
      originalId = data.id;
      model = data;
      if (!model.sections.length) model.sections = [{ heading: "", text: "" }];
      dirty = false;
      await loadList();
      drawForm();
      toast(message);
    } catch (error) {
      setError("editError", plain(error));
    } finally {
      busy = false;
      $("split").inert = false;
      for (const b of ["saveDraft", "publish", "unpublish"]) $(b).disabled = false;
    }
  }

  $("saveDraft").onclick = () => {
    const published = model.status === "published";
    save(published ? "published" : "draft", published ? "Saved. It's live on the site now." : "Draft saved");
  };
  $("publish").onclick = () => save("published", "Published. It's on the site now, and in the app within an hour.");
  $("unpublish").onclick = async () => {
    if (await ask("Unpublish this article?", "It comes off the site and out of the app. It stays here as a draft.", "Unpublish"))
      save("draft", "Unpublished. It's a draft again.");
  };

  $("deleteArticle").onclick = async () => {
    if (!(await ask("Delete this article?", "It comes off the site and out of the app. History keeps a copy.", "Delete"))) return;
    const { error } = await sb.from("articles").delete().eq("id", originalId);
    if (error) return setError("editError", plain(error));
    dirty = false;
    toast("Deleted");
    await loadList();
    history.replaceState(null, "", EDITOR_URL);
    show("viewHome");
  };

  // ---------- history ----------

  $("showHistory").onclick = async () => {
    const list = $("historyList");
    list.replaceChildren();
    const { data, error } = await sb
      .from("article_revisions")
      .select("revision_id,action,saved_at,snapshot")
      .eq("article_id", originalId)
      .order("saved_at", { ascending: false })
      .limit(50);
    if (error) return setError("editError", plain(error));
    for (const r of data || []) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const when = new Date(r.saved_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      b.textContent = when + ", " + (r.snapshot.status === "published" ? "published" : "draft");
      const small = document.createElement("small");
      small.textContent = r.snapshot.title + (r.action === "insert" ? " (first save)" : "");
      b.append(small);
      b.onclick = () => {
        const keep = { id: model.id, published_at: model.published_at, status: model.status, updated_at: model.updated_at };
        model = Object.assign({}, r.snapshot, keep);
        if (!Array.isArray(model.sections) || !model.sections.length) model.sections = [{ heading: "", text: "" }];
        $("dlgHistory").close();
        drawForm();
        dirty = true;
        toast("That version is in the editor. Save to keep it.");
      };
      li.append(b);
      list.append(li);
    }
    $("dlgHistory").showModal();
  };

  // ---------- confirm ----------

  function ask(title, text, action) {
    return new Promise((resolve) => {
      const dialog = $("dlgConfirm");
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      $("confirmGo").textContent = action;
      let answered = false;
      $("confirmGo").onclick = () => {
        answered = true;
        dialog.close();
        resolve(true);
      };
      dialog.onclose = () => {
        if (!answered) resolve(false);
      };
      dialog.showModal();
    });
  }

  // ---------- start ----------

  // onAuthStateChange above fires INITIAL_SESSION once the stored login
  // (or a link's) is read, and that draws the first screen.
  setMode("signin");
})();
