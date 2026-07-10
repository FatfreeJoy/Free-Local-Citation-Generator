"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const citation = require("../citation-core.js");
const workspace = require("../workspace-core.js");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const bib = read("samples/example.bib");
const ris = read("samples/example.ris");
const appSource = read("app.js");
const styleSource = read("styles.css");
const htmlSource = read("index.html");
const publicReadme = read("README.md");

test("detects BibTeX and RIS by content", () => {
  assert.equal(citation.detectFormat(bib), "bibtex");
  assert.equal(citation.detectFormat(ris), "ris");
});

test("parses bundled BibTeX and RIS samples", () => {
  assert.ok(citation.parseInput(bib).length >= 1);
  assert.ok(citation.parseInput(ris).length >= 1);
});

test("formats an APA 7 journal article", () => {
  const record = {
    type: "article",
    authors: [{ family: "Smith", given: "John" }],
    year: "2024",
    title: "THE EFFECTS OF AI ON Learning",
    containerTitle: "Journal of Test",
    volume: "12",
    issue: "3",
    pages: "12-20",
    doi: "10.1234/abc"
  };
  const result = citation.formatRecords([record], "apa7")[0];
  assert.equal(result.text, "Smith, J. (2024). The effects of AI on learning. Journal of Test, 12(3), 12–20. https://doi.org/10.1234/abc");
  assert.equal(citation.formatInText(record, "apa7", "parenthetical", "5"), "(Smith, 2024, p. 5)");
});

test("formats the UNSW Harvard variant separately", () => {
  const record = {
    type: "book",
    authors: [{ family: "Smith", given: "John" }],
    year: "2020",
    title: "A great BOOK",
    edition: "2",
    publisher: "Test Press",
    place: "Sydney"
  };
  const result = citation.formatRecords([record], "harvard")[0];
  assert.equal(result.text, "Smith, J 2020, A great book, 2nd edn, Test Press, Sydney.");
  assert.equal(citation.formatInText(record, "harvard", "parenthetical", "12-14"), "(Smith 2020, pp. 12-14)");
});

test("assigns same-author same-year suffixes in title order", () => {
  const records = [
    { type: "book", authors: [{ family: "Lee", given: "A" }], year: "2022", title: "Zebra", publisher: "P" },
    { type: "book", authors: [{ family: "Lee", given: "A" }], year: "2022", title: "Alpha", publisher: "P" }
  ];
  const result = citation.formatRecords(records, "apa7");
  assert.match(result[0].text, /\(2022a\)/);
  assert.match(result[1].text, /\(2022b\)/);
});

test("normalizes an incomplete workspace into the current schema", () => {
  const normalized = workspace.normalizeWorkspace(
    { projects: [{ name: " Paper ", lists: [] }], obsoleteSetting: true },
    citation.styles,
    citation.normalizeRecord
  );
  assert.equal(normalized.projects.length, 1);
  assert.equal(normalized.projects[0].name, "Paper");
  assert.equal(normalized.projects[0].lists.length, 1);
  assert.ok(normalized.activeProjectId);
  assert.ok(normalized.projects[0].activeListId);
  assert.deepEqual(Object.keys(normalized).sort(), ["activeProjectId", "expandedProjectIds", "projects"]);
  assert.doesNotMatch(JSON.stringify(normalized), /obsoleteSetting/);
});

test("repairs duplicate IDs and removes unknown record properties", () => {
  const source = {
    projects: [{
      id: "project-1",
      name: "Paper",
      activeListId: "list-1",
      lists: [{
        id: "list-1",
        name: "References",
        style: "apa7",
        records: [
          { id: "ref-1", type: "book", title: "One", oldColorSetting: "linen" },
          { id: "ref-1", type: "book", title: "Two", oldColorSetting: "sage" }
        ]
      }]
    }],
    activeProjectId: "project-1",
    expandedProjectIds: ["project-1"]
  };
  const normalized = workspace.normalizeWorkspace(source, citation.styles, citation.normalizeRecord);
  const records = normalized.projects[0].lists[0].records;
  assert.equal(new Set(records.map((record) => record.id)).size, 2);
  assert.ok(records.every((record) => !("oldColorSetting" in record)));
});

