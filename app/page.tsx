"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChatWindow, ChatMessage } from "@/components/ChatWindow";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";

interface SessionMeta {
  verifiedCustomerId: string | null;
  verifiedCustomerName: string | null;
}

const STARTER_CHIPS = [
  "Where is my order?",
  "I want to return an item",
  "I want to exchange for a different size",
  "What's your return policy?",
  "My order is delayed — what can I do?",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({
    verifiedCustomerId: null,
    verifiedCustomerName: null,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [input]);

  const resetChat = async () => {
    if (!confirm("Are you sure you want to reset the chat?")) return;
    try {
      await fetch("/api/chat/reset", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    setMessages([]);
    setSessionMeta({ verifiedCustomerId: null, verifiedCustomerName: null });
    setIsWidgetOpen(true);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
          credentials: "include",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? "Request failed");
        }

        const data = await res.json();

        if (data.sessionMeta) {
          setSessionMeta(data.sessionMeta);
        }

        const assistantMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: data.message ?? "I'm sorry, I didn't get a response. Please try again.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content:
            err instanceof Error && err.message.includes("API key not configured")
              ? `⚠ API key not configured. Please check your .env.local file.`
              : "Something went wrong. Please try again in a moment.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleChipClick = (chip: string) => {
    sendMessage(chip);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="storefront-page">
      {/* 1. NAVIGATION BAR */}
      <nav className="store-nav">
        <div className="store-nav__left">
          <span>WOMEN</span>
          <span>MEN</span>
          <span>HOME</span>
        </div>
        <div className="store-nav__brand">TRENDLY</div>
        <div className="store-nav__right">
          <span>SEARCH</span>
          <span>ACCOUNT</span>
          <span>CART (0)</span>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="store-hero">
        <div className="store-hero__bg">
          <Image
            src="/storefront_bg.png"
            alt="Storefront Background"
            layout="fill"
            objectFit="cover"
            priority
          />
          <div className="store-hero__overlay"></div>
        </div>
        <div className="store-hero__content">
          <h1>Effortless Elegance.</h1>
          <p>Discover the New Arrivals Collection.</p>
          <button className="store-btn-primary">Shop Now</button>
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS */}
      <section className="store-section">
        <h2 className="store-section__title">Trending Now</h2>
        <div className="product-grid">
          <div className="product-card">
            <div className="product-card__image relative">
              <Image src="/product_kurta_1786347302202.png" alt="Block-Print Kurta" layout="fill" objectFit="cover" className="rounded-md" />
            </div>
            <h3 className="product-card__title">Block-Print Kurta</h3>
            <p className="product-card__price">₹1,299</p>
          </div>
          <div className="product-card">
            <div className="product-card__image relative">
              <Image src="/product_blazer_1786347323105.png" alt="Linen Blend Blazer" layout="fill" objectFit="cover" className="rounded-md" />
            </div>
            <h3 className="product-card__title">Linen Blend Blazer</h3>
            <p className="product-card__price">₹3,499</p>
          </div>
          <div className="product-card">
            <div className="product-card__image relative">
              <Image src="/product_tote_1786347333812.png" alt="Canvas Tote Bag" layout="fill" objectFit="cover" className="rounded-md" />
            </div>
            <h3 className="product-card__title">Canvas Tote Bag</h3>
            <p className="product-card__price">₹899</p>
          </div>
          <div className="product-card">
            <div className="product-card__image relative">
              <Image src="/product_earrings_1786347344463.png" alt="Pearl Drop Earrings" layout="fill" objectFit="cover" className="rounded-md" />
            </div>
            <h3 className="product-card__title">Pearl Drop Earrings</h3>
            <p className="product-card__price">₹499</p>
          </div>
        </div>
      </section>

      {/* 4. ABOUT SECTION */}
      <section className="store-section store-section--dark">
        <div className="store-about">
          <h2>Our Philosophy</h2>
          <p>
            At Trendly, we believe that style shouldn't come at the expense of comfort.
            Our collections are carefully curated to bring you timeless pieces that make
            you feel as good as you look. Ethically sourced and beautifully crafted.
          </p>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="store-footer">
        <div className="store-footer__grid">
          <div>
            <h4>Shop</h4>
            <ul>
              <li>New Arrivals</li>
              <li>Bestsellers</li>
              <li>Sale</li>
            </ul>
          </div>
          <div>
            <h4>Support</h4>
            <ul>
              <li>Returns & Exchanges</li>
              <li>Shipping Policy</li>
              <li>FAQ</li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li>About Us</li>
              <li>Sustainability</li>
              <li>Contact</li>
            </ul>
          </div>
        </div>
        <div className="store-footer__bottom">
          <p>&copy; 2026 Trendly. All rights reserved.</p>
        </div>
      </footer>

      {/* =========================================
          FLOATING WIDGET COMPONENTS 
          ========================================= */}
          
      {/* Floating Chat Widget Toggle Button */}
      <button
        className={`widget-toggle-btn ${isWidgetOpen ? "widget-toggle-btn--hidden" : ""}`}
        onClick={() => setIsWidgetOpen(true)}
        aria-label="Ask Trendly AI"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
          <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
          <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        Ask Trendly AI
      </button>

      {/* Floating Chat Widget */}
      <div className={`widget-container ${isWidgetOpen ? "widget-container--open" : ""}`}>
        {/* Widget Header */}
        <header className="widget-header">
          <div className="widget-header__info">
            <h2 className="widget-header__brand">
              Trendly <span>Support</span>
            </h2>
            {sessionMeta.verifiedCustomerName && (
              <span className="widget-header__badge">
                Verified: {sessionMeta.verifiedCustomerName}
              </span>
            )}
          </div>
          <div className="widget-header__actions">
            <button className="widget-header__btn" onClick={resetChat} title="Reset Chat" aria-label="Reset Chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button className="widget-header__btn" onClick={() => setIsWidgetOpen(false)} title="Close Chat" aria-label="Close Chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Chat Main Area */}
        <main className="widget-main">
          {isEmpty ? (
            <div className="widget-welcome">
              <h3>Hi there! 👋</h3>
              <p>How can we help you today?</p>
              <div className="widget-chips">
                {STARTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    className="widget-chip"
                    onClick={() => handleChipClick(chip)}
                    disabled={isLoading}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ChatWindow messages={messages} isLoading={isLoading} />
          )}
        </main>

        {/* Input Area */}
        <footer className="widget-input-area">
          <form onSubmit={handleSubmit} className="widget-input-form">
            <textarea
              ref={textareaRef}
              className="widget-textarea"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              type="submit"
              className="widget-send-btn"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              {isLoading ? (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="22" strokeDashoffset="0" style={{ animation: "spin 0.8s linear infinite" }} />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M2 9L16 2L9 16L7.5 10.5L2 9Z" fill="currentColor" />
                </svg>
              )}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
