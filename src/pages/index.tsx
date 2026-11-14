import { useState } from "react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function LandingPage() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Counter</CardTitle>
          <CardDescription>Use the buttons, or type a number.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="count">Count</FieldLabel>
            <ButtonGroup className="w-full">
              <Button
                variant="outline"
                size="icon"
                aria-label="Decrease"
                onClick={() => setCount((current) => current - 1)}
              >
                <MinusIcon />
              </Button>
              <Input
                id="count"
                type="number"
                className="text-center tabular-nums"
                value={count}
                onChange={(event) => {
                  const typed = event.currentTarget.valueAsNumber
                  setCount(Number.isNaN(typed) ? 0 : typed)
                }}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Increase"
                onClick={() => setCount((current) => current + 1)}
              >
                <PlusIcon />
              </Button>
            </ButtonGroup>
          </Field>
        </CardContent>
      </Card>
    </main>
  )
}
