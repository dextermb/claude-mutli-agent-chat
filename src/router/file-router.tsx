import { lazy, Suspense, type ComponentType } from "react"
import { Route, Switch } from "wouter"

import { fileToRoutePath } from "@/router/file-routes"
import { NotFound } from "@/router/not-found"

const pageModules = import.meta.glob<{ default: ComponentType }>([
  "/src/pages/**/*.tsx",
  "!/src/pages/**/*.test.tsx",
])

const routes = Object.entries(pageModules).map(([file, load]) => ({
  path: fileToRoutePath(file.replace("/src/pages/", "")),
  Page: lazy(load),
}))

export function FileRouter() {
  return (
    <Suspense>
      <Switch>
        {routes.map(({ path, Page }) => (
          <Route key={path} path={path} component={Page} />
        ))}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  )
}
