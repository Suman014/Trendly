"use client";

import React, { useState } from "react";

interface ReturnConfirmData {
  return_id?: string;
  exchange_id?: string;
  status: string;
  message: string;
  refund_timeline?: string;
  next_steps?: string[];
  note?: string;
}

interface ReturnConfirmCardProps {
  data: ReturnConfirmData;
  type: "return" | "exchange";
}

export function ReturnConfirmCard({ data, type }: ReturnConfirmCardProps) {
  const id = data.return_id ?? data.exchange_id ?? "";
  const title = type === "return" ? "Return Raised" : "Exchange Raised";
  const icon = type === "return" ? "↩" : "⇄";

  return (
    <div className="return-card">
      <div className="return-card__header">
        <div className="return-card__icon" aria-hidden="true">{icon}</div>
        <div>
          <div className="return-card__title">{title}</div>
          <div className="return-card__id">{id}</div>
        </div>
      </div>
      <div className="return-card__body">{data.message}</div>
      {data.next_steps && data.next_steps.length > 0 && (
        <div className="return-card__steps">
          {data.next_steps.map((step, i) => (
            <div key={i} className="return-card__step">
              <div className="return-card__step-dot">{i + 1}</div>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
      {data.note && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: "var(--ink-muted)",
            background: "rgba(0,0,0,0.04)",
            padding: "6px 8px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {data.note}
        </div>
      )}
    </div>
  );
}

interface TraceItem {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface TracePanelProps {
  trace: TraceItem[];
}

export function TracePanel({ trace }: TracePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (trace.length === 0) {
    return (
      <div className="trace-panel">
        <div className="trace-panel__header">
          <span>🔧</span>
          <span>Tool Call Trace</span>
        </div>
        <div className="trace-panel__empty">No tool calls this turn.</div>
      </div>
    );
  }

  return (
    <div className="trace-panel">
      <div className="trace-panel__header">
        <span>🔧</span>
        <span>Tool Call Trace — {trace.length} call{trace.length !== 1 ? "s" : ""} this turn</span>
      </div>
      {trace.map((item, i) => {
        const isExpanded = expandedId === item.id;
        const resultObj = typeof item.result === "string"
          ? item.result
          : JSON.stringify(item.result, null, 2);
        const resultSuccess = typeof item.result === "object" && item.result !== null
          && "error" in (item.result as object)
          ? false
          : true;

        return (
          <div key={item.id} className="trace-item">
            <div className="trace-item__header">
              <span style={{ fontSize: 10, color: "var(--ink-muted)", fontFamily: "monospace" }}>
                {i + 1}.
              </span>
              <span className="trace-item__name">{item.name}</span>
              <span className="trace-item__arrow">→</span>
              <span
                className="trace-item__result-preview"
                style={{ color: resultSuccess ? "var(--status-eligible)" : "var(--status-refused)" }}
              >
                {resultSuccess ? "✓ ok" : "✗ error"}
              </span>
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "var(--ink-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                {isExpanded ? "▲ hide" : "▼ expand"}
              </button>
            </div>

            {isExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", marginBottom: 2 }}>Args</div>
                <div className="trace-item__body">
                  {JSON.stringify(item.args, null, 2)}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4, marginBottom: 2 }}>Result</div>
                <div className="trace-item__body">
                  {typeof resultObj === "string" ? resultObj : JSON.stringify(resultObj, null, 2)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
