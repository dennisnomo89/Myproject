# Documentation build scripts

These scripts generate everything in `docs/`. Edit a script, run it again, and the matching file is rebuilt.

| Script | Builds | Edit it to change |
|---|---|---|
| `diagrams.js` | `docs/diagrams/*.svg` and `*.png` | the architecture, use case, DFD and ERD diagrams |
| `screenshots.js` | `docs/screenshots/*.png` | which pages of the app are captured |
| `report.js` | `docs/GVMA_SMS_Project_Report.docx` | the report text, tables and figures |
| `deck.js` | `docs/GVMA_SMS_Presentation.pptx` | the slides and their speaker notes |
| `theme.js` | (used by `deck.js`) | nothing; the colours are set in `THEME` at the top of `deck.js` |
| `update-toc.ps1` | refreshes the report's table of contents, saves a PDF copy | nothing |

## Setup (once)

You need Node.js 20 or newer. In VS Code, open the `myproject` folder, then choose
**Terminal → Run Task… → Docs: install build tools**, or run:

```bash
cd docs/build
npm install
```

## Building

In VS Code press **Ctrl+Shift+B** to build the diagrams, report and presentation, or pick a single
task from **Terminal → Run Task…** (they all start with "Docs:"). From a terminal in `docs/build`:

```bash
npm run diagrams     # diagrams only
npm run report       # report, then refresh its table of contents and save a PDF (needs Microsoft Word)
npm run deck         # presentation only
npm run all          # diagrams, report and presentation
```

Build the diagrams before the report and presentation, because both include the diagram images.

### Screenshots

The screenshots are taken from the running app, so start it first (`npm run dev` in `server/` and in
`client/`), load the demo data (`npm run seed` in `server/`), then run `npm run screenshots`. They use Microsoft Edge; to use Chrome
instead, set `EDGE_PATH` to the path of `chrome.exe`.

## Tips

- Close the Word or PowerPoint file before rebuilding it, or the script cannot overwrite it.
- Changes typed into the .docx or .pptx by hand are lost on the next build. Either make the change in
  the script, or stop using the script for that file once you start editing it by hand.
- The report's text is in `report.js`, chapter by chapter; search for the heading you want to change.
