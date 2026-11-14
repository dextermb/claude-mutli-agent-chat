import { Link } from "wouter"

import { Button } from "@/components/ui/button"

export function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
        Go to the home page
      </Button>
    </main>
  )
}
