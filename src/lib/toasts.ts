import { toast } from "@/components/ui/toast"

export function toastDone(title: string) {
  toast.add({ title, type: "success" })
}

export function toastRefusal(title: string, reason: string) {
  toast.add({
    title,
    description: reason,
    type: "error",
    priority: "high",
    timeout: 0,
  })
}
