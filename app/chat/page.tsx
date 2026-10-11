"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  LogOut,
  User,
  ShieldCheck,
  Search,
  Mic,
  Paperclip,
  AtSign,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  Bot,
  Mail,
  Smartphone,
  HelpCircle,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Download,
  Gauge,
  Settings,
  Layers,
  ArrowRight,
  GraduationCap,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

const STARTER_QUESTIONS = [
  "Quelles filières après un Bac S2 au Sénégal ?",
  "Comment fonctionne Campusen pour l'orientation ?",
  "Quelles sont les conditions pour obtenir la bourse d'État ?",
  "Quels sont les débouchés d'ingénieur à l'ESP de Dakar ?",
];

const SEN_MODELS = [
  { id: "sen-ia-38", name: "SenIA 3.8-Max", desc: "Recommandé • RAG Campusen & MESRI" },
  { id: "gpt-4o", name: "GPT-4o Campusen", desc: "Analyse approfondie & Débouchés" },
  { id: "llama-groq", name: "Llama 3.3 Instant", desc: "Ultra-rapide (0.3s) pour mobile" },
];

const MODES = [
  { id: "orientation", label: "Mode Orientation", desc: "Conseils de filières et carrières" },
  { id: "campusen", label: "Simulation Campusen", desc: "Stratégie de vœux & critères" },
  { id: "bourses", label: "Guide Bourses", desc: "Critères, montants & réclamations" },
];

/* ─── Markdown rendu propre & lisible ─────────────────────────────────── */
function AgentMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-clean text-sm text-gray-800 leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 mt-3 mb-1.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-gray-900 mt-2.5 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-gray-800 mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-2 leading-relaxed text-[13.5px]">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2 text-[13.5px]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2 text-[13.5px]">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-950">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-emerald-500 pl-3 py-0.5 text-xs text-gray-600 bg-gray-50/70 rounded-r my-2 italic">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 font-medium"
            >
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

