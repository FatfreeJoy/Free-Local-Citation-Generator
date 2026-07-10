(function () {
  "use strict";

  const core = window.CitationCore;
  const STORAGE_KEY = "reference-studio.workspace.v2";
  const INTRO_KEY = "reference-studio.intro.seen";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const sourceData = $("#source-data");
  const fileInput = $("#file-input");
  const formatStatus = $("#format-status");
  const importMessage = $("#import-message");
  const manualMessage = $("#manual-message");
  const citationList = $("#citation-list");
  const emptyState = $("#empty-state");
  const referenceCount = $("#reference-count");
  const copyAllButton = $("#copy-all-button");
  const clearListButton = $("#clear-list-button");
  const copyStatus = $("#copy-status");
  const toast = $("#toast");
  const projectTree = $("#project-tree");
  const styleSelect = $("#citation-style");
  const welcomeDialog = $("#welcome-dialog");
  const nameDialog = $("#name-dialog");
  const confirmDialog = $("#confirm-dialog");

  let toastTimer;
  let nameAction = null;
  let confirmAction = null;
  let authorSequence = 0;

  const exampleBib = `@article{nguyen2024,
  author  = {Nguyen, Mai T. and O'Connor, James P.},
  title   = {Designing for trust in digital research tools},
  journal = {Journal of Information Design},
  year    = {2024},
  volume  = {18},
  number  = {2},
  pages   = {114--129},
  doi     = {10.1234/jid.2024.0182}
}`;

  function uid(prefix) {
    const value = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${value}`;
  }

  function createList(name) {
    return { id: uid("list"), name: name || "References", style: "apa7", records: [] };
  }

  function createProject(name) {
    const list = createList("References");
    return { id: uid("project"), name: name || "My first project", lists: [list], activeListId: list.id };
  }

  function defaultWorkspace() {
    const project = createProject("My first project");
    return { projects: [project], activeProjectId: project.id, expandedProjectIds: [project.id] };
  }

  function repairWorkspace(value) {
    if (!value || !Array.isArray(value.projects) || !value.projects.length) return defaultWorkspace();
    value.projects = value.projects.filter(Boolean).map((project, projectIndex) => {
      project.id = project.id || uid("project");
      project.name = String(project.name || `Project ${projectIndex + 1}`);
      project.lists = Array.isArray(project.lists) ? project.lists.filter(Boolean) : [];
      if (!project.lists.length) project.lists.push(createList("References"));
      project.lists.forEach((list, listIndex) => {
        list.id = list.id || uid("list");
        list.name = String(list.name || `Reference list ${listIndex + 1}`);
        list.style = core.styles[list.style] && core.styles[list.style].available ? list.style : "apa7";
        list.records = Array.isArray(list.records) ? list.records : [];
      });
      if (!project.lists.some((list) => list.id === project.activeListId)) project.activeListId = project.lists[0].id;
      return project;
    });
    if (!value.projects.some((project) => project.id === value.activeProjectId)) value.activeProjectId = value.projects[0].id;
    value.expandedProjectIds = Array.isArray(value.expandedProjectIds)
      ? value.expandedProjectIds.filter((id) => value.projects.some((project) => project.id === id))
      : [value.activeProjectId];
    if (!value.expandedProjectIds.length) value.expandedProjectIds.push(value.activeProjectId);
    return value;
  }

  function loadWorkspace() {
    try {
      return repairWorkspace(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch (_) {
      return defaultWorkspace();
    }
  }

  const state = { workspace: loadWorkspace(), formatted: [] };

  function currentProject() {
    return state.workspace.projects.find((project) => project.id === state.workspace.activeProjectId) || state.workspace.projects[0];
  }

  function currentList() {
    const project = currentProject();
    return project.lists.find((list) => list.id === project.activeListId) || project.lists[0];
  }

  function saveWorkspace() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
      return true;
    } catch (_) {
      showToast("This browser could not save your workspace");
      return false;
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function setMessage(element, message) {
    element.textContent = message || "";
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function styleLabel(styleId) {
    return core.styles[styleId] ? core.styles[styleId].label : "APA 7th edition";
  }

  function makeButton(label, className, action, data) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.action = action;
    Object.keys(data || {}).forEach((key) => { button.dataset[key] = data[key]; });
    button.textContent = label;
    return button;
  }

  function renderProjectTree() {
    projectTree.replaceChildren();
    state.workspace.projects.forEach((project) => {
      const active = project.id === state.workspace.activeProjectId;
      const expanded = state.workspace.expandedProjectIds.includes(project.id);
      const block = document.createElement("section");
      block.className = `project-block${active ? " is-active" : ""}${expanded ? " is-expanded" : ""}`;

      const row = document.createElement("div");
      row.className = "project-row";
      const toggleProject = makeButton("", "project-name", "toggle-project", { projectId: project.id });
      toggleProject.setAttribute("aria-expanded", String(expanded));
      toggleProject.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${project.name}`);
      const chevron = document.createElement("span");
      chevron.className = "project-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = expanded ? "▾" : "▸";
      const projectTitle = document.createElement("span");
      projectTitle.textContent = project.name;
      toggleProject.append(chevron, projectTitle);
      row.appendChild(toggleProject);

      if (expanded) {
        const tools = document.createElement("div");
        tools.className = "project-tools";
        const add = makeButton("New list", "mini-text-button", "create-list", { projectId: project.id });
        add.setAttribute("aria-label", `Create a list in ${project.name}`);
        const rename = makeButton("Rename", "mini-text-button", "rename-project", { projectId: project.id });
        rename.setAttribute("aria-label", `Rename ${project.name}`);
        const remove = makeButton("Delete", "mini-text-button danger-link", "delete-project", { projectId: project.id });
        remove.setAttribute("aria-label", `Delete ${project.name}`);
        tools.append(add, rename, remove);
        block.append(row, tools);
      } else {
        block.appendChild(row);
      }

      if (expanded) {
        const lists = document.createElement("div");
        lists.className = "list-links";
        project.lists.forEach((list) => {
          const listRow = document.createElement("div");
          listRow.className = "list-row";
          const isCurrent = active && list.id === project.activeListId;
          const button = makeButton("", `list-link${isCurrent ? " is-active" : ""}`, "select-list", { projectId: project.id, listId: list.id });
          const title = document.createElement("span");
          title.textContent = list.name;
          const total = document.createElement("small");
          total.textContent = String(list.records.length);
          button.append(title, total);
          const removeList = makeButton("Delete", "list-delete danger-link", "delete-list", { projectId: project.id, listId: list.id });
          removeList.setAttribute("aria-label", `Delete ${list.name} from ${project.name}`);
          listRow.append(button, removeList);
          lists.appendChild(listRow);
        });
        block.appendChild(lists);
      }
      projectTree.appendChild(block);
    });
  }

  function renderCitations() {
    const list = currentList();
    try {
      state.formatted = core.formatRecords(list.records, list.style);
    } catch (error) {
      state.formatted = [];
      showToast(error.message);
    }
    citationList.replaceChildren();
    state.formatted.forEach((citation, index) => {
      const item = document.createElement("li");
      item.className = "citation-item";
      const paragraph = document.createElement("p");
      paragraph.className = "citation-text";
      paragraph.innerHTML = citation.html;
      const actions = document.createElement("div");
      actions.className = "citation-actions";
      const copy = makeButton("Copy", "citation-action", "copy-reference", { index: String(index) });
      copy.setAttribute("aria-label", `Copy reference ${index + 1}`);
      const remove = makeButton("Remove", "citation-action danger-link", "remove-reference", { recordId: citation.record.id });
      remove.setAttribute("aria-label", `Remove reference ${index + 1}`);
      actions.append(copy, remove);
      item.append(paragraph, actions);
      citationList.appendChild(item);
    });
    const total = state.formatted.length;
    referenceCount.textContent = `${total} ${total === 1 ? "entry" : "entries"}`;
    emptyState.hidden = total > 0;
    copyAllButton.disabled = total === 0;
    clearListButton.disabled = total === 0;
  }

  function renderWorkspace() {
    const project = currentProject();
    const list = currentList();
    renderProjectTree();
    $("#breadcrumb").textContent = `${project.name} / ${list.name}`;
    $("#active-project-label").textContent = project.name;
    $("#active-list-name").textContent = list.name;
    $("#active-style-label").textContent = `${styleLabel(list.style)} · Alphabetized`;
    styleSelect.value = list.style;
    renderCitations();
  }

  function updateFormatStatus() {
    const text = sourceData.value.trim();
    const format = core.detectFormat(text);
    if (!text) formatStatus.textContent = "Waiting for BibTeX or RIS";
    else if (format === "bibtex") formatStatus.textContent = "BibTeX detected";
    else if (format === "ris") formatStatus.textContent = "RIS detected";
    else formatStatus.textContent = "Format not recognized yet";
  }

  function recordFingerprint(record) {
    if (record.doi) return `doi:${String(record.doi).toLowerCase()}`;
    if (record.url) return `url:${String(record.url).toLowerCase()}`;
    const authors = (record.authors || []).map((author) => author.literal || `${author.family || ""},${author.given || ""}`).join("|");
    return [authors, record.year || "", record.title || "", record.containerTitle || ""].join("::").toLocaleLowerCase();
  }

  function appendRecords(records) {
    const list = currentList();
    const existing = new Set(list.records.map(recordFingerprint));
    let added = 0, duplicates = 0;
    records.forEach((record) => {
      const normalized = core.normalizeRecord(record);
      const fingerprint = recordFingerprint(normalized);
      if (existing.has(fingerprint)) { duplicates += 1; return; }
      existing.add(fingerprint);
      list.records.push(normalized);
      added += 1;
    });
    saveWorkspace();
    renderWorkspace();
    return { added, duplicates };
  }

  function importSummary(result, sourceCount, errors) {
    const parts = [];
    parts.push(`${result.added} ${result.added === 1 ? "reference" : "references"} added`);
    if (sourceCount > 1) parts.push(`from ${sourceCount} files`);
    if (result.duplicates) parts.push(`${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped`);
    if (errors.length) parts.push(`${errors.length} file${errors.length === 1 ? "" : "s"} could not be read`);
    return `${parts.join(" · ")}.`;
  }

  function parseSource() {
    setMessage(importMessage, "");
    const text = sourceData.value.trim();
    if (!text) {
      setMessage(importMessage, "Paste citation data or choose one or more files first.");
      sourceData.focus();
      return;
    }
    try {
      const records = core.parseInput(text);
      const result = appendRecords(records);
      const message = importSummary(result, 1, []);
      setMessage(importMessage, result.duplicates ? message : "");
      showToast(message);
    } catch (error) {
      setMessage(importMessage, error && error.message ? error.message : "That data could not be parsed.");
    }
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("The browser could not read the file."));
      reader.readAsText(file);
    });
  }

  async function readFiles(fileList) {
    setMessage(importMessage, "");
    const files = Array.from(fileList || []);
    fileInput.value = "";
    if (!files.length) return;
    const allRecords = [], errors = [];
    for (const file of files) {
      const extension = (file.name.split(".").pop() || "").toLowerCase();
      if (!["bib", "ris"].includes(extension)) { errors.push(`${file.name}: unsupported file type`); continue; }
      if (file.size > 5 * 1024 * 1024) { errors.push(`${file.name}: larger than 5 MB`); continue; }
      try {
        const text = await readFileText(file);
        allRecords.push(...core.parseInput(text, extension === "bib" ? "bibtex" : "ris"));
      } catch (error) {
        errors.push(`${file.name}: ${error.message || "could not be parsed"}`);
      }
    }
    const result = appendRecords(allRecords);
    formatStatus.textContent = `${files.length} ${files.length === 1 ? "file" : "files"} processed`;
    const summary = importSummary(result, files.length, errors);
    setMessage(importMessage, errors.length || result.duplicates ? `${summary}${errors.length ? ` ${errors.join(" ")}` : ""}` : "");
    showToast(summary);
  }

  function switchTab(tab) {
    const isImport = tab === "import";
    $("#import-tab").classList.toggle("is-active", isImport);
    $("#manual-tab").classList.toggle("is-active", !isImport);
    $("#import-tab").setAttribute("aria-selected", String(isImport));
    $("#manual-tab").setAttribute("aria-selected", String(!isImport));
    $("#import-tab").tabIndex = isImport ? 0 : -1;
    $("#manual-tab").tabIndex = isImport ? -1 : 0;
    $("#import-panel").hidden = !isImport;
    $("#manual-panel").hidden = isImport;
  }

  function syncNameRows(kind) {
    const rows = $$(`.name-row[data-kind="${kind}"]`);
    rows.forEach((row, index) => {
      const first = row.querySelector(".first-name-input");
      const last = row.querySelector(".last-name-input");
      const remove = row.querySelector(".remove-author-button");
      const role = kind === "author" ? "Author" : "Editor";
      first.setAttribute("aria-label", `${role} ${index + 1} first name`);
      last.setAttribute("aria-label", `${role} ${index + 1} last name`);
      remove.disabled = rows.length === 1;
      remove.setAttribute("aria-label", `Remove ${role.toLowerCase()} ${index + 1}`);
    });
  }

  function addNameRow(kind, value, shouldFocus) {
    authorSequence += 1;
    const row = document.createElement("div");
    row.className = "name-row";
    row.dataset.kind = kind;

    const firstField = document.createElement("div");
    firstField.className = "name-field";
    const firstLabel = document.createElement("label");
    firstLabel.textContent = "First name";
    const first = document.createElement("input");
    first.type = "text";
    first.className = "first-name-input";
    first.autocomplete = "off";
    first.id = `${kind}-first-${authorSequence}`;
    first.name = `${kind}First`;
    first.value = value && value.given ? value.given : "";
    first.placeholder = "Ada M.";
    firstLabel.htmlFor = first.id;
    firstField.append(firstLabel, first);

    const lastField = document.createElement("div");
    lastField.className = "name-field";
    const lastLabel = document.createElement("label");
    lastLabel.textContent = "Last name";
    const last = document.createElement("input");
    last.type = "text";
    last.className = "last-name-input";
    last.autocomplete = "off";
    last.id = `${kind}-last-${authorSequence}`;
    last.name = `${kind}Last`;
    last.value = value && (value.family || value.literal) ? (value.family || value.literal) : "";
    last.placeholder = "Miller";
    lastLabel.htmlFor = last.id;
    lastField.append(lastLabel, last);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-author-button";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      if ($$(`.name-row[data-kind="${kind}"]`).length === 1) return;
      row.remove();
      syncNameRows(kind);
    });
    row.append(firstField, lastField, remove);
    $(`#${kind}-rows`).appendChild(row);
    syncNameRows(kind);
    if (shouldFocus) first.focus();
  }

  function resetNameRows(kind) {
    $(`#${kind}-rows`).replaceChildren();
    addNameRow(kind, null, false);
  }

  function collectNames(kind) {
    return $$(`.name-row[data-kind="${kind}"]`).map((row) => {
      const given = row.querySelector(".first-name-input").value.trim();
      const family = row.querySelector(".last-name-input").value.trim();
      if (!given && !family) return null;
      if (!given) return { literal: family };
      if (!family) return { literal: given };
      return { given, family };
    }).filter(Boolean);
  }

  function updateReferenceForm() {
    const type = $("#reference-type").value;
    $$('[data-types]').forEach((field) => {
      const visible = field.dataset.types.split(/\s+/).includes(type);
      field.hidden = !visible;
      field.querySelectorAll("input, button").forEach((control) => { control.disabled = !visible; });
    });
    const configuration = {
      article: { title: "Article title", container: "Journal", placeholder: "Journal of Thoughtful Research" },
      web: { title: "Page title", container: "Website name", placeholder: "APA Style" },
      book: { title: "Book title", container: "", placeholder: "" },
      chapter: { title: "Chapter title", container: "Book title", placeholder: "The handbook of research" }
    }[type];
    $("#title-label").innerHTML = `${configuration.title} <span aria-hidden="true">*</span>`;
    $("#container-label").innerHTML = `${configuration.container} <span aria-hidden="true">*</span>`;
    $("#journal").placeholder = configuration.placeholder;
    $("#journal").required = type !== "book";
    $("#publisher").required = type === "book" || type === "chapter";
    syncNameRows("author");
    syncNameRows("editor");
  }

  function openNameEditor(action, project, list) {
    nameAction = { action, projectId: project && project.id, listId: list && list.id };
    const titles = {
      "create-project": "Create project",
      "rename-project": "Rename project",
      "create-list": "Create reference list",
      "rename-list": "Rename reference list"
    };
    $("#name-dialog-title").textContent = titles[action];
    $("#name-input").value = list ? list.name : (action === "rename-project" && project ? project.name : "");
    setMessage($("#name-message"), "");
    openDialog(nameDialog);
    window.setTimeout(() => $("#name-input").focus(), 0);
  }

  function askConfirmation(action, project, list) {
    confirmAction = { action, projectId: project && project.id, listId: list && list.id };
    let content;
    if (action === "delete-project") content = ["Delete this project?", `“${project.name}” and all of its reference lists will be removed.`];
    if (action === "delete-list") content = ["Delete this reference list?", `“${list.name}” and its references will be removed.`];
    if (action === "clear-list") content = ["Clear this reference list?", `All references in “${list.name}” will be removed.`];
    if (!content) return;
    $("#confirm-title").textContent = content[0];
    $("#confirm-message").textContent = content[1];
    openDialog(confirmDialog);
  }

  async function copyCitation(text, html) {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        if (html && window.ClipboardItem && navigator.clipboard.write) {
          const item = new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([`<p style="margin:0;padding-left:0.5in;text-indent:-0.5in">${html}</p>`], { type: "text/html" })
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(text);
        }
        copied = true;
      } catch (_) { copied = false; }
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
      textarea.remove();
    }
    if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
  }

  $("#import-tab").addEventListener("click", () => switchTab("import"));
  $("#manual-tab").addEventListener("click", () => switchTab("manual"));
  $$('[role="tab"]').forEach((tab, index, tabs) => {
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].click();
      tabs[next].focus();
    });
  });

  sourceData.addEventListener("input", updateFormatStatus);
  $("#parse-button").addEventListener("click", parseSource);
  $("#sample-button").addEventListener("click", () => {
    sourceData.value = exampleBib;
    updateFormatStatus();
    setMessage(importMessage, "");
    sourceData.focus();
  });
  $("#clear-data-button").addEventListener("click", () => {
    sourceData.value = "";
    fileInput.value = "";
    setMessage(importMessage, "");
    updateFormatStatus();
    sourceData.focus();
  });
  fileInput.addEventListener("change", (event) => readFiles(event.target.files));

  const dropZone = $("#drop-zone");
  ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  }));
  dropZone.addEventListener("drop", (event) => readFiles(event.dataTransfer.files));

  $("#add-author-button").addEventListener("click", () => addNameRow("author", null, true));
  $("#add-editor-button").addEventListener("click", () => addNameRow("editor", null, true));
  $("#reference-type").addEventListener("change", updateReferenceForm);
  $("#manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    setMessage(manualMessage, "");
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const authors = collectNames("author");
    const editors = collectNames("editor");
    const doiOrUrl = String(values.doiUrl || "").trim();
    const record = core.normalizeRecord({
      source: "manual", type: values.type, authors, editors,
      year: values.year, month: values.month, day: values.day,
      date: values.year, title: values.title, containerTitle: values.journal,
      volume: values.volume, issue: values.issue, pages: values.pages,
      edition: values.edition, publisher: values.publisher,
      doi: /^\s*(?:doi\s*:|https?:\/\/(?:dx\.)?doi\.org\/|10\.)/i.test(doiOrUrl) ? doiOrUrl : "",
      url: doiOrUrl
    });
    const result = appendRecords([record]);
    form.reset();
    resetNameRows("author");
    resetNameRows("editor");
    updateReferenceForm();
    showToast(result.duplicates ? "That reference is already in this list" : "Reference added");
  });

  styleSelect.addEventListener("change", () => {
    const list = currentList();
    if (!core.styles[styleSelect.value] || !core.styles[styleSelect.value].available) return;
    list.style = styleSelect.value;
    saveWorkspace();
    renderWorkspace();
  });

  projectTree.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const project = state.workspace.projects.find((item) => item.id === button.dataset.projectId);
    if (!project) return;
    if (button.dataset.action === "toggle-project") {
      const expanded = state.workspace.expandedProjectIds.includes(project.id);
      state.workspace.expandedProjectIds = expanded
        ? state.workspace.expandedProjectIds.filter((id) => id !== project.id)
        : state.workspace.expandedProjectIds.concat(project.id);
      saveWorkspace();
      renderWorkspace();
    } else if (button.dataset.action === "select-list") {
      state.workspace.activeProjectId = project.id;
      project.activeListId = button.dataset.listId;
      if (!state.workspace.expandedProjectIds.includes(project.id)) state.workspace.expandedProjectIds.push(project.id);
      saveWorkspace();
      renderWorkspace();
    } else if (button.dataset.action === "create-list") {
      openNameEditor("create-list", project, null);
    } else if (button.dataset.action === "rename-project") {
      openNameEditor("rename-project", project, null);
    } else if (button.dataset.action === "delete-project") {
      askConfirmation("delete-project", project, null);
    } else if (button.dataset.action === "delete-list") {
      const list = project.lists.find((item) => item.id === button.dataset.listId);
      if (list) askConfirmation("delete-list", project, list);
    }
  });

  $("#new-project-button").addEventListener("click", () => openNameEditor("create-project", null, null));
  $("#rename-list-button").addEventListener("click", () => openNameEditor("rename-list", currentProject(), currentList()));
  $("#delete-list-button").addEventListener("click", () => askConfirmation("delete-list", currentProject(), currentList()));
  clearListButton.addEventListener("click", () => askConfirmation("clear-list", currentProject(), currentList()));

  $("#name-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#name-input").value.trim();
    if (!name) { setMessage($("#name-message"), "Enter a name to continue."); return; }
    if (!nameAction) return;
    if (nameAction.action === "create-project") {
      const project = createProject(name);
      state.workspace.projects.push(project);
      state.workspace.activeProjectId = project.id;
      state.workspace.expandedProjectIds.push(project.id);
    } else {
      const project = state.workspace.projects.find((item) => item.id === nameAction.projectId);
      if (!project) return;
      if (nameAction.action === "rename-project") project.name = name;
      if (nameAction.action === "create-list") {
        const list = createList(name);
        project.lists.push(list);
        project.activeListId = list.id;
        state.workspace.activeProjectId = project.id;
        if (!state.workspace.expandedProjectIds.includes(project.id)) state.workspace.expandedProjectIds.push(project.id);
      }
      if (nameAction.action === "rename-list") {
        const list = project.lists.find((item) => item.id === nameAction.listId);
        if (list) list.name = name;
      }
    }
    saveWorkspace();
    renderWorkspace();
    closeDialog(nameDialog);
    showToast("Workspace updated");
  });
  $("#name-cancel-button").addEventListener("click", () => closeDialog(nameDialog));

  $("#confirm-button").addEventListener("click", () => {
    if (!confirmAction) return;
    const project = state.workspace.projects.find((item) => item.id === confirmAction.projectId);
    if (confirmAction.action === "delete-project" && project) {
      const deletingActive = state.workspace.activeProjectId === project.id;
      state.workspace.projects = state.workspace.projects.filter((item) => item.id !== project.id);
      state.workspace.expandedProjectIds = state.workspace.expandedProjectIds.filter((id) => id !== project.id);
      if (!state.workspace.projects.length) state.workspace = defaultWorkspace();
      else if (deletingActive) state.workspace.activeProjectId = state.workspace.projects[0].id;
    }
    if (confirmAction.action === "delete-list" && project) {
      const deletingActive = project.activeListId === confirmAction.listId;
      project.lists = project.lists.filter((item) => item.id !== confirmAction.listId);
      if (!project.lists.length) project.lists.push(createList("References"));
      if (deletingActive || !project.lists.some((item) => item.id === project.activeListId)) project.activeListId = project.lists[0].id;
    }
    if (confirmAction.action === "clear-list" && project) {
      const list = project.lists.find((item) => item.id === confirmAction.listId);
      if (list) list.records = [];
    }
    saveWorkspace();
    renderWorkspace();
    closeDialog(confirmDialog);
    showToast("Workspace updated");
  });
  $("#confirm-cancel-button").addEventListener("click", () => closeDialog(confirmDialog));

  citationList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "remove-reference") {
      const list = currentList();
      list.records = list.records.filter((record) => record.id !== button.dataset.recordId);
      saveWorkspace();
      renderWorkspace();
      showToast("Reference removed");
      return;
    }
    if (button.dataset.action !== "copy-reference") return;
    const citation = state.formatted[Number(button.dataset.index)];
    if (!citation) return;
    try {
      await copyCitation(citation.text, citation.html);
      button.textContent = "Copied";
      copyStatus.textContent = "Reference copied to clipboard.";
      showToast("Reference copied");
      window.setTimeout(() => { button.textContent = "Copy"; }, 1600);
    } catch (error) { showToast(error.message); }
  });

  copyAllButton.addEventListener("click", async () => {
    const text = state.formatted.map((item) => item.text).join("\n\n");
    const html = state.formatted.map((item) => `<p style="margin:0 0 1em;padding-left:0.5in;text-indent:-0.5in">${item.html}</p>`).join("");
    try {
      await copyCitation(text, html);
      copyStatus.textContent = "All references copied to clipboard.";
      showToast("All references copied");
    } catch (error) { showToast(error.message); }
  });

  $("#about-button").addEventListener("click", () => openDialog(welcomeDialog));
  $("#enter-button").addEventListener("click", () => {
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch (_) { /* session storage is optional */ }
    closeDialog(welcomeDialog);
  });
  $("#welcome-close-button").addEventListener("click", () => {
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch (_) { /* session storage is optional */ }
    closeDialog(welcomeDialog);
  });

  resetNameRows("author");
  resetNameRows("editor");
  updateReferenceForm();
  renderWorkspace();
  updateFormatStatus();
  try {
    if (!sessionStorage.getItem(INTRO_KEY)) openDialog(welcomeDialog);
  } catch (_) {
    openDialog(welcomeDialog);
  }
})();
