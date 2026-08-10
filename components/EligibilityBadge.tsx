"use client";

import React from "react";

type EligibilityAction = "return" | "exchange_only" | "escalate" | "refuse";

interface EligibilityData {
  eligible: boolean;
  action: EligibilityAction;
  reason_code: string;
  human_readable_reason: string;
  policy_section: string;
  notes?: string;
}

interface EligibilityBadgeProps {
  data: EligibilityData;
}

const ACTION_CONFIG: Record<
  EligibilityAction,
  { icon: string; label: string }
> = {
  return: { icon: "↩", label: "Eligible for Return" },
  exchange_only: { icon: "⇄", label: "Exchange Only" },
  escalate: { icon: "↗", label: "Requires Escalation" },
  refuse: { icon: "✕", label: "Not Eligible" },
};

export function EligibilityBadge({ data }: EligibilityBadgeProps) {
  const config = ACTION_CONFIG[data.action];

  return (
    <div className={`eligibility-badge eligibility-badge--${data.action}`}>
      <div className="eligibility-badge__header">
        <span>{config.icon}</span>
        <span>{config.label}</span>
        <span className="eligibility-badge__section">{data.policy_section}</span>
      </div>
      <p className="eligibility-badge__reason">{data.human_readable_reason}</p>
      {data.notes && (
        <p className="eligibility-badge__note">
          ⚠ {data.notes}
        </p>
      )}
    </div>
  );
}
