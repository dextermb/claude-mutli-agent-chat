export type FolderList = {
  path: string
  parent: string | null
  folders: { name: string; path: string }[]
}