test("moves and duplicates reference lists without losing records", () => {
  const first = workspace.createProject("First");
  const second = workspace.createProject("Second");
  first.lists[0].records.push(citation.normalizeRecord({ type: "book", title: "Example", year: "2024" }));
  const state = { projects: [first, second], activeProjectId: first.id, expandedProjectIds: [first.id] };
  const duplicate = workspace.duplicateListTo(state, first.id, first.lists[0].id, second.id, citation.normalizeRecord);
  assert.equal(duplicate.list.records.length, 1);
  assert.notEqual(duplicate.list.records[0].id, first.lists[0].records[0].id);
  const moved = workspace.moveListTo(state, second.id, duplicate.list.id, first.id, "", true);
  assert.equal(moved.destination.id, first.id);
  assert.ok(first.lists.some((list) => list.id === duplicate.list.id));
});

test("uses nine current high-visibility tags", () => {
  const tagIds = ["flame", "tangerine", "lemon", "acid-lime", "emerald", "aqua", "electric-blue", "ultraviolet", "hot-pink"];
  tagIds.forEach((id) => {
    assert.ok(appSource.includes(`["${id}"`));
    assert.ok(styleSource.includes(`data-tag-color="${id}"`));
  });
});

test("contains no legacy settings, migrations, or intro-state storage", () => {
  assert.match(appSource, /reference-studio\.workspace"/);
  assert.doesNotMatch(appSource, /workspace\.v\d|sessionStorage|INTRO_KEY|LEGACY|migrate/i);
  assert.doesNotMatch(appSource, /repairWorkspace/);
  assert.doesNotMatch(publicReadme, /migration|old settings|legacy/i);
});

test("opens the welcome screen by default and credits the creator", () => {
  assert.match(appSource, /openDialog\(welcomeDialog\);\s*\}\)\(\);\s*$/);
  assert.match(htmlSource, /Created by[\s\S]*FatfreeJoy/);
  assert.match(htmlSource, /<meta name="author" content="FatfreeJoy"/);
  assert.doesNotMatch(appSource, /sessionStorage|localStorage\.setItem\([^,]*intro/i);
});

test("removes redundant interface helper copy", () => {
  [
    "Choose a high-visibility label",
    "Saved with this reference on the current device",
    "Saved on this device",
    "Adds to the active list",
    "New references accumulate here",
    "Feedback is handled publicly"
  ].forEach((text) => assert.ok(!htmlSource.includes(text), `Unexpected helper copy: ${text}`));
});

test("keeps structured editing, undo, and cross-style metadata preservation", () => {
  assert.match(appSource, /EDITABLE_REFERENCE_TYPES/);
  assert.match(appSource, /startManualEdit/);
  assert.match(appSource, /Reference removed/);
  assert.match(appSource, /label: "Undo"/);
  assert.match(appSource, /place: \["book", "chapter"\]\.includes\(type\) \? value\("#place"\)/);
  assert.match(appSource, /accessed: \["article", "web"\]\.includes\(type\) \? value\("#accessed"\)/);
});

test("has unique HTML IDs and valid literal app selectors", () => {
  const ids = Array.from(htmlSource.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Duplicate HTML ID found");
  const idSet = new Set(ids);
  const selectedIds = Array.from(appSource.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g), (match) => match[1]);
  selectedIds.forEach((id) => assert.ok(idSet.has(id), `Missing HTML element #${id}`));
});

test("references only bundled application scripts and styles", () => {
  const localAssets = Array.from(htmlSource.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g), (match) => match[1]);
  localAssets.forEach((asset) => assert.ok(fs.existsSync(path.join(root, asset)), `Missing asset: ${asset}`));
  assert.deepEqual(localAssets.sort(), ["app.js", "citation-core.js", "styles.css", "workspace-core.js"].sort());
});

console.log(`\n${passed} smoke tests passed.`);
