# Akropora startup site

A plain HTML/CSS one-page startup landing page designed for simple editing in VS Code and straightforward GitHub Pages deployment.

## Stack

- `index.html` for the page content
- `assets/css/styles.css` for all styling
- No build step and no framework
- Relative asset paths so the site works locally, on a GitHub Pages project URL, and later behind a custom domain

## Local development

Open the folder in VS Code and use the Live Server extension, or run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages deployment

Create a private GitHub repository, push this folder, then enable Pages from `Settings -> Pages`.

For the simplest setup:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

The project site will be available at:

```text
https://ben-williams-ai.github.io/akropora/
```

Because links and assets are relative, the same files should work locally, under the GitHub Pages repo subpath, and later with a custom domain.

## Template note

`html5up-alpha.zip` contains the HTML5 UP Alpha template. It is a static template with jQuery helpers, Sass sources, Font Awesome, and multiple demo pages. For this site, the cleaner approach is to use it as reference only and keep the implementation smaller.
