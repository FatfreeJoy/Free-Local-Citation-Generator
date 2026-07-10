(function () {
  "use strict";

  const core = window.CitationCore;
  const workspaceCore = window.WorkspaceCore;
  const { createList, createProject, defaultWorkspace } = workspaceCore;
  const STORAGE_KEY = "reference-studio.workspace.v2";
  const INTRO_KEY = "reference-studio.intro.seen";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const sourceData = $("#source-data");
  const formattedData = $("#formatted-data");
  const fileInput = $("#file-input");
  const formatStatus = $("#format-status");
  const importMessage = $("#import-message");
  const manualMessage = $("#manual-message");
  const pasteMessage = $("#paste-message");
  const citationList = $("#citation-list");
  const emptyState = $("#empty-state");
  const referenceCount = $("#reference-count");
  const copyAllButton = $("#copy-all-button");
  const clearListButton = $("#clear-list-button");
  const copyStatus = $("#copy-status");
  const toast = $("#toast");
  const projectTree = $("#project-tree");
  const styleSelect = $("#citation-style");
  const styleGuideLink = $("#style-guide-link");
  const welcomeDialog = $("#welcome-dialog");
  const organizeDialog = $("#organize-dialog");
  const nameDialog = $("#name-dialog");
  const confirmDialog = $("#confirm-dialog");

  let toastTimer;
  let nameAction = null;
  let confirmAction = null;
  let organizeTarget = null;
  let dragPayload = null;
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

  // Workspace state and current-snapshot persistence
  // The browser stores one current workspace snapshot. Saving replaces it;
  // the application does not retain a settings or workspace history.
  function loadWorkspace() {
    try {
      return workspaceCore.repairWorkspace(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"), core.styles);
    } catch (_) {
      return defaultWorkspace();
    }
  }

  const state = { workspace: loadWorkspace(), formatted: [] };

  function currentProject() {
    return workspaceCore.currentProject(state.workspace);
  }

  function currentList() {
    return workspaceCore.currentList(state.workspace);
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

  // Project tree and reference-list rendering
  function renderProjectTree() {
    projectTree.replaceChildren();
    state.workspace.projects.forEach((project) => {
      const active = project.id === state.workspace.activeProjectId;
      const expanded = state.workspace.expandedProjectIds.includes(project.id);
      const block = document.createElement("section");
      block.className = `project-block${active ? " is-active" : ""}${expanded ? " is-expanded" : ""}`;

      const row = document.createElement("div");
      row.className = "project-row";
      row.draggable = true;
      row.dataset.dragKind = "project";
      row.dataset.projectId = project.id;
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
      const projectGrip = document.createElement("span");
      projectGrip.className = "drag-grip";
      projectGrip.setAttribute("aria-hidden", "true");
      projectGrip.title = "Drag to reorder project";
      projectGrip.textContent = "⠿";
      row.append(toggleProject, projectGrip);

      if (expanded) {
        const tools = document.createElement("div");
        tools.className = "project-tools";
        const add = makeButton("New list", "mini-text-button", "create-list", { projectId: project.id });
        add.setAttribute("aria-label", `Create a list in ${project.name}`);
        const organize = makeButton("Organize", "mini-text-button", "organize-project", { projectId: project.id });
        organize.setAttribute("aria-label", `Organize ${project.name}`);
        tools.append(add, organize);
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
          listRow.draggable = true;
          listRow.dataset.dragKind = "list";
          listRow.dataset.projectId = project.id;
          listRow.dataset.listId = list.id;
          const isCurrent = active && list.id === project.activeListId;
          const button = makeButton("", `list-link${isCurrent ? " is-active" : ""}`, "select-list", { projectId: project.id, listId: list.id });
          const title = document.createElement("span");
          title.textContent = list.name;
          const total = document.createElement("small");
          total.textContent = String(list.records.length);
          button.append(title, total);
          const listGrip = document.createElement("span");
          listGrip.className = "drag-grip list-grip";
          listGrip.setAttribute("aria-hidden", "true");
          listGrip.title = "Drag to reorder or move list";
          listGrip.textContent = "⠿";
          const organizeList = makeButton("•••", "list-menu", "organize-list", { projectId: project.id, listId: list.id });
          organizeList.setAttribute("aria-label", `Organize ${list.name} in ${project.name}`);
          listRow.append(button, listGrip, organizeList);
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
      const inText = document.createElement("div");
      inText.className = "intext-tools";
      const parenthetical = core.formatInText(citation.record, list.style, "parenthetical", "");
      if (parenthetical) {
        const inTextHeader = document.createElement("div");
        inTextHeader.className = "intext-header";
        const inTextLabel = document.createElement("span");
        inTextLabel.className = "intext-label";
        inTextLabel.textContent = "In-text citation";
        const locator = document.createElement("input");
        locator.type = "text";
        locator.className = "locator-input";
        locator.dataset.index = String(index);
        locator.placeholder = "Optional page or locator";
        locator.setAttribute("aria-label", `Optional page or locator for reference ${index + 1}`);
        inTextHeader.append(inTextLabel, locator);
        const options = document.createElement("div");
        options.className = "intext-options";
        ["parenthetical", "narrative"].forEach((mode) => {
          const button = makeButton("", "intext-option", "copy-intext", { index: String(index), mode });
          const kind = document.createElement("span");
          kind.textContent = mode === "parenthetical" ? "Parenthetical" : "Narrative";
          const preview = document.createElement("strong");
          preview.textContent = core.formatInText(citation.record, list.style, mode, "");
          button.append(kind, preview);
          button.setAttribute("aria-label", `Copy ${mode} in-text citation for reference ${index + 1}`);
          options.appendChild(button);
        });
        inText.append(inTextHeader, options);
      } else {
        inText.classList.add("is-unavailable");
        inText.textContent = "In-text citation unavailable for pasted text without source metadata.";
      }
      const actions = document.createElement("div");
      actions.className = "citation-actions";
      const copy = makeButton("Copy", "citation-action", "copy-reference", { index: String(index) });
      copy.setAttribute("aria-label", `Copy reference ${index + 1}`);
      const remove = makeButton("Remove", "citation-action danger-link", "remove-reference", { recordId: citation.record.id });
      remove.setAttribute("aria-label", `Remove reference ${index + 1}`);
      actions.append(copy, remove);
      item.append(paragraph, inText, actions);
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
    const style = core.styles[list.style] || core.styles.apa7;
    renderProjectTree();
    $("#active-project-label").textContent = project.name;
    $("#active-list-name").textContent = list.name;
    styleSelect.value = list.style;
    styleGuideLink.href = style.guideUrl;
    styleGuideLink.textContent = list.style === "harvard" ? "UNSW Harvard guide ↗" : "Official APA Style guide ↗";
    styleGuideLink.setAttribute("aria-label", `Open the ${styleLabel(list.style)} guide in a new tab`);
    updateReferenceForm();
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
    if (record.formattedText) return `formatted:${String(record.formattedText).toLocaleLowerCase()}`;
    if (record.doi) return `doi:${String(record.doi).toLowerCase()}`;
    if (record.url) return `url:${String(record.url).toLowerCase()}`;
    const authors = (record.authors || []).map((author) => author.literal || `${author.family || ""},${author.given || ""}`).join("|");
    return [authors, record.year || "", record.title || "", record.containerTitle || ""].join("::").toLocaleLowerCase();
  }

  // Import and paste-entry pipelines
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

  function inferFormattedMetadata(entry) {
    const match = entry.match(/((?:18|19|20|21)\d{2}|n\.d\.)([a-z])?/i);
    if (!match) return { authors: [], year: "", yearSuffix: "" };
    const prefix = entry.slice(0, match.index).replace(/[\s(.]+$/g, "").trim();
    const authors = [];
    const pattern = /(?:^|[,&]\s*)([\p{L}][\p{L}\p{M}'’\- ]*),\s*(?=[\p{Lu}])/gu;
    let authorMatch;
    while ((authorMatch = pattern.exec(prefix))) authors.push({ family: authorMatch[1].trim() });
    if (!authors.length && prefix) authors.push({ literal: prefix.replace(/[,.]+$/g, "").trim() });
    return {
      authors,
      year: /^n\.d\.$/i.test(match[1]) ? "" : match[1],
      yearSuffix: match[2] || ""
    };
  }

  function addFormattedReferences() {
    setMessage(pasteMessage, "");
    const text = formattedData.value.trim();
    if (!text) {
      setMessage(pasteMessage, "Paste one or more completed references first.");
      formattedData.focus();
      return;
    }
    const records = text.split(/\n\s*\n+/).map((entry) => entry.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).map((entry) => {
      const inferred = inferFormattedMetadata(entry);
      return {
        source: "formatted",
        type: "formatted",
        title: entry,
        formattedText: entry,
        formattedStyle: currentList().style,
        authors: inferred.authors,
        year: inferred.year,
        yearSuffix: inferred.yearSuffix
      };
    });
    const result = appendRecords(records);
    const parts = [`${result.added} ${result.added === 1 ? "reference" : "references"} added`];
    if (result.duplicates) parts.push(`${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped`);
    const message = `${parts.join(" · ")}.`;
    setMessage(pasteMessage, result.duplicates ? message : "");
    showToast(message);
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
      if (file.size > 25 * 1024 * 1024) { errors.push(`${file.name}: larger than 25 MB`); continue; }
      try {
        const text = await readFileText(file);
        const detectedFormat = core.detectFormat(text);
        const explicitFormat = detectedFormat !== "unknown" ? detectedFormat : extension === "bib" ? "bibtex" : extension === "ris" ? "ris" : undefined;
        allRecords.push(...core.parseInput(text, explicitFormat));
      } catch (error) {
        errors.push(`${file.name}: ${error.message || "BibTeX or RIS content was not recognized"}`);
      }
    }
    const result = appendRecords(allRecords);
    formatStatus.textContent = `${files.length} ${files.length === 1 ? "file" : "files"} processed`;
    const summary = importSummary(result, files.length, errors);
    setMessage(importMessage, errors.length || result.duplicates ? `${summary}${errors.length ? ` ${errors.join(" ")}` : ""}` : "");
    showToast(summary);
  }

  function switchTab(tab) {
    ["import", "manual", "paste"].forEach((name) => {
      const active = name === tab;
      const button = $(`#${name}-tab`);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      $(`#${name}-panel`).hidden = !active;
    });
  }

  // Manual-entry form and person-name rows
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
    const style = currentList().style;
    $$('[data-types], [data-styles]').forEach((field) => {
      const typeMatches = !field.dataset.types || field.dataset.types.split(/\s+/).includes(type);
      const styleMatches = !field.dataset.styles || field.dataset.styles.split(/\s+/).includes(style);
      const visible = typeMatches && styleMatches;
      field.hidden = !visible;
      field.querySelectorAll("input, button, select, textarea").forEach((control) => { control.disabled = !visible; });
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

  // Workspace organization, transfer, duplication, and drag/drop
  function projectById(projectId) {
    return workspaceCore.projectById(state.workspace, projectId);
  }

  function listById(project, listId) {
    return workspaceCore.listById(project, listId);
  }

  function configureOrganizeDialog() {
    if (!organizeTarget) return;
    const project = projectById(organizeTarget.projectId);
    const list = organizeTarget.kind === "list" ? listById(project, organizeTarget.listId) : null;
    if (!project || (organizeTarget.kind === "list" && !list)) { closeDialog(organizeDialog); return; }
    $("#organize-title").textContent = organizeTarget.kind === "project" ? project.name : list.name;
    $("#organize-context").textContent = organizeTarget.kind === "project" ? "Project" : `Reference list in ${project.name}`;
    const collection = organizeTarget.kind === "project" ? state.workspace.projects : project.lists;
    const index = collection.findIndex((item) => item.id === (list ? list.id : project.id));
    $("#move-earlier-button").disabled = index <= 0;
    $("#move-later-button").disabled = index < 0 || index >= collection.length - 1;

    const transfer = $("#list-transfer-section");
    transfer.hidden = organizeTarget.kind !== "list";
    if (list) {
      const destinationSelect = $("#destination-project");
      const selected = destinationSelect.value || project.id;
      destinationSelect.replaceChildren();
      state.workspace.projects.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        destinationSelect.appendChild(option);
      });
      destinationSelect.value = state.workspace.projects.some((item) => item.id === selected) ? selected : project.id;
      $("#move-list-button").disabled = destinationSelect.value === project.id;
    }
  }

  function openOrganize(kind, project, list) {
    organizeTarget = { kind, projectId: project.id, listId: list ? list.id : "" };
    $("#destination-project").value = "";
    configureOrganizeDialog();
    openDialog(organizeDialog);
  }

  function shiftOrganizeTarget(delta) {
    if (!organizeTarget) return;
    const project = projectById(organizeTarget.projectId);
    const collection = organizeTarget.kind === "project" ? state.workspace.projects : project && project.lists;
    const targetId = organizeTarget.kind === "project" ? organizeTarget.projectId : organizeTarget.listId;
    if (!collection) return;
    if (!workspaceCore.shiftItem(collection, targetId, delta)) return;
    saveWorkspace();
    renderWorkspace();
    configureOrganizeDialog();
    showToast(organizeTarget.kind === "project" ? "Project moved" : "List moved");
  }

  function transferOrganizedList(copyOnly) {
    if (!organizeTarget || organizeTarget.kind !== "list") return;
    const destinationId = $("#destination-project").value;
    if (!copyOnly && organizeTarget.projectId === destinationId) return;
    const result = copyOnly
      ? workspaceCore.duplicateListTo(state.workspace, organizeTarget.projectId, organizeTarget.listId, destinationId, core.normalizeRecord)
      : workspaceCore.moveListTo(state.workspace, organizeTarget.projectId, organizeTarget.listId, destinationId, "", true);
    if (!result) return;
    const { destination } = result;
    if (!state.workspace.expandedProjectIds.includes(destination.id)) state.workspace.expandedProjectIds.push(destination.id);
    saveWorkspace();
    renderWorkspace();
    closeDialog(organizeDialog);
    showToast(copyOnly ? `List duplicated to ${destination.name}` : `List moved to ${destination.name}`);
  }

  function clearDragIndicators(clearDragging) {
    $$(".drop-before, .drop-after, .drop-into").forEach((element) => {
      element.classList.remove("drop-before", "drop-after", "drop-into");
    });
    if (clearDragging) $$(".is-dragging").forEach((element) => element.classList.remove("is-dragging"));
  }

  function reorderProjectFromDrop(projectId, targetProjectId, after) {
    if (!workspaceCore.reorderItem(state.workspace.projects, projectId, targetProjectId, after)) return;
    saveWorkspace();
    renderWorkspace();
    showToast("Project moved");
  }

  function moveListFromDrop(sourceProjectId, listId, targetProjectId, targetListId, after) {
    const result = workspaceCore.moveListTo(state.workspace, sourceProjectId, listId, targetProjectId, targetListId, after);
    if (!result) return;
    const { source, destination } = result;
    if (!state.workspace.expandedProjectIds.includes(destination.id)) state.workspace.expandedProjectIds.push(destination.id);
    saveWorkspace();
    renderWorkspace();
    showToast(source.id === destination.id ? "List reordered" : `List moved to ${destination.name}`);
  }

  // Dialog and clipboard utilities
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

  // Event wiring
  $("#import-tab").addEventListener("click", () => switchTab("import"));
  $("#manual-tab").addEventListener("click", () => switchTab("manual"));
  $("#paste-tab").addEventListener("click", () => switchTab("paste"));
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
  $("#add-formatted-button").addEventListener("click", addFormattedReferences);
  $("#clear-formatted-button").addEventListener("click", () => {
    formattedData.value = "";
    setMessage(pasteMessage, "");
    formattedData.focus();
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
      edition: values.edition, publisher: values.publisher, place: values.place,
      accessed: values.accessed,
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
    const project = projectById(button.dataset.projectId);
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
    } else if (button.dataset.action === "organize-project") {
      openOrganize("project", project, null);
    } else if (button.dataset.action === "organize-list") {
      const list = listById(project, button.dataset.listId);
      if (list) openOrganize("list", project, list);
    }
  });

  projectTree.addEventListener("dragstart", (event) => {
    const row = event.target.closest("[draggable='true'][data-drag-kind]");
    if (!row) return;
    dragPayload = {
      kind: row.dataset.dragKind,
      projectId: row.dataset.projectId,
      listId: row.dataset.listId || ""
    };
    row.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(dragPayload));
    }
  });

  projectTree.addEventListener("dragover", (event) => {
    if (!dragPayload) return;
    const listRow = event.target.closest(".list-row");
    const projectRow = event.target.closest(".project-row");
    const validTarget = dragPayload.kind === "project" ? projectRow : (listRow || projectRow);
    if (!validTarget) return;
    event.preventDefault();
    clearDragIndicators(false);
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (dragPayload.kind === "list" && !listRow) {
      projectRow.classList.add("drop-into");
      return;
    }
    const rectangle = validTarget.getBoundingClientRect();
    const after = event.clientY > rectangle.top + rectangle.height / 2;
    validTarget.classList.add(after ? "drop-after" : "drop-before");
  });

  projectTree.addEventListener("drop", (event) => {
    if (!dragPayload) return;
    event.preventDefault();
    const listRow = event.target.closest(".list-row");
    const projectRow = event.target.closest(".project-row");
    if (dragPayload.kind === "project" && projectRow) {
      const rectangle = projectRow.getBoundingClientRect();
      reorderProjectFromDrop(dragPayload.projectId, projectRow.dataset.projectId, event.clientY > rectangle.top + rectangle.height / 2);
    } else if (dragPayload.kind === "list" && (listRow || projectRow)) {
      const targetProjectId = (listRow || projectRow).dataset.projectId;
      let after = true;
      if (listRow) {
        const rectangle = listRow.getBoundingClientRect();
        after = event.clientY > rectangle.top + rectangle.height / 2;
      }
      moveListFromDrop(dragPayload.projectId, dragPayload.listId, targetProjectId, listRow ? listRow.dataset.listId : "", after);
    }
    dragPayload = null;
    clearDragIndicators(true);
  });

  projectTree.addEventListener("dragend", () => {
    dragPayload = null;
    clearDragIndicators(true);
  });

  $("#organize-close-button").addEventListener("click", () => closeDialog(organizeDialog));
  $("#move-earlier-button").addEventListener("click", () => shiftOrganizeTarget(-1));
  $("#move-later-button").addEventListener("click", () => shiftOrganizeTarget(1));
  $("#destination-project").addEventListener("change", () => {
    if (!organizeTarget) return;
    $("#move-list-button").disabled = $("#destination-project").value === organizeTarget.projectId;
  });
  $("#move-list-button").addEventListener("click", () => transferOrganizedList(false));
  $("#duplicate-list-button").addEventListener("click", () => transferOrganizedList(true));
  $("#organize-rename-button").addEventListener("click", () => {
    if (!organizeTarget) return;
    const project = projectById(organizeTarget.projectId);
    const list = organizeTarget.kind === "list" ? listById(project, organizeTarget.listId) : null;
    closeDialog(organizeDialog);
    openNameEditor(organizeTarget.kind === "project" ? "rename-project" : "rename-list", project, list);
  });
  $("#organize-delete-button").addEventListener("click", () => {
    if (!organizeTarget) return;
    const project = projectById(organizeTarget.projectId);
    const list = organizeTarget.kind === "list" ? listById(project, organizeTarget.listId) : null;
    closeDialog(organizeDialog);
    askConfirmation(organizeTarget.kind === "project" ? "delete-project" : "delete-list", project, list);
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

  citationList.addEventListener("input", (event) => {
    const locator = event.target.closest(".locator-input");
    if (!locator) return;
    const citation = state.formatted[Number(locator.dataset.index)];
    if (!citation) return;
    locator.closest(".intext-tools").querySelectorAll(".intext-option").forEach((button) => {
      button.querySelector("strong").textContent = core.formatInText(citation.record, currentList().style, button.dataset.mode, locator.value);
    });
  });

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
    if (button.dataset.action === "copy-intext") {
      const citation = state.formatted[Number(button.dataset.index)];
      if (!citation) return;
      const locator = button.closest(".intext-tools").querySelector(".locator-input");
      const inText = core.formatInText(citation.record, currentList().style, button.dataset.mode, locator ? locator.value : "");
      try {
        await copyCitation(inText);
        copyStatus.textContent = `${button.dataset.mode === "narrative" ? "Narrative" : "Parenthetical"} in-text citation copied.`;
        showToast("In-text citation copied");
      } catch (error) { showToast(error.message); }
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
