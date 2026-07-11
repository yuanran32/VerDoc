"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { CitationPanel } from "@/components/CitationPanel";
import { MessageList } from "@/components/MessageList";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  type FrameworkOption,
  VersionPicker
} from "@/components/VersionPicker";
import { parseSseStream } from "@/lib/sse";

type Citation = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  excerpt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  citations?: Citation[];
  feedback?: FeedbackState;
};

type FeedbackRating = "up" | "down";

type FeedbackState = {
  rating: FeedbackRating;
  note?: string;
  status: "submitting" | "submitted" | "error";
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

type MetricsStatus = "loading" | "ready" | "error";

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

type EvalStatus = "idle" | "running" | "ready" | "error";

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

type FeedbackSummaryStatus = "loading" | "ready" | "error";

const defaultFrameworks: FrameworkOption[] = [
  { id: "vue", name: "Vue", versions: ["3.4"] }
];

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const exampleQueries = [
  {
    icon: "compare",
    text: "watch 和 watchEffect 有什么区别？",
    tag: "API 对比"
  },
  {
    icon: "version",
    text: "defineModel 怎么用？",
    tag: "版本相关"
  },
  {
    icon: "migration",
    text: "Vue2 的 filters 升到 Vue3 怎么改？",
    tag: "迁移"
  }
];

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [framework, setFramework] = useState("vue");
  const [version, setVersion] = useState("3.4");
  const [frameworkOptions, setFrameworkOptions] =
    useState<FrameworkOption[]>(defaultFrameworks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [metricsSnapshot, setMetricsSnapshot] = useState<MetricsSnapshot | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>("loading");
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState<string | null>(null);
  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);
  const [evalStatus, setEvalStatus] = useState<EvalStatus>("idle");
  const [evalUpdatedAt, setEvalUpdatedAt] = useState<string | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [feedbackSummaryStatus, setFeedbackSummaryStatus] =
    useState<FeedbackSummaryStatus>("loading");
  const abortRef = useRef<AbortController | null>(null);

  const hasStarted = messages.length > 0;

  // 引用面板显示：优先展示被选中消息的引用，否则回退到最新一条带引用的回答。
  const activeMessage = messages.find(
    (message) => message.id === activeMessageId
  );
  const latestCitedMessage = [...messages]
    .reverse()
    .find((message) => (message.citations?.length ?? 0) > 0);
  const displayedSource = activeMessage?.citations?.length
    ? activeMessage
    : latestCitedMessage;
  const displayedCitations = displayedSource?.citations ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryFramework = params.get("framework");
    const queryVersion = params.get("version");

    if (queryFramework) {
      setFramework(queryFramework);
    }
    if (queryVersion) {
      setVersion(queryVersion);
    }
  }, []);

  useEffect(() => {
    void loadFeedbackSummary();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeta() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/meta`);
        if (!response.ok) return;
        const payload = await response.json();
        if (isCancelled) return;

        const nextFrameworks = normalizeFrameworks(payload);
        if (nextFrameworks.length === 0) return;

        setFrameworkOptions(nextFrameworks);
        setFramework((currentFramework) => {
          const selected =
            nextFrameworks.find((item) => item.id === currentFramework) ??
            nextFrameworks[0];
          setVersion((currentVersion) =>
            selected.versions.includes(currentVersion)
              ? currentVersion
              : selected.versions[0]
          );
          return selected.id;
        });
      } catch {
        // Keep the built-in fallback options when the API is unavailable.
      }
    }

    loadMeta();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function pollMetrics() {
      await loadMetrics({ isCancelled: () => isCancelled });
    }

    pollMetrics();
    const intervalId = window.setInterval(pollMetrics, 15000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("framework", framework);
    params.set("version", version);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [framework, version]);

  function handleFrameworkChange(nextFramework: string) {
    const nextOption =
      frameworkOptions.find((item) => item.id === nextFramework) ??
      frameworkOptions[0];
    setFramework(nextOption.id);
    setVersion((currentVersion) =>
      nextOption.versions.includes(currentVersion)
        ? currentVersion
        : nextOption.versions[0]
    );
  }

  function resetSession() {
    abortRef.current?.abort();
    setMessages([]);
    setQuery("");
    setError(null);
    setActiveMessageId(null);
    setActiveCitationId(null);
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function submitQuestion(rawQuestion: string) {
    const trimmedQuery = rawQuestion.trim();
    if (!trimmedQuery || isLoading) return;

    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmedQuery },
      { id: assistantId, role: "assistant", content: "", status: "streaming" }
    ]);
    setActiveMessageId(null);
    setActiveCitationId(null);
    setError(null);
    setIsLoading(true);
    setQuery("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: trimmedQuery,
          framework,
          version,
          history: buildChatHistory(messages)
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }
      if (!response.body) {
        throw new Error("后端没有返回可读取的流。");
      }

      for await (const sseEvent of parseSseStream(response.body)) {
        const payload = parseEventPayload(sseEvent.data);

        if (sseEvent.event === "token") {
          const text =
            isRecord(payload) && typeof payload.text === "string"
              ? payload.text
              : "";
          appendAssistantText(assistantId, text);
        }

        if (sseEvent.event === "citations") {
          const items =
            isRecord(payload) && Array.isArray(payload.items)
              ? payload.items
              : [];
          const nextCitations = items
            .map((item, index) => normalizeCitation(item, index + 1))
            .filter(isCitation);
          attachCitations(assistantId, nextCitations);
          setActiveMessageId(assistantId);
          setActiveCitationId(nextCitations[0]?.id ?? null);
        }

        if (sseEvent.event === "error") {
          const message =
            isRecord(payload) && typeof payload.message === "string"
              ? payload.message
              : "当前请求失败。";
          setError(message);
          replaceEmptyAssistantText(assistantId, message);
          markAssistantStatus(assistantId, "error");
        }

        if (sseEvent.event === "done") {
          markAssistantStatus(assistantId, "done");
          setIsLoading(false);
        }
      }
    } catch (caughtError) {
      if (isAbortError(caughtError)) {
        // 用户主动停止：保留已生成内容，不当作错误处理。
        replaceEmptyAssistantText(assistantId, "已停止生成。");
        markAssistantStatus(assistantId, "done");
      } else {
        const message =
          caughtError instanceof Error ? caughtError.message : "当前请求失败。";
        setError(message);
        replaceEmptyAssistantText(assistantId, message);
        markAssistantStatus(assistantId, "error");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
      void loadMetrics({ quiet: true });
    }
  }

  async function loadMetrics({
    quiet = false,
    isCancelled = () => false
  }: {
    quiet?: boolean;
    isCancelled?: () => boolean;
  } = {}) {
    if (!quiet) {
      setMetricsStatus("loading");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/metrics`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`指标请求失败：${response.status}`);
      }

      const payload = await response.json();
      if (isCancelled()) return;

      const nextSnapshot = normalizeMetricsSnapshot(payload);
      if (!nextSnapshot) {
        throw new Error("指标响应格式不正确。");
      }

      setMetricsSnapshot(nextSnapshot);
      setMetricsUpdatedAt(formatMetricTime(new Date()));
      setMetricsStatus("ready");
    } catch {
      if (isCancelled()) return;
      setMetricsStatus("error");
    }
  }

  async function runEvaluation() {
    if (evalStatus === "running") return;

    setEvalStatus("running");
    try {
      const response = await fetch(`${apiBaseUrl}/api/eval/summary`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`评测请求失败：${response.status}`);
      }

      const payload = await response.json();
      const nextSummary = normalizeEvalSummary(payload);
      if (!nextSummary) {
        throw new Error("评测响应格式不正确。");
      }

      setEvalSummary(nextSummary);
      setEvalUpdatedAt(formatMetricTime(new Date()));
      setEvalStatus("ready");
    } catch {
      setEvalStatus("error");
    }
  }

  async function loadFeedbackSummary() {
    setFeedbackSummaryStatus("loading");
    try {
      const response = await fetch(`${apiBaseUrl}/api/feedback/summary`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`反馈摘要请求失败：${response.status}`);
      }

      const payload = await response.json();
      const nextSummary = normalizeFeedbackSummary(payload);
      if (!nextSummary) {
        throw new Error("反馈摘要响应格式不正确。");
      }

      setFeedbackSummary(nextSummary);
      setFeedbackSummaryStatus("ready");
    } catch {
      setFeedbackSummaryStatus("error");
    }
  }

  async function submitFeedback(
    messageId: string,
    rating: FeedbackRating,
    note?: string
  ) {
    const messageIndex = messages.findIndex((message) => message.id === messageId);
    const message = messages[messageIndex];
    if (!message || message.role !== "assistant" || message.feedback?.status === "submitted") {
      return;
    }

    const question = findPreviousUserQuestion(messages, messageIndex);
    if (!question) return;

    updateMessageFeedback(messageId, {
      rating,
      note,
      status: "submitting"
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer: message.content,
          rating,
          framework,
          version,
          citations: (message.citations ?? []).map((citation) => ({
            id: citation.id,
            title: citation.title,
            source_url: citation.sourceUrl
          })),
          note: note?.trim() || null
        })
      });

      if (!response.ok) {
        throw new Error(`反馈提交失败：${response.status}`);
      }

      updateMessageFeedback(messageId, {
        rating,
        note,
        status: "submitted"
      });
      void loadFeedbackSummary();
    } catch {
      updateMessageFeedback(messageId, {
        rating,
        note,
        status: "error"
      });
    }
  }

  function updateMessageFeedback(messageId: string, feedback: FeedbackState) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, feedback } : message
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(query);
  }

  function appendAssistantText(messageId: string, text: string) {
    if (!text) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${text}` }
          : message
      )
    );
  }

  function attachCitations(messageId: string, nextCitations: Citation[]) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, citations: nextCitations }
          : message
      )
    );
  }

  function handleCitationSelect(messageId: string, citationId: string) {
    setActiveMessageId(messageId);
    setActiveCitationId(citationId);
  }

  function handlePanelCitationSelect(citationId: string) {
    if (!displayedSource) return;
    setActiveMessageId(displayedSource.id);
    setActiveCitationId(citationId);
  }

  function replaceEmptyAssistantText(messageId: string, text: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && !message.content
          ? { ...message, content: text }
          : message
      )
    );
  }

  function markAssistantStatus(messageId: string, status: Message["status"]) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, status } : message
      )
    );
  }

  return (
    <main className="app-bg min-h-screen overflow-hidden px-3 py-3 text-[var(--text-primary)] sm:px-5 sm:py-5">
      <div className="mac-window mx-auto flex h-[calc(100vh-1.5rem)] min-h-[700px] w-full max-w-[1440px] overflow-hidden rounded-[18px] max-md:h-auto max-md:min-h-[calc(100vh-1.5rem)]">
        <Sidebar
          citationCount={displayedCitations.length}
          framework={framework}
          hasStarted={hasStarted}
          isLoading={isLoading}
          version={version}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <MacToolbar
            citationCount={displayedCitations.length}
            framework={framework}
            frameworkOptions={frameworkOptions}
            hasStarted={hasStarted}
            isLoading={isLoading}
            onFrameworkChange={handleFrameworkChange}
            onReset={resetSession}
            onVersionChange={setVersion}
            version={version}
          />

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section
              className="flex min-h-[620px] min-w-0 flex-col overflow-hidden border-t lg:min-h-0 lg:border-r lg:border-t-0"
              style={{ borderColor: "var(--border-base)" }}
              aria-label="文档问答"
            >
              {hasStarted ? (
                <MessageList
                  activeCitationId={activeCitationId}
                  activeMessageId={activeMessageId}
                  messages={messages}
                  onCitationSelect={handleCitationSelect}
                  onFeedbackSubmit={submitFeedback}
                />
              ) : (
                <Hero
                  disabled={isLoading}
                  examples={exampleQueries}
                  framework={framework}
                  onPick={submitQuestion}
                  version={version}
                />
              )}

              <InputBar
                disabled={isLoading}
                error={error}
                examples={exampleQueries.map((example) => example.text)}
                hasStarted={hasStarted}
                onExample={setQuery}
                onStop={stopGeneration}
                onSubmit={handleSubmit}
                query={query}
                setQuery={setQuery}
              />
            </section>

            <CitationPanel
              activeCitationId={activeCitationId}
              citations={displayedCitations}
              evalStatus={evalStatus}
              evalSummary={evalSummary}
              evalUpdatedAt={evalUpdatedAt}
              feedbackSummary={feedbackSummary}
              feedbackSummaryStatus={feedbackSummaryStatus}
              metrics={metricsSnapshot}
              metricsStatus={metricsStatus}
              metricsUpdatedAt={metricsUpdatedAt}
              onEvalRun={runEvaluation}
              onFeedbackRefresh={loadFeedbackSummary}
              onMetricsRefresh={() => loadMetrics()}
              onCitationSelect={handlePanelCitationSelect}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

type SidebarProps = {
  citationCount: number;
  framework: string;
  hasStarted: boolean;
  isLoading: boolean;
  version: string;
};

function Sidebar({
  citationCount,
  framework,
  hasStarted,
  isLoading,
  version
}: SidebarProps) {
  return (
    <aside
      className="hidden w-60 flex-none flex-col border-r md:flex"
      style={{
        background: "var(--bg-sidebar)",
        borderColor: "var(--border-base)"
      }}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <TrafficLights />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-3">
          <SearchLogo size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">VerDoc</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              文档问答
            </div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="主导航">
        <SidebarItem active icon="chat" label="工作台" />
        <SidebarItem icon="book" label="Vue 文档" />
        <SidebarItem icon="quote" label="引用" badge={citationCount} />
        <SidebarItem icon="settings" label="偏好设置" />
      </nav>

      <div className="space-y-3 border-t p-3" style={{ borderColor: "var(--border-base)" }}>
        <div className="mac-panel rounded-xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              上下文
            </span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: isLoading ? "var(--warning)" : "var(--accent)" }}
              aria-hidden="true"
            />
          </div>
          <div className="text-sm font-semibold uppercase">{framework}</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            v{version} · {hasStarted ? "对话中" : "就绪"}
          </div>
        </div>
      </div>
    </aside>
  );
}

type SidebarItemProps = {
  active?: boolean;
  badge?: number;
  icon: "book" | "chat" | "quote" | "settings";
  label: string;
};

function SidebarItem({ active = false, badge, icon, label }: SidebarItemProps) {
  return (
    <button
      type="button"
      className="focus-ring flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition hover:bg-[var(--bg-hover)]"
      style={{
        background: active ? "var(--bg-selected)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)"
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center"
        style={{ color: active ? "var(--brand-strong)" : "var(--text-muted)" }}
        aria-hidden="true"
      >
        <SidebarIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof badge === "number" ? (
        <span
          className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium"
          style={{
            background: active ? "var(--brand-soft)" : "var(--bg-inset)",
            color: active ? "var(--brand-strong)" : "var(--text-muted)"
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

type MacToolbarProps = {
  citationCount: number;
  frameworkOptions: FrameworkOption[];
  framework: string;
  hasStarted: boolean;
  isLoading: boolean;
  onFrameworkChange: (framework: string) => void;
  onReset: () => void;
  onVersionChange: (version: string) => void;
  version: string;
};

function MacToolbar({
  citationCount,
  frameworkOptions,
  framework,
  hasStarted,
  isLoading,
  onFrameworkChange,
  onReset,
  onVersionChange,
  version
}: MacToolbarProps) {
  return (
    <header
      className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
      style={{
        background: "var(--bg-toolbar)",
        borderColor: "var(--border-base)"
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="md:hidden">
          <TrafficLights />
        </div>
        <div className="hidden md:block">
          <SearchLogo size="xs" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold">VerDoc</h1>
            {isLoading ? <StatusPill tone="warning" label="生成中" /> : <StatusPill label="就绪" />}
          </div>
          <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {framework.toUpperCase()} v{version} · {citationCount} 条引用
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <VersionPicker
          disabled={isLoading}
          frameworks={frameworkOptions}
          framework={framework}
          onFrameworkChange={onFrameworkChange}
          onVersionChange={onVersionChange}
          version={version}
        />
        <ToolbarIconButton
          disabled={!hasStarted && !citationCount}
          label="新建对话"
          name="new"
          onClick={onReset}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}

function StatusPill({ label, tone = "accent" }: { label: string; tone?: "accent" | "warning" }) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium"
      style={{
        background:
          tone === "warning"
            ? "color-mix(in srgb, var(--warning) 13%, transparent)"
            : "color-mix(in srgb, var(--accent) 13%, transparent)",
        borderColor:
          tone === "warning"
            ? "color-mix(in srgb, var(--warning) 26%, transparent)"
            : "color-mix(in srgb, var(--accent) 26%, transparent)",
        color: tone === "warning" ? "var(--warning)" : "var(--accent-strong)"
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: tone === "warning" ? "var(--warning)" : "var(--accent)" }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

type ExampleQuery = {
  icon: string;
  text: string;
  tag: string;
};

type HeroProps = {
  disabled: boolean;
  examples: ExampleQuery[];
  framework: string;
  onPick: (text: string) => void;
  version: string;
};

function Hero({ disabled, examples, framework, onPick, version }: HeroProps) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center">
          <SearchLogo size="lg" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-normal">VerDoc</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {framework.toUpperCase()} v{version} 官方文档问答
          </p>
        </div>

        <div className="mac-panel mt-8 overflow-hidden rounded-2xl">
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--border-base)" }}
          >
            <span className="text-sm font-semibold">推荐问题</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {examples.length} 个
            </span>
          </div>
          <div className="mac-divide">
            {examples.map((example) => (
              <button
                key={example.text}
                type="button"
                disabled={disabled}
                onClick={() => onPick(example.text)}
                className="focus-ring group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{
                    background: "var(--bg-inset)",
                    color: "var(--brand-strong)"
                  }}
                  aria-hidden="true"
                >
                  <ExampleIcon name={example.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-5">
                    {example.text}
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>
                    {example.tag}
                  </span>
                </span>
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-lg opacity-60 transition group-hover:opacity-100"
                  style={{
                    background: "var(--bg-inset)",
                    color: "var(--text-secondary)"
                  }}
                  aria-hidden="true"
                >
                  <ArrowRightIcon />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchLogo({ size }: { size: "xs" | "sm" | "lg" }) {
  const sizeClass =
    size === "lg"
      ? "h-16 w-16 rounded-[18px]"
      : size === "sm"
        ? "h-10 w-10 rounded-[13px]"
        : "h-8 w-8 rounded-[10px]";
  const iconClass = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className={`flex items-center justify-center text-white ${sizeClass}`}
      style={{
        background:
          "linear-gradient(135deg, #0a84ff 0%, #38bdf8 46%, #30d158 100%)",
        boxShadow:
          size === "lg"
            ? "0 18px 42px rgba(10, 132, 255, 0.24), inset 0 1px 0 rgba(255,255,255,0.34)"
            : "0 8px 18px rgba(10, 132, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.32)"
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={size === "lg" ? 2 : 2.2}
      >
        <path d="M7 3.75h6.2L17 7.55v12.7H7z" />
        <path d="M13 3.75v4h4" />
        <circle cx="11" cy="13" r="2.8" />
        <path d="M13.1 15.1 16 18" />
      </svg>
    </div>
  );
}

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="traffic-light" style={{ background: "#ff5f57" }} />
      <span className="traffic-light" style={{ background: "#febc2e" }} />
      <span className="traffic-light" style={{ background: "#28c840" }} />
    </div>
  );
}

function SidebarIcon({ name }: { name: SidebarItemProps["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2
  };

  if (name === "book") {
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }

  if (name === "quote") {
    return (
      <svg {...common}>
        <path d="M7 7h7" />
        <path d="M7 12h10" />
        <path d="M7 17h4" />
        <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...common}>
        <path d="M12 8v8" />
        <path d="M8 12h8" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function ExampleIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  if (name === "version") {
    return (
      <svg {...common}>
        <path d="M5 4v16M19 4v16M8 7h8M8 12h8M8 17h5" />
      </svg>
    );
  }
  if (name === "migration") {
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

type ToolbarIconButtonProps = {
  disabled?: boolean;
  label: string;
  name: "new";
  onClick: () => void;
};

function ToolbarIconButton({
  disabled = false,
  label,
  name,
  onClick
}: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        background: "var(--bg-control)",
        borderColor: "var(--border-base)",
        color: "var(--text-secondary)"
      }}
    >
      {name === "new" ? <NewChatIcon /> : null}
    </button>
  );
}

function NewChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

type InputBarProps = {
  disabled: boolean;
  error: string | null;
  examples: string[];
  hasStarted: boolean;
  onExample: (text: string) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  query: string;
  setQuery: (value: string) => void;
};

function InputBar({
  disabled,
  error,
  examples,
  hasStarted,
  onExample,
  onStop,
  onSubmit,
  query,
  setQuery
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [query]);

  return (
    <form
      onSubmit={onSubmit}
      className="border-t px-3 py-3"
      style={{
        background: "var(--bg-toolbar)",
        borderColor: "var(--border-base)"
      }}
    >
      {hasStarted ? null : (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={disabled}
              onClick={() => onExample(example)}
              className="focus-ring flex-none rounded-full border px-2.5 py-1 text-[11px] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--bg-control)",
                borderColor: "var(--border-base)",
                color: "var(--text-secondary)"
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}
      <label className="sr-only" htmlFor="question">
        输入文档问题
      </label>
      <div className="flex items-end gap-2">
        <div
          className="flex min-h-11 flex-1 items-center rounded-xl border transition focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
          style={{
            borderColor: "var(--border-base)",
            background: "var(--bg-input)"
          }}
        >
          <textarea
            id="question"
            ref={textareaRef}
            rows={1}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(
                event.target.scrollHeight,
                160
              )}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (query.trim()) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            placeholder="问一个 Vue 文档问题，例如 watch 和 watchEffect 的区别"
            value={query}
            className="max-h-40 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        {disabled ? (
          <button
            type="button"
            onClick={onStop}
            className="focus-ring flex h-11 w-11 flex-none items-center justify-center rounded-xl border transition hover:brightness-105"
            style={{
              background: "color-mix(in srgb, var(--danger) 12%, var(--bg-elev))",
              borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
              color: "var(--danger)"
            }}
            aria-label="停止生成"
            title="停止生成"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <rect
                x="6.5"
                y="6.5"
                width="11"
                height="11"
                rx="2.5"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!query.trim()}
            className="focus-ring flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
            style={{
              background: !query.trim()
                ? "var(--text-muted)"
                : "linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)"
            }}
            aria-label="发送"
            title="发送"
          >
            <ArrowRightIcon />
          </button>
        )}
      </div>
      {error ? (
        <p
          className="mt-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            background: "color-mix(in srgb, var(--danger) 8%, var(--bg-elev))",
            borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)",
            color: "var(--danger)"
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function parseEventPayload(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCitation(value: unknown, fallbackIndex: number): Citation | null {
  if (!isRecord(value)) return null;
  const rawSourceUrl = value.sourceUrl ?? value.source_url ?? value.url;
  const rawId = value.id ?? value.index ?? fallbackIndex;
  const id = String(rawId).replace(/^\[|\]$/g, "");

  return {
    id,
    title: typeof value.title === "string" ? value.title : "引用来源",
    sourceUrl: typeof rawSourceUrl === "string" ? rawSourceUrl : null,
    excerpt: typeof value.excerpt === "string" ? value.excerpt : ""
  };
}

function isCitation(value: Citation | null): value is Citation {
  return value !== null;
}

function normalizeMetricsSnapshot(value: unknown): MetricsSnapshot | null {
  if (!isRecord(value)) return null;

  const latency = value.latency_ms;
  const outputChars = value.output_chars;
  const citations = value.citations;

  if (
    !isRecord(latency) ||
    !isRecord(outputChars) ||
    !isRecord(citations) ||
    typeof value.total_requests !== "number" ||
    !isRecord(value.status_counts) ||
    typeof value.estimated_cost_cny !== "number"
  ) {
    return null;
  }

  return {
    total_requests: value.total_requests,
    status_counts: normalizeStatusCounts(value.status_counts),
    latency_ms: {
      avg: numberOrZero(latency.avg),
      p95: numberOrZero(latency.p95),
      max: numberOrZero(latency.max)
    },
    output_chars: {
      total: numberOrZero(outputChars.total),
      avg: numberOrZero(outputChars.avg)
    },
    citations: {
      total: numberOrZero(citations.total),
      avg: numberOrZero(citations.avg)
    },
    estimated_cost_cny: value.estimated_cost_cny
  };
}

function normalizeEvalSummary(value: unknown): EvalSummary | null {
  if (
    !isRecord(value) ||
    typeof value.total !== "number" ||
    typeof value.hit_rate_at_5 !== "number" ||
    typeof value.refusal_accuracy !== "number" ||
    !Array.isArray(value.results)
  ) {
    return null;
  }

  const results = value.results
    .map(normalizeEvalResult)
    .filter((item): item is EvalResult => item !== null);

  return {
    total: value.total,
    hit_rate_at_5: value.hit_rate_at_5,
    refusal_accuracy: value.refusal_accuracy,
    results
  };
}

function normalizeEvalResult(value: unknown): EvalResult | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.query !== "string" ||
    typeof value.hit !== "boolean" ||
    typeof value.expected_refusal !== "boolean" ||
    typeof value.refused !== "boolean" ||
    !Array.isArray(value.retrieved_ids)
  ) {
    return null;
  }

  return {
    id: value.id,
    query: value.query,
    hit: value.hit,
    expected_refusal: value.expected_refusal,
    refused: value.refused,
    retrieved_ids: value.retrieved_ids.filter(
      (item): item is string => typeof item === "string"
    ),
    top_source_url:
      typeof value.top_source_url === "string" ? value.top_source_url : null,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((item): item is string => typeof item === "string")
      : []
  };
}

function normalizeFeedbackSummary(value: unknown): FeedbackSummary | null {
  if (
    !isRecord(value) ||
    typeof value.total !== "number" ||
    typeof value.up !== "number" ||
    typeof value.down !== "number" ||
    !Array.isArray(value.recent_bad_cases)
  ) {
    return null;
  }

  return {
    total: value.total,
    up: value.up,
    down: value.down,
    recent_bad_cases: value.recent_bad_cases
      .map(normalizeBadCase)
      .filter((item): item is FeedbackSummary["recent_bad_cases"][number] => item !== null)
  };
}

function normalizeBadCase(value: unknown): FeedbackSummary["recent_bad_cases"][number] | null {
  if (
    !isRecord(value) ||
    typeof value.question !== "string" ||
    typeof value.framework !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    question: value.question,
    note: typeof value.note === "string" ? value.note : null,
    framework: value.framework,
    version: typeof value.version === "string" ? value.version : null,
    created_at: value.created_at
  };
}

function findPreviousUserQuestion(messages: Message[], startIndex: number): string | null {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index].content;
    }
  }

  return null;
}

function buildChatHistory(messages: Message[]): Array<{ role: string; content: string }> {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function normalizeStatusCounts(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMetricTime(value: Date): string {
  return value.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeFrameworks(payload: unknown): FrameworkOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.frameworks)) return [];

  return payload.frameworks
    .map((item) => {
      if (!isRecord(item)) return null;
      const versions = Array.isArray(item.versions)
        ? item.versions.filter((value): value is string => typeof value === "string")
        : [];

      if (
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        versions.length === 0
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        versions
      };
    })
    .filter((item): item is FrameworkOption => item !== null);
}
