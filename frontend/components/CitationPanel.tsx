type Citation = {
  id: string;
  title: string;
  sourceUrl: string;
  excerpt: string;
};

export function CitationPanel({ citations }: { citations: Citation[] }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">引用来源</h2>
      <div className="mt-4 space-y-3">
        {citations.map((citation) => (
          <section
            className="rounded-md border border-slate-200 p-3"
            key={citation.id}
          >
            <div className="text-xs font-medium text-slate-500">
              [{citation.id}]
            </div>
            <h3 className="mt-1 text-sm font-medium text-slate-950">
              {citation.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {citation.excerpt}
            </p>
            <a
              className="mt-3 inline-block text-sm font-medium text-slate-950 underline underline-offset-4"
              href={citation.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              打开官方文档
            </a>
          </section>
        ))}
      </div>
    </aside>
  );
}
