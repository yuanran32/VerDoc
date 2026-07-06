"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { highlightCode } from "@/lib/highlight";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
};

type MessageListProps = {
  messages: Message[];
  activeCitationId: string | null;
  onCitationSelect: (citationId: string) => void;
};

export function MessageList({
  activeCitationId,
  messages,
  onCitationSelect
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    if (!shouldStickToBottomRef.current || !scrollRef.current) return;
    requestAnimationFrame(() => {
      if (scrollRef.current && shouldStickToBottomRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= 96;
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-6"
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
        {messages.map((message) => (
          <MessageBubble
            activeCitationId={activeCitationId}
            key={message.id}
            message={message}
            onCitationSelect={onCitationSelect}
          />
        ))}
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  activeCitationId: string | null;
  message: Message;
  onCitationSelect: (citationId: string) => void;
};

const MessageBubble = memo(function MessageBubble({
  activeCitationId,
  message,
  onCitationSelect
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <article
      className="flex w-full animate-fade-in-up gap-3"
      style={{ flexDirection: isUser ? "row-reverse" : "row" }}
    >
      <Avatar role={message.role} />
      <div
        className="flex min-w-0 flex-col gap-1.5"
        style={{
          alignItems: isUser ? "flex-end" : "flex-start",
          maxWidth: "min(680px, 82%)"
        }}
      >
        <div
          className="flex items-center text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {isUser ? "你" : "VerDoc"}
          {isStreaming ? (
            <span
              aria-label="正在生成"
              className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full"
              style={{
                animation: "pulse-soft 1.4s ease-in-out infinite",
                background: "var(--brand)"
              }}
            />
          ) : null}
        </div>
        <div
          className="w-full px-4 py-3 transition-colors"
          style={{
            background: isError
              ? "color-mix(in srgb, var(--danger) 8%, var(--bg-elev))"
              : isUser
                ? "color-mix(in srgb, var(--brand) 12%, var(--bg-elev))"
                : "var(--bg-elev)",
            border: `1px solid ${
              isError
                ? "color-mix(in srgb, var(--danger) 35%, transparent)"
                : isUser
                  ? "color-mix(in srgb, var(--brand) 25%, transparent)"
                  : "var(--border-base)"
            }`,
            borderRadius: isUser
              ? "0.875rem 0.25rem 0.875rem 0.875rem"
              : "0.25rem 0.875rem 0.875rem 0.875rem"
          }}
          role={isError ? "alert" : undefined}
        >
          {message.content || isStreaming ? (
            <MarkdownMessage
              activeCitationId={activeCitationId}
              content={message.content}
              isStreaming={isStreaming}
              onCitationSelect={onCitationSelect}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
});

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";

  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 flex-none shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        background: isUser ? "var(--bg-inset)" : "var(--brand)",
        boxShadow: isUser
          ? "none"
          : "0 1px 3px color-mix(in srgb, var(--brand) 45%, transparent)",
        color: isUser ? "var(--text-secondary)" : "#ffffff"
      }}
    >
      {isUser ? (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        >
          <path d="M4 6h16M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M4 6l1.5-3h13L20 6" />
          <path d="M9 11h6" />
        </svg>
      )}
    </div>
  );
}

type MarkdownMessageProps = {
  activeCitationId: string | null;
  content: string;
  isStreaming: boolean;
  onCitationSelect: (citationId: string) => void;
};

function MarkdownMessage({
  activeCitationId,
  content,
  isStreaming,
  onCitationSelect
}: MarkdownMessageProps) {
  if (!content && isStreaming) {
    return <TypingDots />;
  }

  const source = linkifyCitations(completeStreamingMarkdown(content));

  return (
    <div className="md-body">
      <ReactMarkdown
        components={buildComponents(activeCitationId, onCitationSelect)}
        remarkPlugins={[remarkGfm]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="正在生成回答">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            animation: "typing-bounce 1.2s ease-in-out infinite",
            animationDelay: `${index * 0.16}s`,
            background: "var(--text-muted)"
          }}
        />
      ))}
    </div>
  );
}

function buildComponents(
  activeCitationId: string | null,
  onCitationSelect: (citationId: string) => void
): Components {
  return {
    a({ children, href }) {
      if (href?.startsWith("#citation-")) {
        const citationId = href.replace("#citation-", "");
        return (
          <CitationBadge
            citationId={citationId}
            isActive={citationId === activeCitationId}
            onCitationSelect={onCitationSelect}
          >
            {children}
          </CitationBadge>
        );
      }

      return (
        <a
          href={href}
          rel="noreferrer"
          target="_blank"
          style={{
            color: "var(--brand-strong)",
            textDecoration: "underline",
            textUnderlineOffset: "3px"
          }}
        >
          {children}
        </a>
      );
    },
    code({ className, children }) {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        const lang = className?.replace("language-", "") ?? "text";
        const raw = String(children).replace(/\n$/, "");
        return <CodeBlock code={raw} lang={lang} />;
      }
      return <code>{children}</code>;
    },
    p({ children }) {
      return <p>{stripCursor(children)}</p>;
    }
  };
}

type CitationBadgeProps = {
  children: ReactNode;
  citationId: string;
  isActive: boolean;
  onCitationSelect: (citationId: string) => void;
};

function CitationBadge({
  children,
  citationId,
  isActive,
  onCitationSelect
}: CitationBadgeProps) {
  const badgeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    badgeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest"
    });
  }, [isActive]);

  return (
    <button
      ref={badgeRef}
      type="button"
      aria-label={`查看第 ${citationId} 条引用`}
      className={`cite-badge${isActive ? " is-active" : ""}`}
      onClick={() => onCitationSelect(citationId)}
    >
      {children}
    </button>
  );
}

function stripCursor(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.filter((child) => !isCursorMarker(child));
  }
  return node;
}

function isCursorMarker(node: ReactNode): boolean {
  return typeof node === "string" && node.includes("<CURSOR/>");
}

type CodeBlockProps = {
  code: string;
  lang: string;
};

function CodeBlock({ code, lang }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    if (code.length === 0) return;

    highlightCode(code, lang)
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return (
    <div className="code-wrap">
      <div className="code-chrome">
        <span className="dot" style={{ background: "#ff5f57" }} />
        <span className="dot" style={{ background: "#febc2e" }} />
        <span className="dot" style={{ background: "#28c840" }} />
        <span className="code-lang">{lang || "text"}</span>
      </div>
      {html ? (
        <pre>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function linkifyCitations(content: string): string {
  return content.replace(/\[(\d+)\]/g, "[\\[$1\\]](#citation-$1)");
}

function completeStreamingMarkdown(content: string): string {
  const fenceMatches = content.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    return `${content}\n\`\`\``;
  }
  return content;
}
