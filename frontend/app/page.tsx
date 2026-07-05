import { CitationPanel } from "@/components/CitationPanel";
import { MessageList } from "@/components/MessageList";
import { VersionPicker } from "@/components/VersionPicker";

const sampleMessages = [
  {
    id: "welcome",
    role: "assistant" as const,
    content:
      "选择框架和版本后输入问题。当前骨架已预留流式回答、citation 和版本过滤的前端边界。"
  }
];

const sampleCitations = [
  {
    id: "1",
    title: "Vue 指南 / 侦听器 / watchEffect()",
    sourceUrl: "https://cn.vuejs.org/guide/essentials/watchers.html",
    excerpt: "watchEffect 会自动追踪回调中访问到的响应式依赖。"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">VerDoc</h1>
            <p className="mt-1 text-sm text-slate-600">
              版本感知的前端框架文档问答助手
            </p>
          </div>
          <VersionPicker />
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white">
            <MessageList messages={sampleMessages} />
            <form className="border-t border-slate-200 p-4">
              <label className="sr-only" htmlFor="question">
                输入文档问题
              </label>
              <div className="flex gap-3">
                <input
                  id="question"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="例如: watch 和 watchEffect 有什么区别?"
                />
                <button
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  type="submit"
                >
                  发送
                </button>
              </div>
            </form>
          </div>
          <CitationPanel citations={sampleCitations} />
        </section>
      </div>
    </main>
  );
}
