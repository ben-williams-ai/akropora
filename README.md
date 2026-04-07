# Akropora Website

A simple one-page website for Akropora, built from the HTML5 UP Alpha static template so it is easy to edit in VS Code and publish with GitHub Pages.

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

To preview mobile view in Chrome:

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
│       └── main.css        The main template stylesheet: layout, colours, spacing, and mobile rules.
│   └── videos/             Website videos, such as hero demos and product clips.
├── images/                 Images and logos used by the page.
├── docs/                   Notes and parked copy that may be reused later.
├── vendor/                 Unpacked copy of the original HTML5 UP Alpha template for reference.
├── .nojekyll               Tells GitHub Pages to serve the files exactly as they are.
├── .gitignore              Tells Git which local files not to track.
├── html5up-alpha.zip       A downloaded template kept only as reference.
└── README.md               This guide.
```

## Editing Basics

- Edit `index.html` when you want to change the words, sections, links, or page structure.
- Edit `assets/css/main.css` when you want to change how the site looks.
- Put videos in `assets/videos/` so they are easy to find as the site grows.
- Use relative paths like `assets/css/main.css` so the site works both locally and on GitHub Pages under `/akropora/`.
- Do not add a framework unless the site becomes too complex for plain HTML and CSS.

## Publishing

When the local version looks good, commit and push the changes. GitHub Pages should update the live site shortly after the push.

## TODOs

- Replace `hello@example.com` with the real public Akropora contact email.
- Replace placeholder demo links with live Gaussian splat and video demo URLs.
- Add the missing video for the `Inject human input` demo.
- Replace temporary demo card images with real preview images or posters.
- Verify the `$40bn+` environmental consulting market-size line before launch and replace it if a better source is found. Current working source: Research and Markets via Yahoo Finance estimated the market at `$38.4bn` in 2023 and `$65.1bn` by 2030: `https://uk.finance.yahoo.com/news/environmental-consulting-services-global-strategic-103400752.html`
- Keep the HTML5 UP attribution unless the template licence is changed or replaced. The current Alpha template is CC BY 3.0, which requires attribution.
