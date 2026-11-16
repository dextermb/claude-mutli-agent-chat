export const PATH_TYPE = "application/x-agent-path"

let dragged: string | null = null

export function startPathDrag(event: React.DragEvent, path: string) {
  event.dataTransfer.setData(PATH_TYPE, path)
  dragged = path
}

export function endPathDrag() {
  dragged = null
}

export function draggedPath(): string | null {
  return dragged
}
