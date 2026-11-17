export type PageSection = { id: string; title: string; changed?: boolean }

export function OnThisPage({ sections }: { sections: PageSection[] }) {
  return (
    <nav
      aria-label="On this page"
      className="sticky top-5 hidden w-44 flex-none flex-col gap-0.5 pt-26 text-[13px] lg:flex"
    >
      <span className="px-2.5 pb-1.5 text-xs font-medium text-foreground-faint">
        On this page
      </span>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground-strong"
        >
          {section.title}
          {section.changed && (
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
          )}
        </a>
      ))}
    </nav>
  )
}
