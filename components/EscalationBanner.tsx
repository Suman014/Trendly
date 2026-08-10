"use client";

import React from "react";

interface EscalationData {
  ticket_id: string;
  created_at: string;
  priority: string;
  reason_code: string;
  summary: string;
  next_steps: string;
  support_hours: string;
  customer_name?: string | null;
}

interface EscalationBannerProps {
  data: EscalationData;
}

const REASON_LABELS: Record<string, string> = {
  LOST_IN_TRANSIT: "Lost Parcel",
  DAMAGED_ITEM: "Damaged Item",
  WRONG_ITEM: "Wrong Item",
  SECOND_EXCHANGE: "Second Exchange",
  COD_BANK_DETAILS: "COD Refund",
  POLICY_NOT_COVERED: "Policy Gap",
  CUSTOMER_FRUSTRATION: "Escalation",
  OTHER: "Escalated",
};

export function EscalationBanner({ data }: EscalationBannerProps) {
  return (
    <div className="escalation-banner">
      <div className="escalation-banner__header">
        <div className="escalation-banner__icon" aria-hidden="true">↗</div>
        <div>
          <div className="escalation-banner__title">
            Escalated to Support — {REASON_LABELS[data.reason_code] ?? "Review Required"}
          </div>
          <div className="escalation-banner__ticket">
            Ticket {data.ticket_id} · Priority: {data.priority.charAt(0).toUpperCase() + data.priority.slice(1)}
          </div>
        </div>
      </div>

      <div className="escalation-banner__body">{data.summary}</div>

      <div className="escalation-banner__next">
        <strong>What happens next:</strong> {data.next_steps}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--ink-muted)",
        }}
      >
        Support hours: {data.support_hours}
      </div>
    </div>
  );
}
