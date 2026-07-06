export type SseEvent = {
  event?: string;
  data: string;
};

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseSseChunk(chunk);
      if (event) {
        yield event;
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const event = parseSseChunk(buffer);
    if (event) {
      yield event;
    }
  }
}

function parseSseChunk(chunk: string): SseEvent | null {
  const lines = chunk.split(/\r?\n/);
  let event: string | undefined;
  const data: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join("\n")
  };
}
