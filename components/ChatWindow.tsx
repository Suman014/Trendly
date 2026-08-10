"use client";

import React, { useEffect, useRef } from "react";
import { OrderCard } from "./OrderCard";
import { EligibilityBadge } from "./EligibilityBadge";
import { EscalationBanner } from "./EscalationBanner";
import { ReturnConfirmCard } from "./TracePanel";

// ---- Types ----

export interface ToolCallTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCallTrace?: ToolCallTrace[];
  timestamp: Date;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ---- MessageBubble ----

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`message-wrapper message-wrapper--${isUser ? "user" : "agent"}`}>
      {isUser ? (
        <div className="message-bubble message-bubble--user">{message.content}</div>
      ) : (
        <div className="message-bubble message-bubble--agent">
          <div
            className="message-content"
            dangerouslySetInnerHTML={{
              __html: message.content
                .replace(/\n\n/g, "</p><p>")
                .replace(/\n/g, "<br/>")
                .replace(/^/, "<p>")
                .replace(/$/, "</p>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        </div>
      )}
      <span className="message-meta">{formatTime(message.timestamp)}</span>
    </div>
  );
}

// ---- TypingIndicator ----

export function TypingIndicator() {
  return (
    <div className="message-wrapper message-wrapper--agent">
      <div className="typing-indicator">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

// ---- ChatWindow ----

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-window" role="log" aria-live="polite">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
