"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { highlightCode } from "@/lib/highlight";

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

type MessageListProps = {
  messages: Message[];
  activeCitationId: string | null;
  activeMessageId: string | null;
  onCitationSelect: (messageId: string, citationId: string) => void;
  onFeedbackSubmit: (
    messageId: string,
    rating: FeedbackRating,
    note?: string
  ) => void;
};

export function MessageList({
  activeCitationId,
  activeMessageId,
  messages,
  onCitationSelect,
  onFeedbackSubmit
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
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {messages.map((message) => (
          <MessageBubble
            activeCitationId={activeCitationId}
            activeMessageId={activeMessageId}
            key={message.id}
            message={message}
            onCitationSelect={onCitationSelect}
            onFeedbackSubmit={onFeedbackSubmit}
          />
        ))}
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  activeCitationId: string | null;
  activeMessageId: string | null;
  message: Message;
  onCitationSelect: (messageId: string, citationId: string) => void;
  onFeedbackSubmit: (
    messageId: string,
    rating: FeedbackRating,
    note?: string
  ) => void;
};

const MessageBubble = memo(function MessageBubble({
  activeCitationId,
  activeMessageId,
  message,
  onCitationSelect,
  onFeedbackSubmit
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const isMessageActive = message.id === activeMessageId;

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
          maxWidth: "min(680px, 84%)"
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
          {!isUser && !isStreaming && !isError && message.content ? (
            <CopyButton
              className="ml-1 h-5 w-5 opacity-60 hover:opacity-100"
              label="复制回答"
              text={message.content}
            />
          ) : null}
        </div>
        <div
          className="w-full px-4 py-3 transition-colors"
          style={{
            background: isError
              ? "color-mix(in srgb, var(--danger) 8%, var(--bg-elev))"
              : isUser
                ? "linear-gradient(135deg, color-mix(in srgb, var(--brand) 18%, var(--bg-elev)), color-mix(in srgb, var(--brand) 8%, var(--bg-elev)))"
                : "var(--bg-control)",
            border: `1px solid ${
              isError
                ? "color-mix(in srgb, var(--danger) 35%, transparent)"
                : isUser
                  ? "color-mix(in srgb, var(--brand) 26%, transparent)"
                  : "var(--border-base)"
            }`,
            borderRadius: isUser
              ? "14px 6px 14px 14px"
              : "6px 14px 14px 14px",
            boxShadow: isUser ? "none" : "var(--panel-shadow)"
          }}
          role={isError ? "alert" : undefined}
        >
          {message.content || isStreaming ? (
            <MarkdownMessage
              activeCitationId={isMessageActive ? activeCitationId : null}
              content={message.content}
              isStreaming={isStreaming}
              onCitationSelect={(citationId) =>
                onCitationSelect(message.id, citationId)
              }
            />
          ) : null}
        </div>
        {!isUser && !isStreaming && !isError && message.content ? (
          <FeedbackControls
            feedback={message.feedback}
            messageId={message.id}
            onFeedbackSubmit={onFeedbackSubmit}
          />
        ) : null}
      </div>
    </article>
  );
});

function FeedbackControls({
  feedback,
  messageId,
  onFeedbackSubmit
}: {
  feedback?: FeedbackState;
  messageId: string;
  onFeedbackSubmit: (
    messageId: string,
    rating: FeedbackRating,
    note?: string
  ) => void;
}) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const isSubmitted = feedback?.status === "submitted";
  const isSubmitting = feedback?.status === "submitting";

  function submitDown() {
    onFeedbackSubmit(messageId, "down", note);
    setIsNoteOpen(false);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <FeedbackButton
          active={feedback?.rating === "up"}
          disabled={isSubmitted || isSubmitting}
          label="这个回答有帮助"
          onClick={() => onFeedbackSubmit(messageId, "up")}
          tone="up"
        />
        <FeedbackButton
          active={feedback?.rating === "down"}
          disabled={isSubmitted || isSubmitting}
          label="这个回答需要改进"
          onClick={() => setIsNoteOpen((current) => !current)}
          tone="down"
        />
        {feedback ? (
          <span
            className="ml-1 text-[11px]"
            style={{
              color:
                feedback.status === "error"
                  ? "var(--danger)"
                  : "var(--text-muted)"
            }}
          >
            {feedback.status === "submitting"
              ? "提交中"
              : feedback.status === "submitted"
                ? "已记录"
                : "提交失败"}
          </span>
        ) : null}
      </div>

      {isNoteOpen && !isSubmitted ? (
        <div
          className="rounded-xl border p-2"
          style={{
            background: "var(--bg-control)",
            borderColor: "var(--border-base)"
          }}
        >
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="可选：哪里不准确或不好用？"
            className="w-full resize-none bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsNoteOpen(false)}
              className="focus-ring rounded-lg px-2 py-1 text-xs transition hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-secondary)" }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitDown}
              disabled={isSubmitting}
              className="focus-ring rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-[var(--bg-hover)] disabled:opacity-55"
              style={{
                background: "var(--bg-inset)",
                color: "var(--danger)"
              }}
            >
              提交
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackButton({
  active,
  disabled,
  label,
  onClick,
  tone
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  tone: FeedbackRating;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        background: active ? "var(--bg-selected)" : "var(--bg-control)",
        borderColor: active
          ? tone === "up"
            ? "var(--accent)"
            : "var(--danger)"
          : "var(--border-base)",
        color: active
          ? tone === "up"
            ? "var(--accent-strong)"
            : "var(--danger)"
          : "var(--text-secondary)"
      }}
    >
      {tone === "up" ? <ThumbUpIcon /> : <ThumbDownIcon />}
    </button>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";

  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 flex-none shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        background: isUser
          ? "var(--bg-inset)"
          : "linear-gradient(135deg, var(--brand), var(--accent))",
        boxShadow: isUser
          ? "none"
          : "0 8px 18px color-mix(in srgb, var(--brand) 22%, transparent)",
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
          strokeWidth="2.1"
        >
          <path d="M7 3.75h6.2L17 7.55v12.7H7z" />
          <path d="M13 3.75v4h4" />
          <circle cx="11" cy="13" r="2.8" />
          <path d="M13.1 15.1 16 18" />
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
        <CopyButton
          className="h-6 w-6 hover:bg-[rgba(255,255,255,0.1)]"
          label="复制代码"
          style={{ color: "color-mix(in srgb, var(--code-fg) 65%, transparent)" }}
          text={code}
        />
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

type CopyButtonProps = {
  className?: string;
  label: string;
  style?: CSSProperties;
  text: string;
};

function CopyButton({ className = "", label, style, text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默忽略。
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "已复制" : label}
      title={copied ? "已复制" : label}
      className={`focus-ring inline-flex flex-none items-center justify-center rounded-md transition hover:bg-[var(--bg-hover)] ${className}`}
      style={{
        ...style,
        ...(copied ? { color: "var(--accent-strong)" } : {})
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ThumbUpIcon() {
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
      <path d="M7 10v10" />
      <path d="M15 6.5 14 10h5.2a2 2 0 0 1 1.9 2.5l-1.5 5.7A2.4 2.4 0 0 1 17.3 20H7" />
      <path d="M7 10h2.8L13 4.6a1.5 1.5 0 0 1 2.8 1.1L15 10" />
      <path d="M3 10h4v10H3z" />
    </svg>
  );
}

function ThumbDownIcon() {
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
      <path d="M17 14V4" />
      <path d="M9 17.5 10 14H4.8a2 2 0 0 1-1.9-2.5l1.5-5.7A2.4 2.4 0 0 1 6.7 4H17" />
      <path d="M17 14h-2.8L11 19.4a1.5 1.5 0 0 1-2.8-1.1L9 14" />
      <path d="M17 4h4v10h-4z" />
    </svg>
  );
}

function linkifyCitations(content: string): string {
  // 先按代码段（fence 与行内 code）切分，只在非代码文本里替换 [n]，
  // 避免 arr[0] 这类代码被误转成引用链接。
  return content
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment.replace(/\[(\d+)\]/g, "[\\[$1\\]](#citation-$1)")
    )
    .join("");
}

function completeStreamingMarkdown(content: string): string {
  const fenceMatches = content.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    return `${content}\n\`\`\``;
  }
  return content;
}
