type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.map((message) => (
        <article
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={message.id}
        >
          <div className="mb-2 text-xs font-medium uppercase text-slate-500">
            {message.role === "assistant" ? "Assistant" : "You"}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {message.content}
          </p>
        </article>
      ))}
    </div>
  );
}
