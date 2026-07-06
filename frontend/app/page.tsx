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

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
};

type Citation = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  excerpt: string;
};

const defaultFrameworks: FrameworkOption[] = [
  { id: "vue", name: "Vue", versions: ["3.4"] }
];

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const exampleQueries = [
  {
    icon: "compare",
    text: "watch 和 watchEffect 有什么区别?",
    tag: "API 对比"
  },
  {
    icon: "version",
    text: "defineModel 怎么用?",
    tag: "版本相关"
  },
  {
    icon: "migration",
    text: "Vue2 的 filters 升到 Vue3 怎么改?",
    tag: "迁移"
  }
];

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [query, setQuery] = useState("");
  const [framework, setFramework] = useState("vue");
  const [version, setVersion] = useState("3.4");
  const [frameworkOptions, setFrameworkOptions] =
    useState<FrameworkOption[]>(defaultFrameworks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);

  const hasStarted = messages.length > 0;

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

  async function submitQuestion(rawQuestion: string) {
    const trimmedQuery = rawQuestion.trim();
    if (!trimmedQuery || isLoading) return;

    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmedQuery },
      { id: assistantId, role: "assistant", content: "", status: "streaming" }
    ]);
    setCitations([]);
    setActiveCitationId(null);
    setError(null);
    setIsLoading(true);
    setQuery("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          framework,
          version,
          history: []
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
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
          setCitations(nextCitations);
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
      const message =
        caughtError instanceof Error ? caughtError.message : "当前请求失败。";
      setError(message);
      replaceEmptyAssistantText(assistantId, message);
      markAssistantStatus(assistantId, "error");
    } finally {
      setIsLoading(false);
    }
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
    <main className="app-bg flex min-h-screen flex-col">
      <Header
        frameworkOptions={frameworkOptions}
        framework={framework}
        isLoading={isLoading}
        onFrameworkChange={handleFrameworkChange}
        onVersionChange={setVersion}
        version={version}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pb-4 pt-4 lg:flex-row">
        <section
          className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
          style={{
            borderColor: "var(--border-base)",
            background: "var(--bg-elev)"
          }}
          aria-label="文档问答"
        >
          {hasStarted ? (
            <MessageList
              activeCitationId={activeCitationId}
              messages={messages}
              onCitationSelect={setActiveCitationId}
            />
          ) : (
            <Hero
              disabled={isLoading}
              examples={exampleQueries}
              onPick={submitQuestion}
            />
          )}

          <InputBar
            disabled={isLoading}
            error={error}
            examples={exampleQueries.map((example) => example.text)}
            hasStarted={hasStarted}
            onExample={setQuery}
            onSubmit={handleSubmit}
            query={query}
            setQuery={setQuery}
          />
        </section>

        <div className="lg:w-[360px] lg:flex-none">
          <div className="h-full min-h-[200px] lg:h-[calc(100vh-140px)]">
            <CitationPanel
              activeCitationId={activeCitationId}
              citations={citations}
              onCitationSelect={setActiveCitationId}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

type HeaderProps = {
  frameworkOptions: FrameworkOption[];
  framework: string;
  isLoading: boolean;
  onFrameworkChange: (framework: string) => void;
  onVersionChange: (version: string) => void;
  version: string;
};

function Header({
  frameworkOptions,
  framework,
  isLoading,
  onFrameworkChange,
  onVersionChange,
  version
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-10 border-b backdrop-blur-md"
      style={{
        borderColor: "var(--border-base)",
        background: "color-mix(in srgb, var(--bg-base) 80%, transparent)"
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SearchLogo size="sm" />
          <div className="flex flex-col leading-tight">
            <span
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              VerDoc
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              版本感知文档助手
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2.5">
          <VersionPicker
            disabled={isLoading}
            frameworks={frameworkOptions}
            framework={framework}
            onFrameworkChange={onFrameworkChange}
            onVersionChange={onVersionChange}
            version={version}
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
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
  onPick: (text: string) => void;
};

function Hero({ disabled, examples, onPick }: HeroProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <SearchLogo size="lg" />
      <h1
        className="mt-5 text-center text-3xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        问懂 Vue 官方文档
      </h1>
      <p
        className="mt-2 max-w-xl text-center text-sm leading-6"
        style={{ color: "var(--text-secondary)" }}
      >
        回答基于官方文档检索生成,带来源引用与版本标注;找不到证据就拒答,不编造。
      </p>

      <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {examples.map((example) => (
          <button
            key={example.text}
            type="button"
            disabled={disabled}
            onClick={() => onPick(example.text)}
            className="focus-ring group flex min-h-28 flex-col gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            style={{
              borderColor: "var(--border-base)",
              background: "var(--bg-subtle)"
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: "var(--bg-inset)",
                  color: "var(--brand-strong)"
                }}
                aria-hidden="true"
              >
                <ExampleIcon name={example.icon} />
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: "var(--bg-inset)",
                  color: "var(--text-muted)"
                }}
              >
                {example.tag}
              </span>
            </div>
            <span
              className="text-sm leading-5"
              style={{ color: "var(--text-primary)" }}
            >
              {example.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchLogo({ size }: { size: "sm" | "lg" }) {
  const isLarge = size === "lg";
  return (
    <div
      className={`flex items-center justify-center rounded-2xl text-white ${
        isLarge ? "h-16 w-16" : "h-9 w-9 rounded-xl"
      }`}
      style={{
        background: "linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%)",
        boxShadow: isLarge
          ? "0 16px 34px color-mix(in srgb, var(--brand) 28%, transparent), 0 0 0 8px color-mix(in srgb, var(--accent) 8%, transparent)"
          : "0 2px 8px color-mix(in srgb, var(--brand) 35%, transparent)"
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className={isLarge ? "h-8 w-8" : "h-4.5 w-4.5"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={isLarge ? 2 : 2.4}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    </div>
  );
}

function ExampleIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-3.5 w-3.5",
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

type InputBarProps = {
  disabled: boolean;
  error: string | null;
  examples: string[];
  hasStarted: boolean;
  onExample: (text: string) => void;
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
      className="border-t p-3"
      style={{ borderColor: "var(--border-base)" }}
    >
      {hasStarted ? null : (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={disabled}
              onClick={() => onExample(example)}
              className="focus-ring rounded-full border px-2.5 py-1 text-[11px] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              style={{
                borderColor: "var(--border-base)",
                background: "var(--bg-subtle)",
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
          className="flex flex-1 items-center rounded-xl border transition focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
          style={{
            borderColor: "var(--border-base)",
            background: "var(--bg-subtle)"
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
            placeholder="问个 Vue 文档问题,例如 watch 和 watchEffect 的区别"
            value={query}
            className="max-h-40 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="focus-ring flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          style={{
            background:
              disabled || !query.trim()
                ? "var(--text-muted)"
                : "linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)"
          }}
          aria-label="发送"
        >
          {disabled ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.5"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
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