/* ═══════════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>("Ibrahima Anne");
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Orientation Bac S2 (Informatique & Santé)", date: "Aujourd'hui" },
    { id: "2", title: "Critères Bourse DGES & Campusen", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sélecteurs d'outils
  const [selectedModel, setSelectedModel] = useState(SEN_MODELS[0]);
  const [selectedMode, setSelectedMode] = useState(MODES[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Modals d'intégrations (Resend & Telegram)
  const [showResendModal, setShowResendModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [resendEmailInput, setResendEmailInput] = useState("");
  const [resendSent, setResendSent] = useState(false);

  // Dictée vocale
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── useChat Vercel AI SDK ─────────────────────────────────────── */
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit: chatSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Bonjour Ibrahima ! Je suis votre **Agent d'Orientation IA** pour les universités et grandes écoles du Sénégal.\n\nQuelle est votre série de Bac (ex : **S1, S2, L1, L2, G, T**) ou votre filière de prédilection ?",
        createdAt: new Date(),
      },
    ],
    body: { conversationId: activeConvId, model: selectedModel.id, mode: selectedMode.id },
  });

  /* ─── Session Supabase ───────────────────────────────────────────── */
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

  /* ─── Web Speech Recognition (Micro dictée vocale) ──────────────── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition;

      if (SpeechRecognition) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recog = new (SpeechRecognition as any)();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = "fr-FR";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recog.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsListening(false);
        };

        recog.onerror = () => setIsListening(false);
        recog.onend = () => setIsListening(false);

        recognitionRef.current = recog;
      }
    }
  }, [setInput]);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      alert("La reconnaissance vocale n'est pas supportée sur ce navigateur. Vous pouvez saisir votre message au clavier.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog = recognitionRef.current as any;
    if (isListening) {
      recog.stop();
      setIsListening(false);
    } else {
      try {
        recog.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  /* ─── Scroll auto ────────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── Textarea Auto-resize ───────────────────────────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  /* ─── Titre automatique ──────────────────────────────────────────── */
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (!last) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId && c.title === "Nouvelle session"
          ? {
              ...c,
              title: last.content.slice(0, 32) + (last.content.length > 32 ? "…" : ""),
            }
          : c
      )
    );
  }, [messages, activeConvId]);

  const handleNewChat = () => {
    const id = Date.now().toString();
    setConversations((prev) => [
      { id, title: "Nouvelle session", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(id);
    setMessages([
      {
        id: `welcome-${id}`,
        role: "assistant",
        content:
          "Bonjour ! Comment puis-je vous orienter aujourd'hui vers les meilleures opportunités académiques au Sénégal ?",
        createdAt: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendEmailReport = () => {
    if (!resendEmailInput) return;
    setResendSent(true);
    setTimeout(() => {
      setShowResendModal(false);
      setResendSent(false);
      setResendEmailInput("");
    }, 2200);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFA] text-gray-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">

      {/* ════════════════════════════════════════════
          SIDEBAR ÉPURÉE (STYLE QODER / IDE MODERNE)
      ════════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-gray-200/90 bg-[#FBFBFC] transition-all duration-200 md:static ${
          sidebarOpen ? "w-[260px] translate-x-0" : "-translate-x-full md:w-0 md:translate-x-0 md:hidden"
        }`}
      >
        {/* Header de la sidebar */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-200/70">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200/60 shadow-xs">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
              <span>Orientation</span>
            </div>
            <button
              onClick={() => setShowTelegramModal(true)}
              title="Intégrations & Extensions"
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors md:hidden"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons : New Task & Search */}
        <div className="px-3 py-2.5 space-y-1">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-950 hover:bg-gray-100/90 rounded-md transition-all text-left"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500" />
            <span>Nouvelle session</span>
          </button>

          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100/90 rounded-md transition-all text-left"
          >
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <span>Rechercher...</span>
          </button>
        </div>

        {/* Section Historique / Workspaces */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">
              Sessions d&apos;orientation
            </span>
            <button
              onClick={handleNewChat}
              title="Créer une session"
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <nav className="space-y-0.5">
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-xs text-center text-gray-400 italic">
                Aucune session enregistrée :)
              </p>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full group flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-all ${
                      isActive
                        ? "bg-gray-200/70 text-gray-900 font-medium shadow-2xs"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? "text-emerald-700" : "text-gray-400"
                        }`}
                      />
                      <span className="truncate">{conv.title}</span>
                    </div>
                  </button>
                );
              })
            )}
          </nav>

          {/* Quick shortcuts info */}
          <div className="mt-6 pt-4 border-t border-gray-200/60 px-2 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Campusen &amp; Universités SN</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Bourses d&apos;État DGES</span>
            </div>
          </div>
        </div>

        {/* Bas de sidebar : Automations & Extensions */}
        <div className="px-3 py-2 border-t border-gray-200/70 space-y-0.5">
          <button
            onClick={() => setShowResendModal(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span>Recevoir par Email (Resend)</span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 rounded font-mono">
              API
            </span>
          </button>

          <button
            onClick={() => setShowTelegramModal(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-gray-400" />
              <span>Bot Telegram &amp; Mobile</span>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-1 rounded font-mono">
              Bot
            </span>
          </button>
        </div>

        {/* Profil utilisateur (identique à la capture: Ibrahima Anne + status dot) */}
        <div className="p-3 border-t border-gray-200/70 bg-[#F9F9FB] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-900 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
              I
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-800 truncate">
                  {userEmail || "Ibrahima Anne"}
                </span>
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-100"
                  title="En ligne"
                />
              </div>
              <span className="text-[10px] text-gray-400 block leading-tight">
                Bachelier / Étudiant
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 text-gray-400">
            <button
              onClick={() => setShowResendModal(true)}
              title="Exporter / Bilan"
              className="p-1 hover:text-gray-700 hover:bg-gray-200/60 rounded"
            >
              <Gauge className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowTelegramModal(true)}
              title="Réglages & Intégrations"
              className="p-1 hover:text-gray-700 hover:bg-gray-200/60 rounded"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE CENTRALE WORKSPACE
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">

        {/* Top Header : minimaliste avec bouton pillule mobile */}
        <header className="shrink-0 h-12 border-b border-gray-200/80 px-4 sm:px-6 flex items-center justify-between bg-white/80 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir la barre latérale"
                className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors mr-1"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-900">SenOrientation</span>
              <span className="text-gray-300">/</span>
              <span className="truncate text-gray-600">Assistant Académique &amp; Campusen</span>
            </div>
          </div>

          {/* Bouton Pillule style "Get the mobile app" de la capture */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowTelegramModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 bg-gray-50/80 hover:bg-gray-100 text-[11px] font-medium text-gray-700 transition-all shadow-2xs"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              <span>Version Mobile &amp; Telegram</span>
            </button>

            <button
              onClick={() => setShowResendModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 text-[11px] text-gray-600 transition-all"
            >
              <Mail className="w-3 h-3 text-gray-500" />
              <span className="hidden sm:inline">Bilan Email</span>
            </button>
          </div>
        </header>

        {/* Zone de contenu des messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* HERO / WELCOME VIEW (Quand début de session - Reproduit fidèlement l'illustration et la grille de la capture !) */}
            {messages.length <= 1 && (
              <div className="text-center pt-4 pb-2">
                {/* Badge central façon gravure académique de la capture */}
                <div className="inline-flex items-center justify-center mb-4">
                  <div className="relative p-3.5 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100/80 border border-gray-200/90 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-100 shadow-inner">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-gray-800">1960</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">
                            MESRI
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                          Orientation Universitaire • Sénégal
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Titre héroïque Beyond Coding -> Cap sur votre Avenir */}
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-950">
                  Cap sur votre Avenir
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  Comment SenOrientation peut vous guider aujourd&apos;hui ?
                </p>

                {/* Mini matrice visuelle inspirée de la grille Sessions/Credits de la capture */}
                <div className="mt-5 p-3 rounded-xl border border-gray-200/80 bg-[#FAFAFC] max-w-lg mx-auto text-left shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2 font-medium">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-900 font-semibold">Séries &amp; Universités</span>
                      <span className="text-gray-400">Pôles d&apos;excellence</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                      Données vérifiées
                    </span>
                  </div>

                  {/* Dot matrix grid */}
                  <div className="grid grid-cols-16 sm:grid-cols-20 gap-1 opacity-70">
                    {Array.from({ length: 40 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2.5 rounded-[3px] transition-colors ${
                          idx % 7 === 0
                            ? "bg-emerald-600"
                            : idx % 5 === 0
                            ? "bg-amber-500"
                            : idx % 3 === 0
                            ? "bg-blue-400"
                            : "bg-gray-200"
                        }`}
                        title="Filière disponible sur Campusen"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rendu des messages de la discussion */}
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              return (
                <article
                  key={msg.id}
                  className={`flex gap-3 ${isAssistant ? "items-start" : "justify-end"}`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}

                  <div
                    className={`relative group ${
                      isAssistant
                        ? "flex-1 bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs"
                        : "max-w-[85%] bg-gray-900 text-white rounded-2xl rounded-tr-xs px-4 py-3 text-sm shadow-xs"
                    }`}
                  >
                    {isAssistant ? (
                      <>
                        <AgentMarkdown content={msg.content} />

                        {/* Outils sous le message de l'agent */}
                        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-gray-400 text-xs">
                          <span className="text-[10.5px] text-gray-400">
                            Sources : Universités publiques &amp; Campusen
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              title="Copier la réponse"
                              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setResendEmailInput("");
                                setShowResendModal(true);
                              }}
                              title="Recevoir cette recommandation par email"
                              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </article>
              );
            })}

            {/* Indicateur de génération */}
            {isLoading && (
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3 shadow-2xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  <span className="text-xs text-gray-500">
                    L&apos;agent consulte la base Campusen...
                  </span>
                </div>
              </div>
            )}

            {/* Questions fréquentes en tuiles rapides */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2 max-w-xl mx-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Suggestions rapides
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const fake = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
                        chatSubmit(fake, { data: { content: q } });
                      }}
                      className="text-left text-xs p-2.5 rounded-xl border border-gray-200/90 bg-white hover:border-emerald-600/60 hover:bg-emerald-50/30 transition-all text-gray-700 hover:text-gray-900 shadow-2xs flex items-center justify-between group"
                    >
                      <span className="truncate pr-1">{q}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-emerald-700 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ZONE DE SAISIE SIGNATURE (STYLE QODER DU MOCKUP)
        ════════════════════════════════════════════ */}
        <div className="shrink-0 p-4 sm:px-6 lg:px-8 pb-6 bg-white">
          <div className="max-w-2xl mx-auto">

            {/* Conteneur arrondi façon carte avec barre d'outils interne */}
            <form
              onSubmit={chatSubmit}
              className="relative rounded-2xl border border-gray-200/90 bg-white shadow-xs focus-within:border-gray-400 focus-within:shadow-sm transition-all"
            >
              {/* Zone textarea propre */}
              <div className="p-3 pb-1">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isListening
                      ? "🎙 Parlez maintenant, nous vous écoutons..."
                      : "Posez votre question d'orientation ou décrivez vos séries et notes..."
                  }
                  disabled={isLoading}
                  className="w-full resize-none border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 leading-relaxed max-h-36"
                />
              </div>

              {/* Barre d'outils inférieure intégrée dans la carte (reproduit le bas du champ de la capture) */}
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between gap-2">

                {/* Outils de gauche : +, @, mode selector */}
                <div className="flex items-center gap-1 text-gray-500">
                  <button
                    type="button"
                    onClick={() => {
                      alert("Attachement de relevé de notes ou bulletin de Bac : disponible via l'analyse OCR.");
                    }}
                    title="Joindre relevé de notes / bulletin"
                    className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInput((prev) => `${prev}@UCAD `);
                    }}
                    title="Mentionner une université (@UCAD, @UGB, @Campusen...)"
                    className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </button>

                  {/* Mode selector dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeDropdownOpen(!isModeDropdownOpen);
                        setIsModelDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <span className="text-[11px] font-medium">{selectedMode.label}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {isModeDropdownOpen && (
                      <div className="absolute bottom-8 left-0 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                        {MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              setSelectedMode(mode);
                              setIsModeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex flex-col ${
                              selectedMode.id === mode.id ? "bg-gray-50 font-semibold" : ""
                            }`}
                          >
                            <span className="text-gray-900">{mode.label}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{mode.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Outils de droite : Model badge, Mic button, Send button */}
                <div className="flex items-center gap-1.5">

                  {/* Model Selector pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelDropdownOpen(!isModelDropdownOpen);
                        setIsModeDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      <span className="text-[11px] font-medium">{selectedModel.name}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {isModelDropdownOpen && (
                      <div className="absolute bottom-8 right-0 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                        {SEN_MODELS.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex flex-col ${
                              selectedModel.id === model.id ? "bg-gray-50 font-semibold" : ""
                            }`}
                          >
                            <span className="text-gray-900">{model.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{model.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bouton Micro (Dictée vocale Web Speech API) */}
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    title={isListening ? "Arrêter la dictée" : "Maintenir pour dicter votre question"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isListening
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Bouton Envoi - style onde sonore / sombre de la capture */}
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    aria-label="Envoyer"
                    className="w-8 h-8 rounded-lg bg-emerald-900 hover:bg-emerald-950 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Note sous le champ façon "No workspace selected" */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Base documentaire officielle Campusen &amp; Universités du Sénégal</span>
              </div>
              <button
                onClick={() => setShowTelegramModal(true)}
                className="hover:text-gray-600 flex items-center gap-1 text-[10.5px]"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Aide &amp; Tuteur</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ════════════════════════════════════════════
          MODAL RESEND — BILAN PAR EMAIL
      ════════════════════════════════════════════ */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Recevoir mon Bilan par Email</h3>
                  <p className="text-xs text-gray-500">Service d&apos;envoi propulsé par Resend</p>
                </div>
              </div>
              <button
                onClick={() => setShowResendModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Recevez un récapitulatif complet de vos choix d&apos;orientation, avec les filières conseillées, les conditions d&apos;accès Campusen et les démarches de bourses directement dans votre boîte mail.
            </p>

            {resendSent ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Bilan envoyé avec succès ! Consultez votre boîte de réception.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Votre adresse e-mail
                  </label>
                  <input
                    type="email"
                    placeholder="etudiant@domaine.com"
                    value={resendEmailInput}
                    onChange={(e) => setResendEmailInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500 space-y-1">
                  <p className="font-medium text-gray-700">Contenu du rapport joint :</p>
                  <p>• Filières recommandées selon votre série</p>
                  <p>• Liste des universités sénégalaises d&apos;accueil</p>
                  <p>• Calendrier et modalités Campusen</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResendModal(false)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSendEmailReport}
                    disabled={!resendEmailInput}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-900 hover:bg-emerald-950 text-white transition-colors disabled:opacity-40"
                  >
                    Envoyer via Resend
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL TELEGRAM & MOBILE
      ════════════════════════════════════════════ */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Bot Telegram &amp; Mobile</h3>
                  <p className="text-xs text-gray-500">Accès direct sans connexion haut débit</p>
                </div>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Pour les bacheliers et lycéens au Sénégal ayant un forfait internet mobile limité, l&apos;agent d&apos;orientation est accessible directement par Telegram et WhatsApp.
            </p>

            <div className="space-y-3">
              <div className="p-3 border border-gray-200 rounded-xl bg-gray-50/70 space-y-1">
                <span className="text-xs font-semibold text-gray-800">
                  🤖 Bot Telegram : @SenOrientationBot
                </span>
                <p className="text-[11px] text-gray-500">
                  Discutez en direct, envoyez vos questions par note vocale et recevez les fiches des universités.
                </p>
              </div>

              <div className="p-3 border border-gray-200 rounded-xl bg-gray-50/70 space-y-1">
                <span className="text-xs font-semibold text-gray-800">
                  💬 WhatsApp Bot (Intégration Cloud API)
                </span>
                <p className="text-[11px] text-gray-500">
                  Recevez des alertes automatiques pour l&apos;ouverture de Campusen et la date limite des bourses.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-900 text-white hover:bg-gray-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
