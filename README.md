# Akropora Website

A simple one-page website for Akropora, built from the HTML5 UP Alpha static template so it is easy to edit in VS Code and publish with GitHub Pages.

Live site: https://ben-williams-ai.github.io/akropora/

Planned custom domain: https://akropora.com/

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
│   └── demos/              Preview images for demo cards.
├── splats/                 Fullscreen Gaussian splat demo pages, including local viewer trials.
├── videos/                 Standalone pages for video fallbacks.
├── docs/                   Notes and parked copy that may be reused later.
├── vendor/                 Unpacked copy of the original HTML5 UP Alpha template for reference.
├── CNAME                   Tells GitHub Pages to use akropora.com as the custom domain.
├── .nojekyll               Tells GitHub Pages to serve the files exactly as they are.
├── .gitignore              Tells Git which local files not to track.
├── html5up-alpha.zip       A downloaded template kept only as reference.
└── README.md               This guide.
```

## Tests

The site has Playwright smoke tests for desktop and mobile layouts.

First install the test runner:

```sh
npm install
```

Then run:

```sh
npm test
```

The tests start a local server automatically and check that key sections load, local links and media resolve, the desktop/mobile navigation behaves correctly, the mobile layout does not overflow sideways, and the reef splat/video fallback pages still work.

## Local Streamed-LOD Trial Viewer

There is now a hidden local-only trial viewer at:

```text
http://localhost:8000/splats/lod-trial-p20/
```

It loads a copied-in PlayCanvas streamed-LOD asset for the `p20` trial patch using:

- `lod-meta.json`
- chunk folders such as `0_0/`, `0_1/`, `1_0/`

This is different from a normal single-file `.sog`. A `.sog` is one bundled file, while streamed LOD uses `lod-meta.json` plus many nearby chunk files that are fetched on demand.

The current local trial keeps a small packaged asset inside the repo so we can test the viewer with the existing static server. For larger town-scale assets, GitHub Pages is unlikely to be the right long-term host, so the future online version will probably keep the viewer code and the large streamed files in different places.

## Editing Basics

- Edit `index.html` when you want to change the words, sections, links, or page structure.
- Edit `assets/css/main.css` when you want to change how the site looks.
- Put videos in `assets/videos/` so they are easy to find as the site grows.
- Use relative paths like `assets/css/main.css` so the site works both locally and on GitHub Pages under `/akropora/`.
- Do not add a framework unless the site becomes too complex for plain HTML and CSS.

## Publishing

When the local version looks good, commit and push the changes. GitHub Pages should update the live site shortly after the push.

## Custom Domain

This repo has a `CNAME` file for `akropora.com`. To finish the setup, add `akropora.com` as the custom domain in the repo's GitHub Pages settings, then point the domain's DNS records at GitHub Pages in Namecheap.

## TODOs

- add full screen option for vids
- Replace remaining placeholder demo links with live Gaussian splat and video demo URLs.
- check how it looks on mobile
