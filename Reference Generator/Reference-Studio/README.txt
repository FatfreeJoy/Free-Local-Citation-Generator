REFERENCE STUDIO
================

Created by FatfreeJoy

QUICK START

1. Unzip this folder.
2. Double-click index.html.
3. Close the introduction window to enter the workspace.
4. Create projects and reference lists, then import sources or enter them manually.

No installation, terminal, account, build step, or web server is required.
Everything runs locally in the browser. Citation data is not uploaded.

WORKSPACE ORGANIZATION

- A project can contain multiple reference lists for essays, papers, chapters,
  publications, or any other purpose.
- Open several projects at once and create, rename, clear, or delete projects
  and lists directly in the left workspace hierarchy.
- Each list stores its own references and citation-style selection.
- Changes are saved automatically in the browser on the current device.
- Individual references can be copied or removed; an entire list can be copied
  with one click.

IMPORTING SOURCES

- Select or drag multiple .bib and .ris files at the same time.
- Add more files later; every successful import appends to the active list.
- Re-selecting the same file works normally.
- Duplicate DOI, URL, or metadata records are skipped within the active list.
- Paste BibTeX or RIS directly into Citation data when no file is available.
- Use Clear data to reset the import field without changing the reference list.

MANUAL ENTRY

- Add one author per line with separate First name and Last name fields.
- For an organization author, leave First name blank and enter the complete
  organization in Last name.
- The form changes by source type so irrelevant fields are removed.
- Manual entry supports journal articles, webpages, books, and book chapters.
- Book chapters include separate editor name rows.

CITATION STYLES

APA 7th edition is the included formatter. The style selector and formatting
registry are designed for additional adapters. MLA 9, Chicago 17, and Harvard
are visible as planned styles so the interface will not need to be redesigned
when those formatters are added.

The interface links to the official APA Style site at https://apastyle.apa.org/.
The APA templates were checked against its official journal article, webpage,
book/ebook, edited book chapter, DOI/URL, and missing-information guidance.

APA 7 BEHAVIOR

- Author names are initialized and the rule for more than 20 authors is used.
- References are alphabetized, with chronological and same-year a/b ordering.
- Titles use sentence case; BibTeX brace-protected capitalization is retained.
- Applicable journal names, volumes, standalone works, and containers are italicized.
- Page ranges use en dashes.
- DOI values are normalized to https://doi.org/ links and take precedence over URLs.
- Missing dates are rendered as n.d.
- Publisher locations are omitted, as required by APA 7.

FILES

index.html   — semantic workspace markup
styles.css   — responsive editorial interface and hanging-indent styling
apa-core.js  — parsing, normalization, style registry, and APA 7 formatter
app.js       — projects, lists, local saving, multi-file import, and interaction
samples/     — small BibTeX and RIS files for testing

BROWSER SUPPORT

Current versions of Chrome, Edge, Firefox, and Safari. Clipboard behavior from
file:// pages varies by browser; the app includes a one-click fallback.

ACCURACY NOTE

Citation metadata can be incomplete or semantically ambiguous. Review imported
proper nouns, source types, dates, and publication details against the original
source. This independent tool is not affiliated with the American Psychological Association.
