# IMRC website (Site 1) — working prototype

Static, dependency-free site in English (`/`), Korean (`/ko/`) and Japanese (`/ja/`).

```
site/    the website (HTML, css/, js/, assets/)
tools/   generator: edit text in tools/pages_main.py (EN/KO/JA side by side) or tools/pages_en.py, then run
         python3 tools/build.py
```

Preview locally: `cd site && python3 -m http.server 4173` → http://localhost:4173/

- Add real sessions / articles in `site/js/data.js` (empty arrays keep the empty-state messages).
  Add `?demo=1` to a URL to preview how filled session cards look (sample data, labelled).
- Every yellow dashed `[ … ]` chip on the pages is something that needs your input (search the HTML for `class="todo"`).
- Image slots are marked "Photo needed: …".
- Forms are not connected to an email service yet (`data-endpoint` on each `<form>`); the page says so when submitted.
- Social icons in the footer and `/links/` use `#` until real profile URLs are added.
- Korean and Japanese text is a working draft and needs human translation review (the spec requires human translation).
