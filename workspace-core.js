(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WorkspaceCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MAX_NAME_LENGTH = 80;

  function uid(prefix) {
    const value = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${value}`;
  }

  function cleanName(value, fallback) {
    return String(value || "").trim().slice(0, MAX_NAME_LENGTH) || fallback;
  }

  function uniqueId(prefix, preferred, used) {
    let id = String(preferred || "").trim();
    if (!id || used.has(id)) id = uid(prefix);
    used.add(id);
    return id;
  }

  function createList(name) {
    return { id: uid("list"), name: cleanName(name, "References"), style: "apa7", records: [] };
  }

  function createProject(name) {
    const list = createList("References");
    return {
      id: uid("project"),
      name: cleanName(name, "My first project"),
      lists: [list],
      activeListId: list.id
    };
  }

  function defaultWorkspace() {
    const project = createProject("My first project");
    return {
      projects: [project],
      activeProjectId: project.id,
      expandedProjectIds: [project.id]
    };
  }

  /**
   * Rebuilds a workspace using only the current schema. Unknown properties,
   * obsolete settings, invalid IDs, and malformed entries are discarded.
   */
  function normalizeWorkspace(value, styles, normalizeRecord) {
    const sourceProjects = value && Array.isArray(value.projects)
      ? value.projects.filter((project) => project && typeof project === "object")
      : [];
    if (!sourceProjects.length) return defaultWorkspace();

    const projectIds = new Set();
    const sourceToProjectId = new Map();
    const projects = sourceProjects.map((sourceProject, projectIndex) => {
      const originalProjectId = String(sourceProject.id || "");
      const projectId = uniqueId("project", originalProjectId, projectIds);
      if (originalProjectId && !sourceToProjectId.has(originalProjectId)) sourceToProjectId.set(originalProjectId, projectId);

      const listIds = new Set();
      const sourceToListId = new Map();
      const validLists = Array.isArray(sourceProject.lists)
        ? sourceProject.lists.filter((list) => list && typeof list === "object")
        : [];
      const sourceLists = validLists.length ? validLists : [{ name: "References", records: [] }];

      const lists = sourceLists.map((sourceList, listIndex) => {
        const originalListId = String(sourceList.id || "");
        const listId = uniqueId("list", originalListId, listIds);
        if (originalListId && !sourceToListId.has(originalListId)) sourceToListId.set(originalListId, listId);

        const recordIds = new Set();
        const records = (Array.isArray(sourceList.records) ? sourceList.records : [])
          .filter((record) => record && typeof record === "object")
          .map((record) => normalizeRecord ? normalizeRecord(record) : Object.assign({}, record))
          .filter(Boolean)
          .map((record) => Object.assign({}, record, {
            id: uniqueId("ref", record.id, recordIds)
          }));

        return {
          id: listId,
          name: cleanName(sourceList.name, `Reference list ${listIndex + 1}`),
          style: styles && styles[sourceList.style] && styles[sourceList.style].available ? sourceList.style : "apa7",
          records
        };
      });

      const activeListId = sourceToListId.get(String(sourceProject.activeListId || "")) || lists[0].id;
      return {
        id: projectId,
        name: cleanName(sourceProject.name, `Project ${projectIndex + 1}`),
        lists,
        activeListId
      };
    });

    const activeProjectId = sourceToProjectId.get(String(value.activeProjectId || "")) || projects[0].id;
    const requestedExpanded = Array.isArray(value.expandedProjectIds) ? value.expandedProjectIds : [];
    const expandedProjectIds = Array.from(new Set(requestedExpanded
      .map((id) => sourceToProjectId.get(String(id)))
      .filter(Boolean)));
    if (!expandedProjectIds.length) expandedProjectIds.push(activeProjectId);

    return { projects, activeProjectId, expandedProjectIds };
  }

  function projectById(workspace, projectId) {
    return workspace.projects.find((project) => project.id === projectId);
  }

  function listById(project, listId) {
    return project && project.lists.find((list) => list.id === listId);
  }

  function currentProject(workspace) {
    return projectById(workspace, workspace.activeProjectId) || workspace.projects[0];
  }

  function currentList(workspace) {
    const project = currentProject(workspace);
    return listById(project, project.activeListId) || project.lists[0];
  }

  function shiftItem(collection, id, delta) {
    const index = collection.findIndex((item) => item.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= collection.length) return false;
    const [item] = collection.splice(index, 1);
    collection.splice(next, 0, item);
    return true;
  }

  function reorderItem(collection, id, targetId, after) {
    if (id === targetId) return false;
    const sourceIndex = collection.findIndex((item) => item.id === id);
    if (sourceIndex < 0) return false;
    const [item] = collection.splice(sourceIndex, 1);
    const targetIndex = collection.findIndex((candidate) => candidate.id === targetId);
    if (targetIndex < 0) {
      collection.splice(sourceIndex, 0, item);
      return false;
    }
    collection.splice(targetIndex + (after ? 1 : 0), 0, item);
    return true;
  }

  function uniqueListName(project, base) {
    const names = new Set(project.lists.map((list) => list.name.toLocaleLowerCase()));
    const stem = cleanName(base, "References").slice(0, MAX_NAME_LENGTH - 8).trim();
    let candidate = `${stem} copy`;
    let number = 2;
    while (names.has(candidate.toLocaleLowerCase())) {
      const suffix = ` copy ${number++}`;
      candidate = `${stem.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`;
    }
    return candidate;
  }

  function cloneList(list, destination, normalizeRecord) {
    return {
      id: uid("list"),
      name: uniqueListName(destination, list.name),
      style: list.style,
      records: list.records.map((record) => {
        const source = Object.assign({}, record, { id: "" });
        return normalizeRecord ? normalizeRecord(source) : Object.assign(source, { id: uid("ref") });
      })
    };
  }

  function activateList(workspace, project, list) {
    project.activeListId = list.id;
    workspace.activeProjectId = project.id;
  }

  function duplicateListTo(workspace, sourceProjectId, listId, destinationProjectId, normalizeRecord) {
    const source = projectById(workspace, sourceProjectId);
    const destination = projectById(workspace, destinationProjectId);
    const list = listById(source, listId);
    if (!source || !destination || !list) return null;
    const copy = cloneList(list, destination, normalizeRecord);
    destination.lists.push(copy);
    activateList(workspace, destination, copy);
    return { source, destination, list: copy };
  }

  function moveListTo(workspace, sourceProjectId, listId, destinationProjectId, targetListId, after) {
    const source = projectById(workspace, sourceProjectId);
    const destination = projectById(workspace, destinationProjectId);
    const list = listById(source, listId);
    if (!source || !destination || !list) return null;
    if (source.id === destination.id && list.id === targetListId) return null;

    source.lists.splice(source.lists.indexOf(list), 1);
    let insertAt = destination.lists.length;
    if (targetListId) {
      const targetIndex = destination.lists.findIndex((item) => item.id === targetListId);
      if (targetIndex >= 0) insertAt = targetIndex + (after ? 1 : 0);
    }
    destination.lists.splice(insertAt, 0, list);
    if (!source.lists.length) source.lists.push(createList("References"));
    if (source.activeListId === list.id) source.activeListId = source.lists[0].id;
    activateList(workspace, destination, list);
    return { source, destination, list };
  }

  return {
    createList,
    createProject,
    defaultWorkspace,
    normalizeWorkspace,
    projectById,
    listById,
    currentProject,
    currentList,
    shiftItem,
    reorderItem,
    duplicateListTo,
    moveListTo
  };
});
