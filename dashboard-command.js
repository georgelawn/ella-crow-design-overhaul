(function () {
  const keys = {
    gigs: "ella-crow-gigs-v2",
    sessions: "ella-crow-sessions-v1",
    finance: "ella-crow-finance-v1",
    projects: "ella-crow-projects-v1",
    todos: "ella-crow-manual-todos-v1",
    opportunities: "ella-crow-opportunities-v1",
    contacts: "ella-crow-contacts-v1"
  };

  const pageLabels = {
    "index.html": "Gigs",
    "calendar.html": "Calendar",
    "sessions.html": "Sessions",
    "finance.html": "Finance",
    "projects.html": "Projects",
    "todos.html": "To Do",
    "opportunities.html": "Opportunities",
    "social.html": "Social",
    "contacts.html": "Contacts"
  };

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function dateValue(value, endOfDay = false) {
    if (!value) return null;
    const suffix = String(value).includes("T") ? "" : `T${endOfDay ? "23:59:59" : "00:00:00"}`;
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function daysUntil(value) {
    const date = dateValue(value);
    if (!date) return null;
    const today = dateValue(localDate());
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function dateLabel(value) {
    const date = dateValue(value);
    if (!date) return "No date";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isPast(value) {
    const date = dateValue(value, true);
    return date ? date.getTime() < Date.now() : false;
  }

  function gigStatus(gig) {
    if (gig.manualStatus) return gig.status || "booked";
    if (isPast(gig.date)) return "complete";
    return gig.status || "booked";
  }

  function sessionStatus(session) {
    if (session.manualStatus) return session.status || "booked";
    if (isPast(session.date)) return "complete";
    return session.status || "booked";
  }

  function isClosedOpportunity(item) {
    return ["won", "lost", "closed", "complete", "completed"].includes(String(item.status || "").toLowerCase());
  }

  function projectProgress(project) {
    if (project.status === "complete") return 100;
    if (!Array.isArray(project.steps) || !project.steps.length) return 0;
    return Math.round((project.steps.filter((step) => step.done).length / project.steps.length) * 100);
  }

  function projectAtRisk(project) {
    if (project.status === "complete") return false;
    if (project.status === "blocked") return true;
    return Boolean(project.deadline && isPast(project.deadline));
  }

  function loadData() {
    return {
      gigs: readArray(keys.gigs),
      sessions: readArray(keys.sessions),
      finance: readArray(keys.finance),
      projects: readArray(keys.projects),
      todos: readArray(keys.todos),
      opportunities: readArray(keys.opportunities),
      contacts: readArray(keys.contacts)
    };
  }

  function buildRecords(data) {
    return [
      ...data.gigs.map((item) => ({
        area: "Gigs",
        title: item.title || "Untitled gig",
        detail: [item.venue, item.location, dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "index.html",
        date: item.date,
        weight: gigStatus(item) === "booked" ? 2 : 1
      })),
      ...data.sessions.map((item) => ({
        area: "Sessions",
        title: item.title || "Untitled session",
        detail: [item.type, item.location, dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "sessions.html",
        date: item.date,
        weight: sessionStatus(item) === "booked" ? 2 : 1
      })),
      ...data.projects.map((item) => ({
        area: "Projects",
        title: item.title || "Untitled project",
        detail: `${item.status || "active"} · ${projectProgress(item)}% complete · ${dateLabel(item.deadline)}`,
        href: "projects.html",
        date: item.deadline,
        weight: projectAtRisk(item) ? 3 : 1
      })),
      ...data.todos.map((item) => ({
        area: "To Do",
        title: item.title || "Untitled task",
        detail: [item.priority, item.dueDate ? `Due ${dateLabel(item.dueDate)}` : ""].filter(Boolean).join(" · "),
        href: "todos.html",
        date: item.dueDate,
        weight: item.done ? 0 : 2
      })),
      ...data.opportunities.map((item) => ({
        area: "Opportunities",
        title: item.title || "Untitled opportunity",
        detail: [item.contact, item.status, item.followUpDate ? `Follow up ${dateLabel(item.followUpDate)}` : ""].filter(Boolean).join(" · "),
        href: "opportunities.html",
        date: item.followUpDate,
        weight: isClosedOpportunity(item) ? 0 : 2
      })),
      ...data.contacts.map((item) => ({
        area: "Contacts",
        title: item.name || "Unnamed contact",
        detail: [item.category, item.email, item.phone].filter(Boolean).join(" · "),
        href: "contacts.html",
        date: "",
        weight: 1
      })),
      ...data.finance.map((item) => ({
        area: "Finance",
        title: item.description || item.category || "Finance activity",
        detail: [item.type, money(item.amount), dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "finance.html",
        date: item.invoiceDueDate || item.date,
        weight: item.type === "revenue" && item.invoiceStatus === "pending" ? 3 : 1
      }))
    ].sort((a, b) => b.weight - a.weight || (dateValue(a.date)?.getTime() || Infinity) - (dateValue(b.date)?.getTime() || Infinity));
  }

  function buildBriefing(data) {
    const futureGigs = data.gigs
      .filter((gig) => gig.date && gigStatus(gig) === "booked")
      .sort((a, b) => dateValue(a.date) - dateValue(b.date));
    const futureSessions = data.sessions
      .filter((session) => session.date && sessionStatus(session) === "booked")
      .sort((a, b) => dateValue(a.date) - dateValue(b.date));
    const openTodos = data.todos.filter((item) => !item.done);
    const dueTodos = openTodos.filter((item) => item.dueDate && daysUntil(item.dueDate) <= 0);
    const followUps = data.opportunities.filter((item) =>
      !isClosedOpportunity(item) && item.followUpDate && daysUntil(item.followUpDate) <= 7
    );
    const pendingInvoices = data.finance.filter((item) => item.type === "revenue" && item.invoiceStatus === "pending");
    const invoiceTotal = pendingInvoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const atRiskProjects = data.projects.filter(projectAtRisk);
    const activeProjects = data.projects.filter((item) => item.status !== "complete");

    const next = [
      futureGigs[0] ? { type: "Gig", title: futureGigs[0].title || "Next gig", meta: dateLabel(futureGigs[0].date), href: "index.html" } : null,
      futureSessions[0] ? { type: "Session", title: futureSessions[0].title || "Next session", meta: dateLabel(futureSessions[0].date), href: "sessions.html" } : null,
      followUps[0] ? { type: "Follow-up", title: followUps[0].title || "Opportunity follow-up", meta: dateLabel(followUps[0].followUpDate), href: "opportunities.html" } : null
    ].filter(Boolean);

    const risks = [
      ...dueTodos.slice(0, 2).map((item) => ({ label: "Task due", title: item.title || "Untitled task", href: "todos.html" })),
      ...atRiskProjects.slice(0, 2).map((item) => ({ label: "Project attention", title: item.title || "Untitled project", href: "projects.html" })),
      ...(pendingInvoices.length ? [{ label: "Invoices pending", title: `${pendingInvoices.length} invoices · ${money(invoiceTotal)}`, href: "finance.html" }] : []),
      ...followUps.slice(0, 2).map((item) => ({ label: "Opportunity follow-up", title: item.title || "Untitled opportunity", href: "opportunities.html" }))
    ].slice(0, 5);

    return {
      futureGigs,
      futureSessions,
      openTodos,
      followUps,
      pendingInvoices,
      invoiceTotal,
      atRiskProjects,
      activeProjects,
      next,
      risks
    };
  }

  function currentPage() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function renderCommandCenter(data, briefing) {
    const shell = document.querySelector(".shell");
    if (!shell || document.querySelector(".command-centre")) return;

    const section = document.createElement("section");
    section.className = "command-centre";
    section.setAttribute("aria-label", "Dashboard command centre");
    section.innerHTML = `
      <div class="command-centre-head">
        <div>
          <p class="eyebrow">Command centre</p>
          <h2>${safeText(pageLabels[currentPage()] || "Dashboard")} intelligence</h2>
          <p>Search the whole operation, jump to priority work and keep an eye on today’s pressure points.</p>
        </div>
        <div class="command-actions">
          <button class="ghost-button" type="button" data-command-open>Search all</button>
          <button class="ghost-button" type="button" data-command-export>Export backup</button>
        </div>
      </div>
      <div class="command-grid">
        <article>
          <span>${briefing.futureGigs.length}</span>
          <p>Upcoming gigs</p>
        </article>
        <article>
          <span>${briefing.openTodos.length}</span>
          <p>Open tasks</p>
        </article>
        <article>
          <span>${briefing.followUps.length}</span>
          <p>Follow-ups due</p>
        </article>
        <article>
          <span>${money(briefing.invoiceTotal)}</span>
          <p>Pending revenue</p>
        </article>
      </div>
      <div class="command-split">
        <div class="command-panel">
          <div class="command-panel-title">
            <h3>Next moves</h3>
            <span>${briefing.next.length || "Clear"}</span>
          </div>
          <div class="command-list">
            ${briefing.next.length ? briefing.next.map((item) => `
              <a href="${item.href}">
                <small>${safeText(item.type)}</small>
                <strong>${safeText(item.title)}</strong>
                <span>${safeText(item.meta)}</span>
              </a>
            `).join("") : `<p class="command-empty">No dated activity is demanding attention right now.</p>`}
          </div>
        </div>
        <div class="command-panel">
          <div class="command-panel-title">
            <h3>Needs attention</h3>
            <span>${briefing.risks.length || "Calm"}</span>
          </div>
          <div class="command-list">
            ${briefing.risks.length ? briefing.risks.map((item) => `
              <a href="${item.href}">
                <small>${safeText(item.label)}</small>
                <strong>${safeText(item.title)}</strong>
                <span>Open ${safeText(pageLabels[item.href] || item.href)}</span>
              </a>
            `).join("") : `<p class="command-empty">No overdue tasks, project risks or pending follow-ups found.</p>`}
          </div>
        </div>
      </div>
    `;

    const firstGrid = shell.querySelector(".summary-grid");
    if (firstGrid) firstGrid.after(section);
    else shell.insertBefore(section, shell.firstElementChild?.nextSibling || shell.firstChild);
  }

  function createSearchDialog(records) {
    if (document.querySelector(".command-dialog")) return;
    const dialog = document.createElement("div");
    dialog.className = "command-dialog";
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="command-dialog-backdrop" data-command-close></div>
      <section class="command-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="commandDialogTitle">
        <div class="command-search-head">
          <div>
            <p class="eyebrow">Global search</p>
            <h2 id="commandDialogTitle">Find anything</h2>
          </div>
          <button class="small-button" type="button" data-command-close>Close</button>
        </div>
        <input id="commandSearchInput" placeholder="Search gigs, projects, tasks, contacts, finance..." autocomplete="off">
        <div class="command-results" id="commandResults"></div>
      </section>
    `;
    document.body.append(dialog);

    const input = dialog.querySelector("#commandSearchInput");
    const results = dialog.querySelector("#commandResults");

    function render(query = "") {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matches = records
        .filter((record) => {
          if (!terms.length) return record.weight > 1;
          const haystack = `${record.area} ${record.title} ${record.detail}`.toLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 12);
      results.innerHTML = matches.length
        ? matches.map((record) => `
            <a href="${record.href}">
              <small>${safeText(record.area)}</small>
              <strong>${safeText(record.title)}</strong>
              <span>${safeText(record.detail || "Open record")}</span>
            </a>
          `).join("")
        : `<p class="command-empty">No matches yet. Try a venue, contact, project or follow-up.</p>`;
    }

    function open() {
      dialog.hidden = false;
      document.body.classList.add("command-dialog-open");
      render(input.value);
      requestAnimationFrame(() => input.focus());
    }

    function close() {
      dialog.hidden = true;
      document.body.classList.remove("command-dialog-open");
    }

    input.addEventListener("input", () => render(input.value));
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-command-close]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
      if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
        event.preventDefault();
        open();
      }
      if (event.key === "Escape" && !dialog.hidden) close();
    });
    document.querySelectorAll("[data-command-open]").forEach((button) => button.addEventListener("click", open));
  }

  function exportBackup(data) {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "ella-crow-design-overhaul",
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ella-crow-backup-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function wireExport(data) {
    document.querySelectorAll("[data-command-export]").forEach((button) => {
      button.addEventListener("click", () => exportBackup(data));
    });
  }

  function setup() {
    const data = loadData();
    const records = buildRecords(data);
    const briefing = buildBriefing(data);
    renderCommandCenter(data, briefing);
    createSearchDialog(records);
    wireExport(data);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
