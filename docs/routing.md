# Routing

The app uses file-based routing on top of [wouter](https://github.com/molefrog/wouter).
Each `.tsx` file in `src/pages` is one page. The path of the file gives the URL.

## From a file to a URL

| File in `src/pages`  | URL           |
| -------------------- | ------------- |
| `index.tsx`          | `/`           |
| `about.tsx`          | `/about`      |
| `blog/index.tsx`     | `/blog`       |
| `users/[id].tsx`     | `/users/:id`  |

A file name in square brackets becomes a URL parameter. Read the parameter
in the page with `useParams()` from `wouter`.

## How it works

1. `src/router/file-router.tsx` finds the pages with `import.meta.glob`. The
   glob ignores `*.test.tsx` files.
2. `fileToRoutePath()` in `src/router/file-routes.ts` changes each file path
   to a URL pattern.
3. Each page loads with `React.lazy`, so Vite puts each page in its own chunk.
4. A `<Switch>` renders the first route that matches the URL. If no route
   matches, the `NotFound` page in `src/router/not-found.tsx` shows.

## Add a page

1. Make a file in `src/pages`, for example `src/pages/about.tsx`.
2. Give the file a default export: the page component.

No other step is necessary. The router finds the new file.

## Limits

- The router does not sort the routes. If a static route and a parameter
  route can match the same URL (`users/new.tsx` and `users/[id].tsx`), the
  first one that the glob finds wins.
- The router has no layouts, no catch-all routes, and no data loaders.
