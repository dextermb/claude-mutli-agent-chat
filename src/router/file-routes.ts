export function fileToRoutePath(file: string): string {
  const segments = file
    .replace(/\.tsx$/, "")
    .split("/")
    .filter((segment) => segment !== "index")
    .map((segment) => segment.replace(/^\[(.+)\]$/, ":$1"))
  return `/${segments.join("/")}`
}
