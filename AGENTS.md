# Codex Notes For Akropora

## Repo Context

This repo contains the Akropora startup website: a simple one-page static site based on the HTML5 UP Alpha template, intended to be easy to edit in VS Code and publish with GitHub Pages.

Keep the implementation deliberately small: static HTML, CSS, and the template's small JavaScript helpers unless there is a strong reason to add more.

## Working Guidelines

- Use British English in copy and documentation.
- Keep the site polished, minimal, and serious rather than template-like.
- We should follow best practice, backed by science, in how to attract our target audience and make the website accessible and useful to them - the ultime goal is to attract first customers.
- Make changes work well on both desktop and mobile.
- Prefer relative asset paths so the site works locally, at `https://ben-williams-ai.github.io/akropora/`, and later behind a custom domain.
- Update `README.md` when workflow, structure, deployment, or beginner-facing instructions change, but keep it concise.
- Add tests or checks as the project gains behaviour. For now, manually verify layout locally and in mobile browser tools after meaningful visual changes.
- Keep the HTML5 UP attribution unless the licensing position has been checked and intentionally changed.
- Avoid unnecessary dependencies, build tools, or framework complexity.

## File Map

- `index.html`: page content and structure.
- `assets/css/main.css`: template stylesheet, layout, and responsive rules.
- `assets/js/`: template JavaScript helpers.
- `assets/videos/`: website videos, such as hero demos and product clips.
- `images/`: images used by the page.
- `vendor/html5up-alpha/`: unpacked original template for reference.
- `.nojekyll`: tells GitHub Pages to serve files as-is.
- `README.md`: short guide for editing, previewing, and publishing the site.

## Local Streamed-LOD Notes

- There is now a hidden local streamed-LOD trial page at `splats/lod-trial-p20/`.
- This was added to prove that PlayCanvas can load a packaged streamed-LOD asset locally using the repo's existing static server, without adding a build step or extra runtime dependency.
- The packaged `p20` trial asset was copied into the repo on purpose. For this small test it is only about 26 MB, which keeps local testing simple and portable. We did not use a symlink because we want the route to behave like a normal hosted folder.
- The viewer loads `lod-meta.json` plus the nearby chunk folders using relative paths. That is deliberate: it matches how the eventual hosted version will need to fetch files over normal URLs.
- This local trial is only intended for a small development patch. It is not evidence that GitHub Pages is suitable for very large town-scale streamed-LOD assets.
- If this route is extended later, prefer keeping it hidden from the homepage until the hosting and UX story are mature.
- To run the local trial, from the repo root use `python3 -m http.server 8000` and open `http://localhost:8000/splats/lod-trial-p20/`.
