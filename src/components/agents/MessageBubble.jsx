import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { icon: Loader2, cls: "text-muted-foreground animate-spin", label: "Pending" },
  running: { icon: Loader2, cls: "text-muted-foreground animate-spin", label: "Running" },
  in_progress: { icon: Loader2, cls: "text-brand animate-spin", label: "Working" },
  completed: { icon: CheckCircle2, cls: "text-emerald-500", label: "Done" },
  success: { icon: CheckCircle2, cls: "text-emerald-500", label: "Done" },
  failed: { icon: XCircle, cls: "text-destructive", label: "Failed" },
  error: { icon: XCircle, cls: "text-destructive", label: "Error" },
};

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS[toolCall.status] || STATUS.pending;
  const Icon = status.icon;
  const proj = toolCall.display_projection || {};
  const hidden = proj.hide_details && proj.details_redacted;
  const label = toolCall.status === "failed" || toolCall.status === "error"
    ? (proj.error_label || status.label)
    : ["pending", "running", "in_progress"].includes(toolCall.status)
      ? (proj.active_label || status.label)
      : (proj.label || status.label);

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }
  let parsedResults = toolCall.results;
  if (typeof parsedResults === "string") {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const failed = toolCall.status === "failed" || toolCall.status === "error" ||
    /error|failed/i.test(typeof toolCall.results === "string" ? toolCall.results : "") ||
    (parsedResults && typeof parsedResults === "object" && parsedResults.success === false);

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => !hidden && setExpanded((e) => !e)}
        className={cn("flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 min-h-[32px]", !hidden && "hover:bg-muted")}
      >
        <Icon className={cn("w-3.5 h-3.5", failed ? "text-destructive" : status.cls)} />
        <span className="font-medium capitalize">{toolCall.name?.replace(/_/g, " ")}</span>
        <span className={cn("text-muted-foreground", failed && "text-destructive")}>· {label}</span>
        {!hidden && <ChevronDown className={cn("w-3 h-3 ml-auto text-muted-foreground transition-transform", expanded && "rotate-180")} />}
      </button>
      {expanded && !hidden && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {parsedArgs && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Parameters</div>
              <pre className="rounded-md bg-muted/50 p-2 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults !== undefined && parsedResults !== null && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Result</div>
              <pre className={cn("rounded-md p-2 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words", failed ? "bg-destructive/10" : "bg-muted/50")}>{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5", isUser ? "bg-brand text-white rounded-br-md" : "bg-card border border-border rounded-bl-md")}>
        {message.content && (
          isUser
            ? <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            : <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:mb-1 prose-headings:mt-2">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, i) => <FunctionDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}