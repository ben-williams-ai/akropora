# Akropora Website

A simple one-page website for Akropora, built with plain HTML and CSS so it is easy to edit in VS Code and publish with GitHub Pages.

Live site: https://ben-williams-ai.github.io/akropora/

## How To View It Locally

From this folder, run:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Keep the terminal window open while you are working. After editing a file, refresh the browser to see the change.

To preveiw mobile view in Chrome:

1. Open `http://localhost:8000`
2. Right-click the page and choose `Inspect`
3. Click the phone/tablet icon in the developer tools
4. Pick a phone size such as `iPhone 12 Pro` or drag the page narrower

Build for both desktop and mobile as we go: keep text short, avoid layouts that only work at one screen size, use flexible sections, and check the page at both phone and desktop sizes after each meaningful design change.

## Project Map

```text
akropora/
├── index.html              The actual webpage content: headings, sections, links, and text.
├── assets/
│   └── css/
│       └── styles.css      The visual design: layout, colours, spacing, fonts, and mobile rules.
├── .nojekyll               Tells GitHub Pages to serve the files exactly as they are.
├── .gitignore              Tells Git which local files not to track.
├── html5up-alpha.zip       A downloaded template kept only as reference.
└── README.md               This guide.
```

## Editing Basics

- Edit `index.html` when you want to change the words, sections, links, or page structure.
- Edit `assets/css/styles.css` when you want to change how the site looks.
- Use relative paths like `assets/css/styles.css` so the site works both locally and on GitHub Pages under `/akropora/`.
- Do not add a framework unless the site becomes too complex for plain HTML and CSS.

## Publishing

When the local version looks good, commit and push the changes. GitHub Pages should update the live site shortly after the push.
