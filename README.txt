REFERENCE STUDIO
================

Created by FatfreeJoy
https://github.com/FatfreeJoy

QUICK START

1. Unzip this folder.
2. Double-click index.html.
3. Choose Start in the brief introduction window.
4. Create projects and reference lists, then import, paste, or manually enter
   sources.

No installation, terminal, account, build step, or web server is required.
Everything runs locally in the browser. Citation data is not uploaded.

WORKSPACE ORGANIZATION

- A project can contain multiple reference lists for essays, papers, chapters,
  publications, or any other purpose.
- Several projects can stay expanded at once.
- Left-click and hold a project or list row to drag it. Projects can be
  reordered; lists can be reordered or dropped directly into another project.
- Organize provides Move up/Move down controls as well as list duplication and
  precise project-to-project transfer.
- Create, rename, clear, or delete projects and lists from the left hierarchy.
- Each list stores its own references and citation-style selection.
- Changes are saved automatically in the browser on the current device.
- Individual references can be copied or removed; a whole list can be copied
  with one click.
- Each structured reference includes parenthetical and narrative in-text
  citations. Add an optional page, page range, paragraph, section, or other
  locator before copying.

THREE ENTRY METHODS

Import
- Select or drag multiple files at the same time.
- Files are inspected by content, so BibTeX or RIS stored in .txt or another
  text-file extension is accepted. Individual files may be up to 25 MB.
- Add more files later; every successful import appends to the active list.
- Re-selecting the same file works normally.
- Duplicate DOI, URL, formatted text, or metadata records are skipped within
  the active list.
- Paste BibTeX or RIS directly into Citation data when no file is available.
- Clear data resets the import field without changing the reference list.

Manual entry
- Manual entry supports journal articles, webpages, books, and book chapters.
- The visible fields change with reference type and citation style.
- Authors and book editors use separate First name and Last name fields, with
  expandable rows.
- For an organization author, leave First name blank and enter the complete
  organization in Last name.

Paste reference
- Paste one or more references that are already formatted.
- Separate multiple references with a blank line.
- These entries are stored and copied as plain text. Rich-text italics are not
  retained, and entries are not converted when the active list's citation style
  changes because their source metadata is not available.
- Author and year are inferred from common formatted-reference patterns when
  possible so an in-text citation can be offered. Imported or manually entered
  metadata remains more reliable.

CITATION STYLES

APA 7th edition
Official guide: https://apastyle.apa.org/

The APA formatter covers the four manual-entry source types and also handles
additional source types commonly found in BibTeX and RIS data. It initializes
author names, supports the more-than-20-author rule, alphabetizes references,
assigns same-year a/b suffixes, uses sentence case, adds applicable italics,
normalizes DOI links, uses n.d. for missing dates, and omits publisher
locations as required by APA 7.

Straight quotation marks found in imported, entered, or pasted citation text
are converted to typographic smart quotation marks. URLs remain unchanged.

Harvard — UNSW
Guide: https://www.unsw.edu.au/student/managing-your-studies/academic-skills-support/toolkit/referencing/harvard

The Harvard formatter follows the UNSW guide for journal articles, webpages,
books, and edited book chapters, including its author initials, title quoting
and italics, volume/issue/page labels, edition notation, publication place,
access dates, URLs, and DOI treatment. Harvard has no single universal
authority; confirm the variation required by your lecturer or institution.

FILES

REQUIREMENTS.md — consolidated product, design, and technical requirements
index.html   — semantic workspace markup
styles.css   — responsive editorial interface and hanging-indent styling
citation-core.js — parsing, normalization, style registry, and formatters
workspace-core.js — workspace creation, validation, ordering, and list transfer
app.js          — rendering, local saving, imports, forms, and interaction
samples/     — small BibTeX and RIS files for testing

BROWSER SUPPORT

Current versions of Chrome, Edge, Firefox, and Safari. Clipboard behavior from
file:// pages varies by browser; the app includes a one-click fallback.

ACCURACY NOTE

Citation metadata can be incomplete or semantically ambiguous. Review imported
proper nouns, source types, dates, and publication details against the original
source. This independent tool is not affiliated with the American Psychological
Association or UNSW Sydney.
