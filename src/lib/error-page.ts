// Minimal, dependency-free HTML shown when SSR hits an unrecoverable error.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Something went wrong</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #0b0c0f;
        color: #e5e7eb;
        text-align: center;
        padding: 24px;
      }
      .card { max-width: 420px; }
      h1 { font-size: 20px; margin-bottom: 8px; }
      p { font-size: 14px; color: #9ca3af; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Something went wrong</h1>
      <p>Please refresh the page. If the problem persists, contact support.</p>
    </div>
  </body>
</html>`;
}
