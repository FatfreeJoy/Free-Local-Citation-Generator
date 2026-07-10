# Contributing and feedback

Feedback is welcome through the repository’s **Issues** tab.

## Report a bug

Include:

- What you were trying to do
- The exact steps that reproduce the problem
- What you expected and what happened instead
- Browser name and version
- Whether you opened `index.html` directly or used GitHub Pages
- A small, non-private BibTeX or RIS example when the problem concerns formatting

Do not post private research notes, unpublished source data, or personal information in a public issue.

## Suggest an improvement

Explain the user problem first, then describe the proposed change. Screenshots or a small example are useful.

## Code changes

Keep the application dependency-free and functional from a local `file://` page. Run:

```text
node tests/run-tests.js
```

Before submitting a change, also test importing, manual entry, structured-reference editing, copying, tag and note selection, undo after removal, project organization, backup export, and backup restore in a current browser.
