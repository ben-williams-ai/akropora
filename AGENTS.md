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
