"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Loader2, MessageSquare, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "¿Cómo funciona el arbitraje?",
  "Explica el confidence score",
  "¿Qué hace el circuit breaker?",
  "How are fees calculated?",
  "What is VWAP slippage?",
  "Explain the Strategy Lab",
];

let _id = 0;
function nextId() {
  return `msg-${Date.now()}-${++_id}`;
}

function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    // Bullet list item
    if (/^[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (!/^[-*]\s+/.test(cur)) break;
        listItems.push(cur.replace(/^[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 14, margin: "4px 0", listStyleType: "disc" }}>
          {listItems.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }
    // Numbered list item
    if (/^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (!/^\d+\.\s+/.test(cur)) break;
        listItems.push(cur.replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: 16, margin: "4px 0", listStyleType: "decimal" }}>
          {listItems.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }
    // Empty line — visual gap
    if (line.trim() === "") {
      if (nodes.length > 0) nodes.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }
    // Normal paragraph line
    nodes.push(<span key={`p-${i}`} style={{ display: "block", marginBottom: 2 }}>{renderInline(line)}</span>);
    i++;
  }
  return <>{nodes}</>;
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold**, `code`, and *italic*
  return text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return (
          <code key={i} style={{ background: "rgba(45,212,191,0.12)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: "0.85em" }}>
            {part.slice(1, -1)}
          </code>
        );
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 text-sm", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div
          className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: 26,
            height: 26,
            background: "rgba(45,212,191,0.15)",
            border: "1px solid rgba(45,212,191,0.30)",
            color: "hsl(168 86% 52%)",
          }}
        >
          <Bot size={14} />
        </div>
      )}
      <div
        className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed", isUser ? "rounded-tr-sm" : "rounded-tl-sm")}
        style={
          isUser
            ? {
                background: "rgba(45,212,191,0.15)",
                border: "1px solid rgba(45,212,191,0.25)",
                color: "hsl(210 24% 97%)",
              }
            : {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "hsl(210 24% 90%)",
              }
        }
      >
        {renderContent(msg.content)}
        {msg.streaming && (
          <span
            className="ml-0.5 inline-block animate-pulse rounded-full align-middle"
            style={{ width: 2, height: 14, background: "hsl(168 86% 52% / 0.7)", verticalAlign: "middle" }}
          />
        )}
      </div>
    </div>
  );
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola! Soy el asistente de ArbiX. Puedo explicarte el motor de arbitraje, el Risk Center, el cálculo de fees y slippage, el Strategy Lab, y cualquier otro módulo de la plataforma. ¿En qué puedo ayudarte?",
};

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const summary = useAnalyticsStore((state) => state.summary);
  const risk = useAnalyticsStore((state) => state.risk);
  const bot = useMarketStore((state) => state.bot);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setLoading(false);
    setShowSuggestions(true);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { id: nextId(), role: "user", content: trimmed };
      const asstId = nextId();
      const asstMsg: Message = { id: asstId, role: "assistant", content: "", streaming: true };

      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput("");
      setLoading(true);
      setShowSuggestions(false);

      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

      // Inject live session stats so the bot can answer "what's my P&L?" etc.
      const sessionContext = {
        mode: bot.mode,
        botStatus: bot.status,
        netPnl: summary.totalNetProfit,
        executedTrades: summary.executedOpportunities,
        rejectedTrades: summary.rejectedOpportunities,
        totalOpportunities: summary.totalOpportunities,
        circuitBreakerActive: risk.circuitBreakerActive,
        avgLatencyMs: summary.averageDetectionLatencyMs,
      };

      try {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, sessionContext }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error("API error");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data) as { choices: { delta: { content?: string } }[] };
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                accumulated += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === asstId ? { ...m, content: accumulated, streaming: true } : m))
                );
              }
            } catch {
              /* incomplete chunk */
            }
          }
        }

        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, streaming: false } : m)));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? { ...m, content: "No se pudo conectar con el asistente. Intenta de nuevo.", streaming: false }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [
      messages,
      loading,
      bot.mode,
      bot.status,
      risk.circuitBreakerActive,
      summary.averageDetectionLatencyMs,
      summary.executedOpportunities,
      summary.rejectedOpportunities,
      summary.totalNetProfit,
      summary.totalOpportunities,
    ]
  );

  return (
    <>
      {/* ── Floating button ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente ArbiX"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid rgba(45,212,191,0.50)",
          background: open ? "rgba(45,212,191,0.18)" : "rgba(6,10,16,0.95)",
          color: "hsl(168 86% 52%)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 28px rgba(45,212,191,0.22), 0 4px 24px rgba(0,0,0,0.50)",
          transition: "background 0.2s, transform 0.15s",
          backdropFilter: "blur(12px)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? <ChevronDown size={20} /> : <MessageSquare size={20} />}
      </button>

      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      <div
        aria-hidden={!open}
        style={{
          position: "fixed",
          bottom: 82,
          right: 20,
          zIndex: 9998,
          width: 360,
          maxHeight: open ? 520 : 0,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          transformOrigin: "bottom right",
          transition: "max-height 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.22s, transform 0.22s",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(8,17,26,0.97)",
          boxShadow: "0 8px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(45,212,191,0.06)",
          backdropFilter: "blur(24px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(45,212,191,0.15)",
              border: "1px solid rgba(45,212,191,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "hsl(168 86% 52%)",
              flexShrink: 0,
            }}
          >
            <Bot size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(210 24% 97%)" }}>ArbiX Assistant</div>
            <div style={{ fontSize: 10, color: "hsl(214 12% 70%)", display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "hsl(151 84% 48%)",
                  boxShadow: "0 0 5px hsl(151 84% 48%)",
                  display: "inline-block",
                }}
              />
              Online · Groq LLaMA 3.3
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              title="Limpiar conversación"
              onClick={clearChat}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "hsl(214 12% 70%)",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(210 24% 97%)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(214 12% 70%)")}
            >
              <Trash2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "hsl(214 12% 70%)",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          className="scrollbar-thin"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 0,
          }}
        >
          {messages.map((msg) => (
            <Bubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions — always available, toggle with button when collapsed */}
        {showSuggestions && !loading && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "0 14px 8px",
              flexShrink: 0,
            }}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void sendMessage(s)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 999,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "hsl(214 12% 70%)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(45,212,191,0.35)";
                  e.currentTarget.style.background = "rgba(45,212,191,0.10)";
                  e.currentTarget.style.color = "hsl(210 24% 97%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "hsl(214 12% 70%)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {/* Show suggestions toggle when they're hidden */}
        {!showSuggestions && !loading && (
          <div style={{ padding: "0 14px 6px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowSuggestions(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                color: "hsl(214 12% 55%)",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Ver sugerencias
            </button>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Pregunta sobre la plataforma…"
            disabled={loading}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              padding: "7px 12px",
              fontSize: 13,
              color: "hsl(210 24% 97%)",
              outline: "none",
              transition: "border-color 0.15s",
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(45,212,191,0.40)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: "hsl(168 86% 52%)",
              color: "hsl(170 40% 5%)",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              opacity: !input.trim() || loading ? 0.45 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(45,212,191,0.22)",
              transition: "opacity 0.15s",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </>
  );
}
