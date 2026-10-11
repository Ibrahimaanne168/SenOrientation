"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "ai/react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  LogOut,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─── 4 Suggestions en petites bulles arrondies (chips) ───────────────── */
const SUGGESTIONS = [
  "Filières après Bac S2",
  "Comment fonctionne Campusen ?",
  "Conditions pour la bourse",
  "Débouchés d'ingénieur à l'ESP",
];

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

/* ─── Rendu Markdown sans serif, 16px, interligne 1.6, gras en 600 ─────── */
function BotMessageMarkdown({ content }: { content: string }) {
  return (
    <div className="bot-response-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Orientation Bac Scientifique", date: "Aujourd'hui" },
    { id: "2", title: "Démarches Campusen & Bourses", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── useChat Vercel AI SDK ─────────────────────────────────────── */
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    append,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Salut ! Dis-moi ta série de Bac (S1, S2, L, G...) et je t'aide à trouver ta filière.",
        createdAt: new Date(),
      },
    ],
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[Chat error]", err);
    },
  });

  /* ─── Récupération session utilisateur ──────────────────────────── */
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
    } catch {
      /* non bloquant */
    }
  }, []);

  /* ─── Auto-scroll vers le bas ───────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── Redimensionnement automatique du textarea ─────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  /* ─── Mise à jour du titre de conversation ───────────────────────── */
  useEffect(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId && c.title === "Nouvelle discussion"
          ? {
              ...c,
              title:
                lastUserMsg.content.slice(0, 30) +
                (lastUserMsg.content.length > 30 ? "…" : ""),
            }
          : c
      )
    );
  }, [messages, activeConvId]);

  /* ─── Démarrer une nouvelle discussion ───────────────────────────── */
  const handleNewChat = () => {
    const newId = Date.now().toString();
    setConversations((prev) => [
      { id: newId, title: "Nouvelle discussion", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content:
          "Salut ! Dis-moi ta série de Bac (S1, S2, L, G...) et je t'aide à trouver ta filière.",
        createdAt: new Date(),
      },
    ]);
    setSidebarOpen(false);
  };

  /* ─── Clic sur une suggestion (envoi direct) ─────────────────────── */
  const handleSuggestionClick = (question: string) => {
    if (isLoading) return;
    append({
      role: "user",
      content: question,
    });
  };

  /* ─── Touche Entrée pour envoyer ─────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ─── Copier le texte ────────────────────────────────────────────── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1E293B]">

      {/* ════════════════════════════════════════════
          PANNEAU LATÉRAL (SIDEBAR)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-[#F8FAFC] border-r border-[#E2E8F0] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* En-tête de la sidebar avec Logo officiel */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo SenOrientation"
              width={26}
              height={26}
              className="object-contain shrink-0"
              priority
            />
            <span className="font-semibold text-[15px] text-[#1E293B] tracking-tight">
              SenOrientation
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1 text-[#64748B] hover:text-[#1E293B] md:hidden"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Bouton Nouvelle discussion */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[14px] font-medium text-[#1E293B] bg-white border border-[#E2E8F0] hover:bg-slate-100/80 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4 text-[#0B4282]" />
            <span>Nouvelle discussion</span>
          </button>
        </div>

        {/* Historique des discussions */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="px-2 py-1 text-[12px] font-medium text-[#64748B]">
            Historique
          </p>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-[#0B4282] text-white font-medium"
                    : "text-[#475569] hover:bg-white hover:text-[#1E293B]"
                }`}
              >
                <MessageSquare
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-white" : "text-[#94A3B8]"
                  }`}
                />
                <span className="truncate">{conv.title}</span>
              </button>
            );
          })}
        </div>

        {/* Pied de sidebar */}
        <div className="p-3 border-t border-[#E2E8F0]">
          {userEmail ? (
            <div className="flex items-center justify-between px-2 py-1.5 text-[12.5px] text-[#475569]">
              <span className="truncate">{userEmail}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                className="text-[#64748B] hover:text-red-600 p-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 py-2 px-3 text-[13px] font-medium text-[#1E293B] bg-white border border-[#E2E8F0] hover:bg-slate-100/80 rounded-lg transition-colors w-full shadow-2xs"
            >
              <User className="w-3.5 h-3.5 text-[#0B4282]" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE PRINCIPALE (FOND BLANC PUR #FFFFFF)
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">

        {/* Liseré subtil aux 3 couleurs des flèches du logo (Bleu, Vert, Doré) */}
        <div className="flex h-[2px] w-full shrink-0" aria-hidden="true">
          <div className="flex-1 bg-[#0B67D3]" />
          <div className="flex-1 bg-[#16A34A]" />
          <div className="flex-1 bg-[#F59E0B]" />
        </div>

        {/* En-tête avec Logo SenOrientation */}
        <header className="shrink-0 h-13 border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-1.5 text-[#64748B] hover:text-[#1E293B] md:hidden"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Logo SenOrientation"
                width={26}
                height={26}
                className="object-contain shrink-0"
                priority
              />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-[#0B4282]">
                  SenOrientation
                </span>
                <span className="text-[#CBD5E1] hidden sm:inline">•</span>
                <span className="text-[13px] text-[#64748B] hidden sm:inline">
                  Guide d&apos;orientation post-Bac au Sénégal
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#475569] bg-[#F8FAFC] px-2.5 py-1 rounded-full border border-[#E2E8F0]">
              Campusen &amp; Universités publiques
            </span>
          </div>
        </header>

        {/* Zone des messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:py-8 bg-white">
          <div className="max-w-[700px] mx-auto space-y-5">

            {/* Écran d'accueil au démarrage avec logo bien visible */}
            {messages.length <= 1 && (
              <div className="pt-2 pb-1">
                <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mb-4 max-w-sm">
                  <Image
                    src="/logo.png"
                    alt="Logo SenOrientation"
                    width={40}
                    height={40}
                    className="object-contain shrink-0"
                    priority
                  />
                  <div>
                    <span className="font-semibold text-[13.5px] text-[#0B4282] block leading-tight">
                      SenOrientation
                    </span>
                    <span className="text-[12px] text-[#64748B] block mt-0.5 leading-tight">
                      Oriente-toi selon ta série et tes notes
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Fil des messages avec bulles classiques */}
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";

              if (isBot) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[88%] sm:max-w-[82%] bg-[#F1F5F9] text-[#1E293B] rounded-2xl rounded-tl-sm px-4 sm:px-5 py-3.5 relative group border border-[#E2E8F0]/60">
                      <BotMessageMarkdown content={msg.content} />

                      {/* Bouton copier discret */}
                      <div className="mt-2 pt-1 flex justify-end">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="text-[#94A3B8] hover:text-[#475569] p-0.5 rounded transition-colors"
                          title="Copier"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              /* Message de l'élève (droite, Bleu signature du logo #0B4282, texte blanc) */
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[78%] bg-[#0B4282] text-white rounded-2xl rounded-tr-sm px-4 sm:px-5 py-3 text-[15px] leading-relaxed shadow-2xs">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicateur de génération */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#F1F5F9] text-[#64748B] rounded-2xl rounded-tl-sm px-4 py-3 text-[14px] flex items-center gap-2 border border-[#E2E8F0]/60">
                  <span className="w-2 h-2 rounded-full bg-[#0B4282] animate-pulse" />
                  <span>Recherche des filières officielles...</span>
                </div>
              </div>
            )}

            {/* Message d'erreur */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[13.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  Une erreur est survenue lors de l&apos;envoi. Merci de vérifier votre connexion et de réessayer.
                </p>
              </div>
            )}

            {/* 4 Suggestions (chips) cliquables */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2">
                <p className="text-[12.5px] font-medium text-[#64748B] mb-2.5">
                  Suggestions :
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      className="text-left text-[13px] text-[#334155] bg-[#F8FAFC] hover:bg-[#EEF2F6] hover:text-[#0B4282] border border-[#E2E8F0] hover:border-[#0B4282]/40 px-3.5 py-1.5 rounded-full transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ZONE DE SAISIE FIXE EN BAS
        ════════════════════════════════════════════ */}
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[#E2E8F0]">
          <div className="max-w-[700px] mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2 focus-within:border-[#0B4282] focus-within:bg-white transition-colors"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pose ta question d'orientation..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[15px] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none resize-none leading-relaxed py-1 px-1.5 max-h-32"
              />

              {/* Bouton d'envoi en Bleu signature du logo (#0B4282) */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className="w-9 h-9 rounded-lg bg-[#0B4282] hover:bg-[#083264] text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-[#94A3B8]">
              Données issues des universités publiques et de campusen.sec.gouv.sn
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
