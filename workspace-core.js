(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WorkspaceCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function uid(prefix) {
    const value = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
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

  function repairWorkspace(value, styles) {
    if (!value || !Array.isArray(value.projects) || !value.projects.length) return defaultWorkspace();
    value.projects = value.projects.filter(Boolean).map((project, projectIndex) => {
      project.id = project.id || uid("project");
      project.name = String(project.name || `Project ${projectIndex + 1}`);
      project.lists = Array.isArray(project.lists) ? project.lists.filter(Boolean) : [];
      if (!project.lists.length) project.lists.push(createList("References"));
      project.lists.forEach((list, listIndex) => {
        list.id = list.id || uid("list");
        list.name = String(list.name || `Reference list ${listIndex + 1}`);
        list.style = styles && styles[list.style] && styles[list.style].available ? list.style : "apa7";
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
    let candidate = `${base} copy`, number = 2;
    while (names.has(candidate.toLocaleLowerCase())) candidate = `${base} copy ${number++}`;
    return candidate;
  }

  function cloneList(list, destination, normalizeRecord) {
    return {
      id: uid("list"),
      name: uniqueListName(destination, list.name),
      style: list.style,
      records: list.records.map((record) => {
        const copy = Object.assign({}, record, { id: "" });
        return normalizeRecord ? normalizeRecord(copy) : Object.assign(copy, { id: uid("ref") });
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
    repairWorkspace,
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
