"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";

type Citation = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  excerpt: string;
};

type MetricsSnapshot = {
  total_requests: number;
  status_counts: Record<string, number>;
  latency_ms: {
    avg: number;
    p95: number;
    max: number;
  };
  output_chars: {
    total: number;
    avg: number;
  };
  citations: {
    total: number;
    avg: number;
  };
  estimated_cost_cny: number;
};

type EvalResult = {
  id: string;
  query: string;
  hit: boolean;
  expected_refusal: boolean;
  refused: boolean;
  retrieved_ids: string[];
  top_source_url?: string | null;
  tags: string[];
};

type EvalSummary = {
  total: number;
  hit_rate_at_5: number;
  refusal_accuracy: number;
  results: EvalResult[];
};

type FeedbackSummary = {
  total: number;
  up: number;
  down: number;
  recent_bad_cases: Array<{
    question: string;
    note?: string | null;
    framework: string;
    version?: string | null;
    created_at: string;
  }>;
};

type CitationPanelProps = {
  activeCitationId: string | null;
  citations: Citation[];
  evalStatus: "idle" | "running" | "ready" | "error";
  evalSummary: EvalSummary | null;
  evalUpdatedAt: string | null;
  feedbackSummary: FeedbackSummary | null;
  feedbackSummaryStatus: "loading" | "ready" | "error";
  metrics: MetricsSnapshot | null;
  metricsStatus: "loading" | "ready" | "error";
  metricsUpdatedAt: string | null;
  onEvalRun: () => void;
  onFeedbackRefresh: () => void;
  onMetricsRefresh: () => void;
  onCitationSelect: (citationId: string) => void;
};

