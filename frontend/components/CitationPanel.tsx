"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";

type Citation = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  excerpt: string;
};

type CitationPanelProps = {
  activeCitationId: string | null;
  citations: Citation[];
  onCitationSelect: (citationId: string) => void;
};

export function CitationPanel({
  activeCitationId,
  citations,
  onCitationSelect
}: CitationPanelProps) {
  const citationRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!activeCitationId) return;
    citationRefs.current[activeCitationId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [activeCitationId]);

  return (
    <aside
      className="flex h-full flex-col rounded-2xl border"
      style={{
        background: "var(--bg-elev)",
        borderColor: "var(--border-base)"
      }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-base)" }}
      >
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="var(--brand-strong)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            来源引用
          </h2>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: "color-mix(in srgb, var(--brand) 14%, transparent)",
            color: "var(--brand-strong)"
          }}
        >
          {citations.length} 条
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {citations.length === 0 ? (
          <EmptyState />
        ) : (
          citations.map((citation) => {
            const isActive = citation.id === activeCitationId;
            return (
              <article
                key={citation.id}
                ref={(element) => {
                  citationRefs.current[citation.id] = element;
                }}
                className="focus-ring animate-fade-in-up cursor-pointer rounded-xl border p-3 transition-all hover:-translate-y-0.5"
                role="button"
                tabIndex={0}
                onClick={() => onCitationSelect(citation.id)}
                onKeyDown={(event) =>
                  handleCitationKeyDown(event, citation.id, onCitationSelect)
                }
                style={{
                  background: isActive
                    ? "color-mix(in srgb, var(--brand) 6%, var(--bg-elev))"
                    : "var(--bg-subtle)",
                  borderColor: isActive ? "var(--brand)" : "var(--border-base)",
                  boxShadow: isActive
                    ? "0 0 0 3px color-mix(in srgb, var(--brand) 12%, transparent)"
                    : "none"
                }}
              >
                <div className="flex w-full items-start gap-2 text-left">
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-bold"
                    style={{
                      background: isActive ? "var(--brand)" : "var(--bg-inset)",
                      color: isActive ? "#ffffff" : "var(--text-secondary)"
                    }}
                  >
                    [{citation.id}]
                  </span>
                  <span
                    className="min-w-0 flex-1 text-sm font-medium leading-6"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {citation.title}
                  </span>
                </div>
                <p
                  className="mt-2 text-xs leading-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {citation.excerpt || "该来源没有返回摘录。"}
                </p>
                {citation.sourceUrl ? (
                  <a
                    href={citation.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium transition hover:underline"
                    style={{ color: "var(--brand-strong)" }}
                  >
                    打开官方文档
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}

function handleCitationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  citationId: string,
  onCitationSelect: (citationId: string) => void
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onCitationSelect(citationId);
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center"
      style={{
        background: "var(--bg-subtle)",
        borderColor: "var(--border-base)"
      }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="var(--text-muted)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <path d="M9 18l6-6-6-6" />
        <path d="M3 12h12" />
        <path d="M21 4v16" />
      </svg>
      <p className="max-w-56 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
        回答中的引用编号会显示在这里,可点击跳转官方文档验证
      </p>
    </div>
  );
}
