"use client";

import React from "react";

interface OrderItem {
  sku: string;
  name: string;
  category: string;
  size: string;
  qty: number;
  price: number;
  final_sale?: boolean;
  shipped?: boolean;
  backorder_eta?: string;
}

interface OrderData {
  order_id: string;
  status: string;
  placed_at: string;
  delivered_at: string | null;
  expected_delivery: string | null;
  carrier: string | null;
  tracking_number: string | null;
  payment_method: string;
  shipping_city: string;
  items: OrderItem[];
  total: number;
  cancelled_at?: string;
  refund_status?: string;
}

interface OrderCardProps {
  order: OrderData;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatPrice(p: number): string {
  return "₹" + p.toLocaleString("en-IN");
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    delivered: "Delivered",
    in_transit: "In Transit",
    delayed: "Delayed",
    lost_in_transit: "Lost in Transit",
    partially_shipped: "Partially Shipped",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

function paymentLabel(pm: string): string {
  const labels: Record<string, string> = {
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    upi: "UPI",
    cash_on_delivery: "Cash on Delivery",
    store_credit: "Store Credit",
    prepaid_card: "Prepaid Card",
  };
  return labels[pm] ?? pm;
}

export function OrderCard({ order }: OrderCardProps) {
  const statusClass = `status--${order.status}`;

  return (
    <div className="order-card">
      <div className="order-card__header">
        <span className="order-card__id">{order.order_id}</span>
        <span className={`order-card__status ${statusClass}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="order-card__body">
        {order.carrier && (
          <div className="order-card__row">
            <span className="order-card__label">Carrier</span>
            <span className="order-card__value">{order.carrier}</span>
          </div>
        )}

        {order.tracking_number && (
          <div className="order-card__row">
            <span className="order-card__label">Tracking</span>
            <span className="order-card__value" style={{ fontFamily: "monospace", fontSize: 12 }}>
              {order.tracking_number}
            </span>
          </div>
        )}

        <div className="order-card__row">
          <span className="order-card__label">Placed</span>
          <span className="order-card__value">{formatDate(order.placed_at)}</span>
        </div>

        {order.delivered_at ? (
          <div className="order-card__row">
            <span className="order-card__label">Delivered</span>
            <span className="order-card__value">{formatDate(order.delivered_at)}</span>
          </div>
        ) : order.expected_delivery ? (
          <div className="order-card__row">
            <span className="order-card__label">Expected</span>
            <span className="order-card__value">
              {formatDate(order.expected_delivery)}
              {order.status === "delayed" && (
                <span style={{ color: "var(--status-refused)", marginLeft: 6, fontSize: 11 }}>
                  ⚠ Delayed
                </span>
              )}
            </span>
          </div>
        ) : null}

        {order.cancelled_at && (
          <div className="order-card__row">
            <span className="order-card__label">Cancelled</span>
            <span className="order-card__value">{formatDate(order.cancelled_at)}</span>
          </div>
        )}

        <div className="order-card__row">
          <span className="order-card__label">Payment</span>
          <span className="order-card__value">{paymentLabel(order.payment_method)}</span>
        </div>

        <div className="order-card__row">
          <span className="order-card__label">Ship to</span>
          <span className="order-card__value">{order.shipping_city}</span>
        </div>

        <div className="order-card__divider" />

        <div className="order-card__items">
          {order.items.map((item) => (
            <div key={item.sku} className="order-card__item">
              <div className="order-card__item-info">
                <span className="order-card__item-name">
                  {item.name}
                  {item.final_sale && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        background: "var(--status-refused-bg)",
                        color: "var(--status-refused)",
                        border: "1px solid var(--status-refused-border)",
                        padding: "1px 5px",
                        borderRadius: 3,
                        marginLeft: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Final Sale
                    </span>
                  )}
                </span>
                <span className="order-card__item-meta">
                  Size {item.size} · {item.category} · Qty {item.qty} · SKU {item.sku}
                  {item.shipped === false && item.backorder_eta && (
                    <> · <span style={{ color: "var(--status-exchange)" }}>Backordered (ETA {formatDate(item.backorder_eta)})</span></>
                  )}
                </span>
              </div>
              <span className="order-card__item-price">{formatPrice(item.price)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="order-card__total">
        <span className="order-card__total-label">Order Total</span>
        <span className="order-card__total-value">{formatPrice(order.total)}</span>
      </div>
    </div>
  );
}
