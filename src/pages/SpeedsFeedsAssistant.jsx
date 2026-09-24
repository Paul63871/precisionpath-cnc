import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Gauge, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import MessageBubble from "@/components/agents/MessageBubble";

const AGENT = "speeds_feeds_assistant";

export default function SpeedsFeedsAssistant() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const conv = await base44.agents.createConversation({
          agent_name: AGENT,
          metadata: { name: "Speeds & Feeds Setup", description: "Guided feeds and speeds walkthrough" },
        });
        setConversation(conv);
        setMessages(conv.messages || []);
        unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
        });
      } catch (e) {
        setError(e?.message || "Failed to start the assistant.");
      }
    })();
    return () => unsub();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !conversation || sending) return;
    setInput("");
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: "user", content: text });
    } catch (e) {
      setError(e?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const restart = async () => {
    setConversation(null);
    setMessages([]);
    setError(null);
    const conv = await base44.agents.createConversation({
      agent_name: AGENT,
      metadata: { name: "Speeds & Feeds Setup", description: "Guided feeds and speeds walkthrough" },
    });
    setConversation(conv);
    setMessages(conv.messages || []);
    base44.agents.subscribeToConversation(conv.id, (data) => setMessages(data.messages || []));
  };

  const busy = sending || messages.some((m) => m.role === "assistant" && m.tool_calls?.some((tc) => ["pending", "running", "in_progress"].includes(tc.status)));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
      <div className="mb-4 flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Gauge className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Speeds &amp; Feeds Assistant</h1>
            <p className="text-xs text-muted-foreground">Step-by-step help dialing in your cut.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={restart} disabled={!conversation}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Restart
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
        {messages.length === 0 && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-brand rounded-full animate-spin" />
            Starting your guided setup…
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Type your answer…"
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-snug focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={send} disabled={!input.trim() || busy}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}