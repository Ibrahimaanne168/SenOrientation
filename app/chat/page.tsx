"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  AlertCircle,
  Loader2,
  LogOut,
  User,
  Compass,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

const STARTER_QUESTIONS = [
  "Quelles sont les meilleures filières après un Bac S2 au Sénégal ?",
  "Comment fonctionne la plateforme Campusen pour l'orientation ?",
  "Quelles sont les conditions pour obtenir une bourse de l'État ?",
  "Quels sont les débouchés d'ingénieur à l'ESP de Dakar ou l'UAM ?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Bonjour ! Je suis votre **Agent d'Orientation**. Je suis là pour vous aider à choisir votre filière, votre université au Sénégal (UCAD, UGB, USSEIN, UIDT, UAM...) et vous renseigner sur les procédures Campusen et les bourses.\n\nQuelle est votre série de Bac ou votre situation actuelle ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Orientation Bac Scientifique", date: "Aujourd'hui" },
    { id: "2", title: "Démarches Campusen & Bourses", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Vérifier la session Supabase
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user && user.email) {
          setUserEmail(user.email);
        }
      });
    } catch {
      // Pas bloquant si Supabase n'est pas connecté
    }
  }, []);

  // Défilement automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Redimensionnement automatique du textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (errorMessage) setErrorMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newConv: ConversationItem = {
      id: newId,
      title: "Nouvelle discussion",
      date: "À l'instant",
    };
    setConversations([newConv, ...conversations]);
    setActiveConvId(newId);
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content:
          "Bonjour ! Comment puis-je vous guider aujourd'hui dans votre projet d'orientation au Sénégal ?",
      },
    ]);
    setErrorMessage(null);
  };

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isLoading) return;

    setErrorMessage(null);
    const userMsgId = `user-${Date.now()}`;
    const userMessage: Message = { id: userMsgId, role: "user", content: promptToSend };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId: undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Erreur serveur (${response.status}). Veuillez réessayer.`
        );
      }

      if (!response.body) {
        throw new Error("Aucun flux de réponse reçu du serveur.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMsgId = `assistant-${Date.now()}`;

      // Ajouter le message assistant vide
      setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const textContent = JSON.parse(line.slice(2));
              accumulatedText += textContent;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
                )
              );
            } catch {
              // Ignore line parse errors in stream
            }
          } else if (line.trim().length > 0 && !line.startsWith("d:") && !line.startsWith("e:")) {
            // Ligne texte brute
            accumulatedText += line;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
              )
            );
          }
        }
      }

      // Mettre à jour le titre de la conversation si c'était "Nouvelle discussion"
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId && c.title === "Nouvelle discussion"
            ? { ...c, title: promptToSend.slice(0, 30) + (promptToSend.length > 30 ? "..." : "") }
            : c
        )
      );
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Une erreur est survenue lors de la communication avec l'assistant.";
      setErrorMessage(errText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#172033]">
      {/* SIDEBAR : Fond Gris très clair (#F5F7FA) */}
      <aside
        aria-label="Historique des discussions"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-[#F5F7FA] transition-all duration-200 md:static ${
          sidebarOpen ? "w-72 translate-x-0" : "-translate-x-full md:w-0 md:translate-x-0 md:hidden"
        }`}
      >
        {/* En-tête Sidebar avec Logo Officiel */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/90 bg-white/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center p-1 shrink-0">
              <Image
                src="/logo.png"
                alt="Logo SenOrientation"
                width={28}
                height={28}
                priority
                className="object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-[#0B3B82] block leading-tight">
                SenOrientation
              </span>
              <span className="text-[11px] font-medium text-[#18A999] block leading-tight">
                Orientation SN
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer la barre latérale"
            className="p-1.5 text-slate-500 hover:text-[#0B3B82] rounded-md md:hidden"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Bouton Nouvelle Discussion */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-[#0B3B82] bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-all hover:border-[#1677E8]/40"
          >
            <Plus className="w-4 h-4 text-[#1677E8]" />
            <span>Nouvelle discussion</span>
          </button>
        </div>

        {/* Liste des conversations */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#172033]/60">
            Historique
          </div>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl text-left transition-all ${
                conv.id === activeConvId
                  ? "bg-[#1677E8]/10 text-[#0B3B82] font-semibold border-l-3 border-[#1677E8]"
                  : "text-[#172033]/80 hover:bg-white hover:text-[#0B3B82]"
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${conv.id === activeConvId ? "text-[#1677E8]" : "text-slate-400"}`} />
              <span className="truncate flex-1">{conv.title}</span>
            </button>
          ))}
        </nav>

        {/* Pied de Sidebar : État utilisateur */}
        <div className="p-3 border-t border-slate-200 bg-white/70">
          {userEmail ? (
            <div className="flex items-center justify-between text-xs text-[#172033]">
              <div className="flex items-center gap-2 truncate">
                <User className="w-4 h-4 text-[#1677E8] shrink-0" />
                <span className="truncate font-medium">{userEmail}</span>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 text-xs font-semibold text-[#0B3B82] bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-all hover:border-[#1677E8]/40"
            >
              <User className="w-3.5 h-3.5 text-[#1677E8]" />
              <span>Connexion / Sauvegarder</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ZONE CENTRALE DE CONVERSATION : Fond Blanc (#FFFFFF) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* NAVBAR : Bleu profond (#0B3B82) */}
        <header className="h-14 bg-[#0B3B82] text-white flex items-center justify-between px-4 sm:px-6 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir la barre latérale"
                className="p-1.5 text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white p-0.5 shadow-xs flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={22}
                  height={22}
                  className="object-contain"
                />
              </div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Agent IA d&apos;Orientation</span>
                {/* Badge Turquoise (#18A999) */}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#18A999] text-white shadow-2xs">
                  Sénégal
                </span>
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-blue-100 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#18A999] animate-pulse" />
            <span>Données vérifiées • Campusen & Universités SN</span>
          </div>
        </header>

        {/* Zone des messages : Fond Blanc (#FFFFFF) */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-12 space-y-6 bg-white">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Avatar Assistant avec le vrai logo.png */}
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 mt-0.5 p-1">
                    <Image
                      src="/logo.png"
                      alt="Logo SenOrientation"
                      width={22}
                      height={22}
                      className="object-contain"
                    />
                  </div>
                )}

                {/* Bulle de message : Gris très clair (#F5F7FA) pour assistant, Bleu vif (#1677E8) pour utilisateur */}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1677E8] text-white shadow-xs rounded-br-xs"
                      : "bg-[#F5F7FA] border border-slate-200/90 text-[#172033] shadow-2xs rounded-bl-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-normal">
                    {msg.content}
                  </div>
                </div>
              </article>
            ))}

            {/* État de chargement / Réflexion de l'agent */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 sm:gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 mt-0.5 p-1">
                  <Image
                    src="/logo.png"
                    alt="Logo SenOrientation"
                    width={22}
                    height={22}
                    className="object-contain animate-pulse"
                  />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-[#F5F7FA] border border-slate-200/90 text-[#172033]/80 text-sm flex items-center gap-2.5">
                  {/* Progression en Turquoise (#18A999) */}
                  <Loader2 className="w-4 h-4 animate-spin text-[#18A999]" />
                  <span className="text-xs font-medium">Recherche dans la base d&apos;orientation sénégalaise...</span>
                </div>
              </div>
            )}

            {/* Message d'erreur visible */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Suggestions d'amorçage pour l'étudiant */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-4">
                <p className="text-xs font-semibold text-[#172033]/70 mb-2.5 flex items-center gap-1.5">
                  {/* Accent / Objectifs en Or / Ambre (#F5B51B) */}
                  <Sparkles className="w-4 h-4 text-[#F5B51B]" />
                  <span>Suggestions de questions fréquentes :</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STARTER_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubmit(undefined, q)}
                      className="group text-left text-xs p-3.5 rounded-xl border border-slate-200/90 bg-[#F5F7FA] hover:bg-white hover:border-[#1677E8] text-[#172033] transition-all shadow-2xs flex items-start gap-2"
                    >
                      <Compass className="w-3.5 h-3.5 text-[#18A999] shrink-0 mt-0.5 group-hover:text-[#1677E8] transition-colors" />
                      <span className="font-medium group-hover:text-[#0B3B82] transition-colors">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* CHAMP DE SAISIE EN BAS : Fond Blanc (#FFFFFF) */}
        <div className="border-t border-slate-100 p-4 sm:p-5 bg-white">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => handleSubmit(e)}
              className="relative flex items-end gap-2 bg-[#F5F7FA] border border-slate-300 rounded-2xl p-2 focus-within:bg-white focus-within:border-[#1677E8] focus-within:ring-2 focus-within:ring-[#1677E8]/20 transition-all shadow-2xs"
            >
              <label htmlFor="chat-input" className="sr-only">
                Posez votre question d&apos;orientation
              </label>
              <textarea
                id="chat-input"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question d'orientation (ex: après un Bac S2, bourse...)"
                disabled={isLoading}
                aria-label="Votre question d'orientation"
                className="w-full resize-none bg-transparent px-3 py-1.5 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none max-h-40 overflow-y-auto"
              />
              {/* Bouton Envoyer : Bleu vif (#1677E8) */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className="p-2.5 bg-[#1677E8] hover:bg-[#1263c7] text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 shadow-2xs"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
            <p className="text-[11px] text-center text-[#172033]/60 mt-2">
              L&apos;agent s&apos;appuie exclusivement sur les données officielles des universités sénégalaises et de Campusen.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