export function CitationPanel({
  activeCitationId,
  citations,
  evalStatus,
  evalSummary,
  evalUpdatedAt,
  feedbackSummary,
  feedbackSummaryStatus,
  metrics,
  metricsStatus,
  metricsUpdatedAt,
  onEvalRun,
  onFeedbackRefresh,
  onMetricsRefresh,
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
      className="flex min-h-[280px] flex-col border-t lg:min-h-0 lg:border-t-0"
      style={{
        background: "var(--bg-sidebar)",
        borderColor: "var(--border-base)"
      }}
      aria-label="引用检查器"
    >
      <header
        className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border-base)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg"
            style={{
              background: "var(--bg-inset)",
              color: "var(--brand-strong)"
            }}
            aria-hidden="true"
          >
            <BookIcon />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">来源引用</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Inspector
            </p>
          </div>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-xs font-medium"
          style={{
            background: "var(--bg-control)",
            borderColor: "var(--border-base)",
            color: "var(--text-secondary)"
          }}
        >
          {citations.length}
        </span>
      </header>

      <MetricsPanel
        metrics={metrics}
        metricsStatus={metricsStatus}
        metricsUpdatedAt={metricsUpdatedAt}
        onRefresh={onMetricsRefresh}
      />

      <EvalPanel
        evalStatus={evalStatus}
        evalSummary={evalSummary}
        evalUpdatedAt={evalUpdatedAt}
        onRun={onEvalRun}
      />

      <FeedbackSummaryPanel
        feedbackSummary={feedbackSummary}
        feedbackSummaryStatus={feedbackSummaryStatus}
        onRefresh={onFeedbackRefresh}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-t p-3" style={{ borderColor: "var(--border-base)" }}>
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
                className="focus-ring animate-fade-in-up cursor-pointer rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:bg-[var(--bg-hover)]"
                role="button"
                tabIndex={0}
                onClick={() => onCitationSelect(citation.id)}
                onKeyDown={(event) =>
                  handleCitationKeyDown(event, citation.id, onCitationSelect)
                }
                style={{
                  background: isActive
                    ? "color-mix(in srgb, var(--brand) 7%, var(--bg-elev))"
                    : "var(--bg-control)",
                  borderColor: isActive ? "var(--brand)" : "var(--border-base)",
                  boxShadow: isActive
                    ? "0 0 0 3px color-mix(in srgb, var(--brand) 13%, transparent)"
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
                  <span className="min-w-0 flex-1 text-sm font-medium leading-6">
                    {citation.title}
                  </span>
                </div>
                <p
                  className="mt-2 line-clamp-4 text-xs leading-6"
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
                    <span aria-hidden="true">→</span>
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

function FeedbackSummaryPanel({
  feedbackSummary,
  feedbackSummaryStatus,
  onRefresh
}: {
  feedbackSummary: FeedbackSummary | null;
  feedbackSummaryStatus: "loading" | "ready" | "error";
  onRefresh: () => void;
}) {
  return (
    <section className="px-3 pb-3" aria-label="反馈摘要">
      <div
        className="rounded-xl border p-3"
        style={{
          background: "var(--bg-control)",
          borderColor: "var(--border-base)"
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">反馈闭环</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Bad cases
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-hover)]"
            style={{
              background: "var(--bg-control)",
              borderColor: "var(--border-base)",
              color: "var(--text-secondary)"
            }}
            aria-label="刷新反馈摘要"
            title="刷新反馈摘要"
          >
            <RefreshIcon />
          </button>
        </div>

        {feedbackSummaryStatus === "error" ? (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)",
              color: "var(--danger)"
            }}
            role="status"
          >
            反馈摘要暂不可用。
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <MetricCell label="总数" value={formatInteger(feedbackSummary?.total)} />
            <MetricCell label="赞" value={formatInteger(feedbackSummary?.up)} />
            <MetricCell label="踩" value={formatInteger(feedbackSummary?.down)} />
          </div>
        )}

        {feedbackSummary?.recent_bad_cases.length ? (
          <div className="mt-3 space-y-1.5">
            {feedbackSummary.recent_bad_cases.slice(0, 3).map((badCase, index) => (
              <div
                key={`${badCase.created_at}-${index}`}
                className="rounded-lg border px-2.5 py-2"
                style={{
                  background: "var(--bg-inset)",
                  borderColor: "var(--border-base)"
                }}
              >
                <p className="line-clamp-2 text-xs font-medium">{badCase.question}</p>
                {badCase.note ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4" style={{ color: "var(--text-muted)" }}>
                    {badCase.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : feedbackSummary ? (
          <div
            className="mt-3 rounded-lg border px-2.5 py-2 text-xs"
            style={{
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
              color: "var(--accent-strong)"
            }}
          >
            暂无 bad case。
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EvalPanel({
  evalStatus,
  evalSummary,
  evalUpdatedAt,
  onRun
}: {
  evalStatus: "idle" | "running" | "ready" | "error";
  evalSummary: EvalSummary | null;
  evalUpdatedAt: string | null;
  onRun: () => void;
}) {
  const failedResults = evalSummary
    ? evalSummary.results.filter((result) => !isEvalResultPassed(result)).slice(0, 3)
    : [];

  return (
    <section className="px-3 pb-3" aria-label="评测结果">
      <div
        className="rounded-xl border p-3"
        style={{
          background: "var(--bg-control)",
          borderColor: "var(--border-base)"
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">评测结果</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {evalUpdatedAt ? `运行 ${evalUpdatedAt}` : "Golden set"}
            </p>
          </div>
          <button
            type="button"
            disabled={evalStatus === "running"}
            onClick={onRun}
            className="focus-ring inline-flex h-7 flex-none items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            style={{
              background: "var(--bg-control)",
              borderColor: "var(--border-base)",
              color: "var(--text-secondary)"
            }}
          >
            {evalStatus === "running" ? <SpinnerIcon /> : <PlayIcon />}
            {evalStatus === "running" ? "运行中" : "运行评测"}
          </button>
        </div>

        {evalStatus === "error" ? (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)",
              color: "var(--danger)"
            }}
            role="status"
          >
            评测运行失败。
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <MetricCell label="题数" value={formatInteger(evalSummary?.total)} />
            <MetricCell
              label="Hit@5"
              value={formatPercent(evalSummary?.hit_rate_at_5)}
            />
            <MetricCell
              label="拒答"
              value={formatPercent(evalSummary?.refusal_accuracy)}
            />
          </div>
        )}

        {evalSummary ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                待检查 case
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {failedResults.length}
              </span>
            </div>
            {failedResults.length > 0 ? (
              failedResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-lg border px-2.5 py-2"
                  style={{
                    background: "var(--bg-inset)",
                    borderColor: "var(--border-base)"
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{result.id}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                        color: "var(--danger)"
                      }}
                    >
                      {result.expected_refusal ? "拒答异常" : "MISS"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4" style={{ color: "var(--text-muted)" }}>
                    {result.query}
                  </p>
                </div>
              ))
            ) : (
              <div
                className="rounded-lg border px-2.5 py-2 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
                  color: "var(--accent-strong)"
                }}
              >
                当前样例集没有失败项。
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function isEvalResultPassed(result: EvalResult): boolean {
  if (result.expected_refusal) {
    return result.refused;
  }
  return result.hit;
}

function MetricsPanel({
  metrics,
  metricsStatus,
  metricsUpdatedAt,
  onRefresh
}: {
  metrics: MetricsSnapshot | null;
  metricsStatus: "loading" | "ready" | "error";
  metricsUpdatedAt: string | null;
  onRefresh: () => void;
}) {
  const statusLabel =
    metricsStatus === "loading" ? "同步中" : metricsStatus === "error" ? "离线" : "Live";
  const statusTone =
    metricsStatus === "error"
      ? "var(--danger)"
      : metricsStatus === "loading"
        ? "var(--warning)"
        : "var(--accent)";

  return (
    <section className="p-3" aria-label="运行指标">
      <div
        className="rounded-xl border p-3"
        style={{
          background: "var(--bg-control)",
          borderColor: "var(--border-base)"
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">运行指标</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {metricsUpdatedAt ? `更新 ${metricsUpdatedAt}` : "等待数据"}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium"
              style={{
                background: "var(--bg-inset)",
                borderColor: "var(--border-base)",
                color: "var(--text-secondary)"
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: statusTone }}
                aria-hidden="true"
              />
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-hover)]"
              style={{
                background: "var(--bg-control)",
                borderColor: "var(--border-base)",
                color: "var(--text-secondary)"
              }}
              aria-label="刷新运行指标"
              title="刷新运行指标"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {metricsStatus === "error" ? (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)",
              color: "var(--danger)"
            }}
            role="status"
          >
            指标服务暂不可用。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <MetricCell label="请求" value={formatInteger(metrics?.total_requests)} />
            <MetricCell label="平均延迟" value={`${formatNumber(metrics?.latency_ms.avg)} ms`} />
            <MetricCell label="P95 延迟" value={`${formatNumber(metrics?.latency_ms.p95)} ms`} />
            <MetricCell label="最大延迟" value={`${formatNumber(metrics?.latency_ms.max)} ms`} />
            <MetricCell label="平均引用" value={formatNumber(metrics?.citations.avg)} />
            <MetricCell label="成本" value={`¥${formatCost(metrics?.estimated_cost_cny)}`} />
          </div>
        )}

        {metrics ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(metrics.status_counts).map(([name, count]) => (
              <span
                key={name}
                className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--bg-inset)",
                  color: "var(--text-secondary)"
                }}
              >
                {name} {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="min-h-14 rounded-lg border px-2.5 py-2"
      style={{
        background: "var(--bg-inset)",
        borderColor: "var(--border-base)"
      }}
    >
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatInteger(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return Math.round(value).toLocaleString("zh-CN");
}

function formatCost(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.0000";
  }

  return value.toFixed(4);
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
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
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
      style={{
        background: "var(--bg-control)",
        borderColor: "var(--border-base)"
      }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: "var(--bg-inset)",
          color: "var(--text-muted)"
        }}
        aria-hidden="true"
      >
        <BookIcon />
      </span>
      <p className="max-w-56 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
        回答中的引用会显示在这里。
      </p>
    </div>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l9.4-6.4a1 1 0 0 0 0-1.7L9.6 4.8A1 1 0 0 0 8 5.6z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}
