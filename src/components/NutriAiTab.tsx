import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Droplets,
  Flame,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Square,
  Trash2,
  Utensils,
} from "lucide-react";
import {
  ActivityLevel,
  BiancoAppState,
  BodyMeasurement,
  ChatMessage,
  DeficitMode,
  MetabolicResult,
  StudentProfile,
  ToastOptions,
} from "../types";
import {
  AiLoadingPhase,
  AiRetryInfo,
  FriendlyAiError,
  generateWithFallback,
  getAiToastNotification,
  isAbortedAiError,
} from "../services/geminiService";
import { AiStreamingFooter, AiTypingIndicator } from "./AiTypingIndicator";
import { ACTIVITY_OPTIONS, DEFICIT_OPTIONS, getFirstName } from "../utils/metabolism";

const NUTRI_QUICK_PROMPTS = [
  "Montar cardápio para secar rápido",
  "Pré e pós-treino para hoje",
  "Bateu vontade de doce, o que fazer?",
  "Gerar lista de compras da semana",
];

type NutriSubSection = "chat" | "compras";

type ShoppingItemStatus = "comprar" | "ja_tenho";

type ShoppingCategory =
  | "Proteínas"
  | "Carboidratos"
  | "Frutas & Verduras"
  | "Gorduras Boas & Laticínios"
  | "Temperos & Extras";

const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  "Proteínas",
  "Carboidratos",
  "Frutas & Verduras",
  "Gorduras Boas & Laticínios",
  "Temperos & Extras",
];

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  category: ShoppingCategory;
  status: ShoppingItemStatus;
  note?: string;
}

interface StoredShoppingList {
  items: ShoppingListItem[];
  updatedAt: string;
  sourceMessageId: string | null;
  sourceLabel: string;
}

const SHOPPING_STORAGE_KEY = "personal_nutri_fit_weekly_shopping_v1";

function normalizeCategory(raw: unknown): ShoppingCategory {
  const text = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    text.includes("proteina") ||
    text.includes("carne") ||
    text.includes("frango") ||
    text.includes("peixe") ||
    text.includes("ovo")
  ) {
    return "Proteínas";
  }
  if (
    text.includes("carbo") ||
    text.includes("grao") ||
    text.includes("cereal") ||
    text.includes("raiz") ||
    text.includes("pao") ||
    text.includes("arroz")
  ) {
    return "Carboidratos";
  }
  if (
    text.includes("fruta") ||
    text.includes("verdura") ||
    text.includes("legume") ||
    text.includes("hortifruti") ||
    text.includes("vegeta") ||
    text.includes("folha")
  ) {
    return "Frutas & Verduras";
  }
  if (
    text.includes("gordura") ||
    text.includes("laticin") ||
    text.includes("queijo") ||
    text.includes("iogurte") ||
    text.includes("oleaginosa")
  ) {
    return "Gorduras Boas & Laticínios";
  }
  return "Temperos & Extras";
}

function isDietRecommendationMessage(msg: ChatMessage): boolean {
  if (msg.role !== "assistant") return false;
  if (msg.id.startsWith("welcome_nutri")) return false;
  const text = msg.content.trim();
  if (text.length < 140) return false;
  const lower = text.toLowerCase();
  const dietSignals = [
    "café da manhã",
    "cafe da manha",
    "almoço",
    "almoco",
    "jantar",
    "lanche",
    "cardápio",
    "cardapio",
    "refeição",
    "refeicao",
    "dieta",
    "pré-treino",
    "pós-treino",
    "frango",
    "ovos",
    "arroz",
    "aveia",
  ];
  let matches = 0;
  for (const sig of dietSignals) {
    if (lower.includes(sig)) matches += 1;
  }
  return matches >= 2;
}

function parseShoppingItemsFromAiText(
  rawText: string,
  previousItems: ShoppingListItem[]
): ShoppingListItem[] {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error("A resposta da IA não retornou uma lista estruturada válida.");
  }

  const jsonSlice = cleaned.slice(firstBracket, lastBracket + 1);
  const parsed = JSON.parse(jsonSlice) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Nenhum item foi identificado na lista gerada.");
  }

  const prevStatusByName = new Map<string, ShoppingItemStatus>();
  for (const prev of previousItems) {
    prevStatusByName.set(prev.name.trim().toLowerCase(), prev.status);
  }

  const seenNames = new Set<string>();
  const result: ShoppingListItem[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i] as Record<string, unknown> | null;
    if (!entry || typeof entry !== "object") continue;
    const rawName = String(entry.name ?? entry.item ?? entry.alimento ?? "").trim();
    if (!rawName) continue;
    const normKey = rawName.toLowerCase();
    if (seenNames.has(normKey)) continue;
    seenNames.add(normKey);

    const quantity = String(
      entry.quantity ?? entry.quantidade ?? "Para 7 dias"
    ).trim();
    const note = String(entry.note ?? entry.uso ?? "").trim() || undefined;
    const category = normalizeCategory(entry.category ?? entry.categoria);

    result.push({
      id: `shop_${Date.now()}_${i}`,
      name: rawName,
      quantity: quantity || "1 porção semanal",
      category,
      status: prevStatusByName.get(normKey) ?? "comprar",
      note,
    });
  }

  if (result.length === 0) {
    throw new Error("Nenhum alimento válido foi retornado pela IA.");
  }

  return result;
}

function loadStoredShoppingList(): StoredShoppingList {
  if (typeof window === "undefined") {
    return {
      items: [],
      updatedAt: "",
      sourceMessageId: null,
      sourceLabel: "",
    };
  }
  try {
    const raw = window.localStorage.getItem(SHOPPING_STORAGE_KEY);
    if (!raw) {
      return { items: [], updatedAt: "", sourceMessageId: null, sourceLabel: "" };
    }
    const parsed = JSON.parse(raw) as Partial<StoredShoppingList>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (it): it is ShoppingListItem =>
            Boolean(it) &&
            typeof it.id === "string" &&
            typeof it.name === "string" &&
            (it.status === "comprar" || it.status === "ja_tenho")
        )
      : [];
    return {
      items,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      sourceMessageId:
        typeof parsed.sourceMessageId === "string" ? parsed.sourceMessageId : null,
      sourceLabel: typeof parsed.sourceLabel === "string" ? parsed.sourceLabel : "",
    };
  } catch {
    return { items: [], updatedAt: "", sourceMessageId: null, sourceLabel: "" };
  }
}

interface NutriAiTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  latestMeasurement: BodyMeasurement | null;
  onUpdateProfile: (patch: Partial<StudentProfile>) => void;
  onSetChat: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onPersistMessage: (msg: ChatMessage) => void;
  onClearCloudChat: () => void;
  onToast: (
    message: string,
    tone?: "success" | "info" | "warning",
    options?: ToastOptions
  ) => void;
}

export const NutriAiTab: React.FC<NutriAiTabProps> = ({
  state,
  metabolism,
  latestMeasurement,
  onUpdateProfile,
  onSetChat,
  onPersistMessage,
  onClearCloudChat,
  onToast,
}) => {
  const [activeSubSection, setActiveSubSection] = useState<NutriSubSection>("chat");
  const [input, setInput] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<AiLoadingPhase>("idle");
  const [retryInfo, setRetryInfo] = useState<AiRetryInfo | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string>("Reconectar");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Weekly Shopping List State
  const [shoppingStore, setShoppingStore] = useState<StoredShoppingList>(() =>
    loadStoredShoppingList()
  );
  const [shoppingFilter, setShoppingFilter] = useState<"todos" | ShoppingItemStatus>(
    "todos"
  );
  const [shoppingGenerating, setShoppingGenerating] = useState(false);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemCategory, setNewItemCategory] =
    useState<ShoppingCategory>("Proteínas");

  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shoppingAbortRef = useRef<AbortController | null>(null);
  const latestChatRef = useRef<ChatMessage[]>(state.nutriChat);
  latestChatRef.current = state.nutriChat;
  const shoppingStoreRef = useRef<StoredShoppingList>(shoppingStore);
  shoppingStoreRef.current = shoppingStore;

  const loading = loadingPhase !== "idle";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      shoppingAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SHOPPING_STORAGE_KEY,
        JSON.stringify(shoppingStore)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [shoppingStore]);

  useEffect(() => {
    if (activeSubSection === "chat") {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.nutriChat, loadingPhase, retryInfo, activeSubSection]);

  const latestDietMessage = useMemo(() => {
    for (let i = state.nutriChat.length - 1; i >= 0; i--) {
      if (isDietRecommendationMessage(state.nutriChat[i])) {
        return state.nutriChat[i];
      }
    }
    return null;
  }, [state.nutriChat]);

  const buildNutriContext = useCallback(() => {
    return {
      studentName: state.profile.name,
      primaryGoal: state.goals.primary,
      secondaryFocuses: state.goals.focuses,
      customNote: state.goals.customNote,
      muscleToday: state.profile.muscleToday,
      level: state.profile.level,
      weeklyFrequency: state.profile.weeklyFrequency,
      weightKg: state.profile.weightKg,
      targetWeightKg: state.profile.targetWeightKg,
      heightCm: state.profile.heightCm,
      bmi: metabolism.bmi,
      bmiLabel: metabolism.bmiLabel,
      age: state.profile.age,
      sex: state.profile.sex,
      activityLabel: metabolism.activityLabel,
      deficitLabel: metabolism.deficitLabel,
      tmb: metabolism.tmb,
      get: metabolism.get,
      calorieTarget: metabolism.calorieTarget,
      proteinG: metabolism.proteinG,
      carbsG: metabolism.carbsG,
      fatG: metabolism.fatG,
      waterTargetMl: metabolism.waterTargetMl,
      latestMeasurements: latestMeasurement
        ? {
            date: latestMeasurement.date,
            weightKg: latestMeasurement.weightKg,
            neckCm: latestMeasurement.neckCm,
            chestCm: latestMeasurement.chestCm,
            waistCm: latestMeasurement.waistCm,
            abdomenCm: latestMeasurement.abdomenCm,
            hipCm: latestMeasurement.hipCm,
            armRightCm: latestMeasurement.armRightCm ?? latestMeasurement.armCm,
            armLeftCm: latestMeasurement.armLeftCm,
            thighRightCm: latestMeasurement.thighRightCm ?? latestMeasurement.thighCm,
            thighLeftCm: latestMeasurement.thighLeftCm,
            calfCm: latestMeasurement.calfCm,
          }
        : null,
    };
  }, [state.profile, state.goals, metabolism, latestMeasurement]);

  const generateWeeklyShoppingList = useCallback(
    async (options?: {
      dietMessage?: ChatMessage | null;
      silent?: boolean;
      openTab?: boolean;
    }) => {
      if (shoppingAbortRef.current) {
        shoppingAbortRef.current.abort();
      }
      const controller = new AbortController();
      shoppingAbortRef.current = controller;

      if (options?.openTab) {
        setActiveSubSection("compras");
      }

      setShoppingGenerating(true);
      setShoppingError(null);

      const targetDietMsg = options?.dietMessage ?? latestDietMessage;
      const dietExcerpt = targetDietMsg
        ? targetDietMsg.content.slice(0, 3600)
        : null;

      const prompt = dietExcerpt
        ? [
            "Converta a dieta/cardápio recomendado abaixo em uma LISTA DE COMPRAS SEMANAL (para 7 dias completos) com quantidades realistas de supermercado brasileiro.",
            "Retorne ESTRITAMENTE um array JSON válido (sem texto antes ou depois), com 12 a 22 itens agrupados nas categorias exatas:",
            '"Proteínas" | "Carboidratos" | "Frutas & Verduras" | "Gorduras Boas & Laticínios" | "Temperos & Extras".',
            'Formato obrigatório de cada objeto: {"name": "Peito de frango", "quantity": "2,1 kg", "category": "Proteínas", "note": "Almoço e jantar (7 dias)"}',
            "",
            "DIETA RECOMENDADA PELO NUTRICIONISTA IA:",
            dietExcerpt,
          ].join("\n")
        : [
            `Gere uma LISTA DE COMPRAS SEMANAL (para 7 dias completos) de comida real brasileira perfeitamente alinhada às metas do aluno (${metabolism.calorieTarget} kcal/dia, ${metabolism.proteinG}g proteínas, ${metabolism.carbsG}g carboidratos, ${metabolism.fatG}g gorduras, objetivo: ${state.goals.primary}).`,
            "Retorne ESTRITAMENTE um array JSON válido (sem texto antes ou depois), com 14 a 20 itens agrupados nas categorias exatas:",
            '"Proteínas" | "Carboidratos" | "Frutas & Verduras" | "Gorduras Boas & Laticínios" | "Temperos & Extras".',
            'Formato obrigatório de cada objeto: {"name": "Peito de frango", "quantity": "2,1 kg", "category": "Proteínas", "note": "Almoço e jantar (7 dias)"}',
          ].join("\n");

      try {
        const rawResponse = await generateWithFallback({
          endpoint: "/api/ai/nutri",
          message: prompt,
          history: [],
          signal: controller.signal,
          maxRetries: 2,
          baseDelayMs: 900,
          maxDelayMs: 6000,
          context: buildNutriContext(),
        });

        const parsedItems = parseShoppingItemsFromAiText(
          rawResponse,
          shoppingStoreRef.current.items
        );

        if (!mountedRef.current) return;

        const nextStore: StoredShoppingList = {
          items: parsedItems,
          updatedAt: new Date().toISOString(),
          sourceMessageId: targetDietMsg?.id ?? null,
          sourceLabel: targetDietMsg
            ? "Gerada automaticamente com base na dieta recomendada pela Nutri IA"
            : `Gerada pela Nutri IA para sua meta (${metabolism.calorieTarget} kcal · ${metabolism.proteinG}g prot.)`,
        };

        setShoppingStore(nextStore);
        setShoppingError(null);

        if (!options?.silent) {
          onToast(
            `Lista de compras semanal gerada com ${parsedItems.length} itens!`,
            "success"
          );
        } else {
          onToast(
            `Lista de compras semanal atualizada automaticamente (${parsedItems.length} itens)!`,
            "success",
            {
              actionLabel: "Ver lista",
              onAction: () => setActiveSubSection("compras"),
            }
          );
        }
      } catch (err) {
        if (isAbortedAiError(err)) return;
        if (!mountedRef.current) return;
        const msg =
          err instanceof FriendlyAiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Não foi possível gerar a lista de compras semanal agora.";
        setShoppingError(msg);
        if (!options?.silent) {
          onToast(msg, "warning");
        }
      } finally {
        if (shoppingAbortRef.current === controller) {
          shoppingAbortRef.current = null;
        }
        if (mountedRef.current) {
          setShoppingGenerating(false);
        }
      }
    },
    [
      latestDietMessage,
      metabolism.calorieTarget,
      metabolism.proteinG,
      metabolism.carbsG,
      metabolism.fatG,
      state.goals.primary,
      buildNutriContext,
      onToast,
    ]
  );

  // If user opens "Lista de Compras Semanal" and a newer diet recommendation exists without a synced list yet, auto-generate
  useEffect(() => {
    if (activeSubSection !== "compras") return;
    if (shoppingGenerating) return;
    if (
      shoppingStore.items.length === 0 &&
      latestDietMessage &&
      shoppingStore.sourceMessageId !== latestDietMessage.id
    ) {
      void generateWeeklyShoppingList({
        dietMessage: latestDietMessage,
        silent: false,
      });
    }
  }, [
    activeSubSection,
    shoppingGenerating,
    shoppingStore.items.length,
    shoppingStore.sourceMessageId,
    latestDietMessage,
    generateWeeklyShoppingList,
  ]);

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || abortControllerRef.current) return;

    setErrorMsg(null);
    setLastFailedPrompt(null);
    setRetryInfo(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: `nu_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const assistantId = `na_${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    const prevHistory = latestChatRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    onSetChat((prev) => [...prev, userMsg, placeholderMsg]);
    onPersistMessage(userMsg);
    setActiveAssistantId(assistantId);
    setLoadingPhase("waiting");

    let lastStreamedText = "";

    try {
      const finalText = await generateWithFallback({
        endpoint: "/api/ai/nutri",
        message: trimmed,
        history: prevHistory,
        signal: controller.signal,
        maxRetries: 3,
        baseDelayMs: 900,
        maxDelayMs: 8000,
        context: buildNutriContext(),
        onStateChange: (phase, nextRetryInfo) => {
          if (!mountedRef.current) return;
          setLoadingPhase(phase);
          setRetryInfo(nextRetryInfo ?? null);
        },
        onRetry: (info) => {
          if (!mountedRef.current) return;
          setRetryInfo(info);
        },
        onChunk: (fullText) => {
          lastStreamedText = fullText;
          onSetChat((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
        },
      });
      if (finalText.trim()) {
        const completedMsg: ChatMessage = { ...placeholderMsg, content: finalText };
        onPersistMessage(completedMsg);

        // Automatically sync the Weekly Shopping List whenever the Nutricionista IA recommends a diet/meal plan
        if (isDietRecommendationMessage(completedMsg) && mountedRef.current) {
          void generateWeeklyShoppingList({
            dietMessage: completedMsg,
            silent: true,
          });
        }
      }
    } catch (err) {
      if (isAbortedAiError(err)) {
        if (lastStreamedText.trim()) {
          onPersistMessage({ ...placeholderMsg, content: lastStreamedText });
        } else {
          onSetChat((prev) => prev.filter((m) => m.id !== assistantId));
        }
        if (mountedRef.current) {
          onToast("Resposta interrompida.", "info");
        }
        return;
      }

      const friendly = err instanceof FriendlyAiError ? err : null;
      const toastInfo = getAiToastNotification(err);
      console.error("[Nutri IA] Falha detalhada na chamada da API de IA:", {
        timestamp: new Date().toISOString(),
        endpoint: "/api/ai/nutri",
        category: toastInfo.category,
        code: friendly?.code,
        status: friendly?.status,
        model: friendly?.model,
        attempts: friendly?.attempts,
        durationMs: friendly?.durationMs,
        historyCount: prevHistory.length,
        promptPreview: trimmed.slice(0, 120),
        errorMessage: err instanceof Error ? err.message : String(err),
        error: err,
      });

      const bannerMsg = toastInfo.isUnavailable
        ? toastInfo.message
        : friendly?.message || toastInfo.message;

      if (mountedRef.current) {
        setErrorMsg(bannerMsg);
        setErrorActionLabel(toastInfo.actionLabel);
        setLastFailedPrompt(trimmed);
      }

      onToast(toastInfo.message, "warning", {
        actionLabel: toastInfo.actionLabel,
        onAction: () => {
          void sendMessage(trimmed);
        },
      });
      onSetChat((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (mountedRef.current) {
        setLoadingPhase("idle");
        setRetryInfo(null);
        setActiveAssistantId(null);
      }
    }
  };

  const handleResetChat = () => {
    abortControllerRef.current?.abort();
    onClearCloudChat();
    const firstName = getFirstName(state.profile.name);
    onSetChat([
      {
        id: `welcome_nutri_${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toISOString(),
        content: `Conversa reiniciada, **${firstName}**! Seus cálculos de IMC, TMB, GET, meta calórica, macros e medidas atualizadas já estão no meu contexto. Como posso ajudar sua alimentação hoje?`,
      },
    ]);
    setErrorMsg(null);
    setRetryInfo(null);
    onToast("Histórico da Nutricionista IA limpo.", "info");
  };

  const handleSetItemStatus = (itemId: string, status: ShoppingItemStatus) => {
    setShoppingStore((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, status } : item
      ),
    }));
  };

  const handleDeleteShoppingItem = (itemId: string) => {
    setShoppingStore((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;
    const item: ShoppingListItem = {
      id: `shop_custom_${Date.now()}`,
      name: trimmedName,
      quantity: newItemQty.trim() || "1 unidade",
      category: newItemCategory,
      status: "comprar",
      note: "Adicionado manualmente",
    };
    setShoppingStore((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      sourceLabel:
        prev.sourceLabel || "Lista de compras semanal personalizada",
      items: [item, ...prev.items],
    }));
    setNewItemName("");
    setNewItemQty("");
    onToast(`"${trimmedName}" adicionado à lista de compras!`, "success");
  };

  const handleCopyShoppingList = async () => {
    const toBuy = shoppingStore.items.filter((i) => i.status === "comprar");
    if (toBuy.length === 0) {
      onToast("Todos os itens já estão marcados como 'Já tenho'!", "info");
      return;
    }

    const lines: string[] = [
      `🛒 Lista de Compras Semanal — Personal Nutri Fit`,
      `Meta: ${metabolism.calorieTarget} kcal · ${metabolism.proteinG}g proteína`,
      "",
    ];

    for (const cat of SHOPPING_CATEGORIES) {
      const catItems = toBuy.filter((i) => i.category === cat);
      if (catItems.length === 0) continue;
      lines.push(`*${cat}*`);
      for (const item of catItems) {
        lines.push(`- [ ] ${item.name} (${item.quantity})`);
      }
      lines.push("");
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      onToast(`${toBuy.length} itens para comprar copiados para a área de transferência!`, "success");
    } catch {
      onToast("Não foi possível copiar automaticamente neste navegador.", "warning");
    }
  };

  const shoppingStats = useMemo(() => {
    const total = shoppingStore.items.length;
    const toBuy = shoppingStore.items.filter((i) => i.status === "comprar").length;
    const alreadyHave = total - toBuy;
    const readyPct = total > 0 ? Math.round((alreadyHave / total) * 100) : 0;
    return { total, toBuy, alreadyHave, readyPct };
  }, [shoppingStore.items]);

  const filteredShoppingByCategory = useMemo(() => {
    const filtered =
      shoppingFilter === "todos"
        ? shoppingStore.items
        : shoppingStore.items.filter((i) => i.status === shoppingFilter);

    return SHOPPING_CATEGORIES.map((category) => ({
      category,
      items: filtered.filter((i) => i.category === category),
    })).filter((group) => group.items.length > 0);
  }, [shoppingStore.items, shoppingFilter]);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            <span>Déficit Calórico Natural & Comida Real Brasileira</span>
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Nutricionista IA
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {activeSubSection === "chat" && (
            <button
              type="button"
              onClick={handleResetChat}
              className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] shadow-sm dark:shadow-none text-xs font-medium text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Section Switcher: Chat & Calculadora vs Lista de Compras Semanal */}
      <div
        role="tablist"
        aria-label="Sub-seções da Nutri IA"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubSection === "chat"}
          onClick={() => setActiveSubSection("chat")}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubSection === "chat"
              ? "bg-[#FF6B00] text-white shadow-sm"
              : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Calculadora & Chat Nutri IA</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubSection === "compras"}
          onClick={() => setActiveSubSection("compras")}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubSection === "compras"
              ? "bg-[#FF6B00] text-white shadow-sm"
              : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Lista de Compras Semanal</span>
          {shoppingGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : shoppingStats.total > 0 ? (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${
                activeSubSection === "compras"
                  ? "bg-white/20 text-white"
                  : "bg-[#FF6B00]/15 text-[#FF6B00]"
              }`}
            >
              {shoppingStats.toBuy} comprar
            </span>
          ) : null}
        </button>
      </div>

      {/* SUB-SEÇÃO 2: LISTA DE COMPRAS SEMANAL AUTOMÁTICA */}
      {activeSubSection === "compras" && (
        <section
          role="tabpanel"
          aria-label="Lista de Compras Semanal"
          className="space-y-5"
        >
          {/* Hero / Action Header Card */}
          <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0">
                  <ShoppingBasket className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-[#0F172A] dark:text-white">
                      Lista de Compras Semanal Automática
                    </h2>
                    {latestDietMessage && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        <Sparkles className="w-3 h-3" />
                        Sincronizada com Dieta IA
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                    {shoppingStore.sourceLabel ||
                      "Gere sua lista para 7 dias com base na dieta recomendada pela Nutricionista IA e marque o que você já tem em casa ou precisa comprar."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={shoppingGenerating}
                  onClick={() => void generateWeeklyShoppingList()}
                  className="min-h-[42px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {shoppingGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando lista com IA...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {shoppingStore.items.length > 0
                          ? "Atualizar com Dieta IA"
                          : "Gerar Lista Semanal com IA"}
                      </span>
                    </>
                  )}
                </button>

                {shoppingStore.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleCopyShoppingList()}
                    className="min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Copiar p/ Comprar</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3.5">
                <span className="text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  Total semanal
                </span>
                <p className="mt-0.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {shoppingStats.total}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">
                    {" "}
                    itens
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-[#FF6B00]/8 dark:bg-[#FF6B00]/12 border border-[#FF6B00]/40 p-3.5">
                <span className="text-[11px] font-semibold text-[#EA580C] dark:text-[#FB923C]">
                  Falta comprar
                </span>
                <p className="mt-0.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#FF6B00]">
                  {shoppingStats.toBuy}
                  <span className="text-xs font-normal text-[#EA580C] dark:text-orange-300/80">
                    {" "}
                    itens
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-emerald-500/8 dark:bg-emerald-500/12 border border-emerald-500/35 p-3.5">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Já tenho
                </span>
                <p className="mt-0.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {shoppingStats.alreadyHave}
                  <span className="text-xs font-normal text-emerald-700/80 dark:text-emerald-400/80">
                    {" "}
                    ({shoppingStats.readyPct}%)
                  </span>
                </p>
              </div>
            </div>

            {shoppingStats.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  <span>Despensa pronta para a semana</span>
                  <span className="font-mono font-bold text-[#0F172A] dark:text-white">
                    {shoppingStats.alreadyHave}/{shoppingStats.total} ({shoppingStats.readyPct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                  <div
                    style={{ width: `${shoppingStats.readyPct}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-emerald-500 transition-all duration-300"
                  />
                </div>
              </div>
            )}

            {shoppingError && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200 flex flex-wrap items-center justify-between gap-3"
              >
                <span>{shoppingError}</span>
                <button
                  type="button"
                  disabled={shoppingGenerating}
                  onClick={() => void generateWeeklyShoppingList()}
                  className="min-h-[34px] px-3 rounded-lg bg-[#FF6B00] hover:bg-[#F97316] text-white font-semibold text-xs cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>

          {/* Filter Bar + Quick Bulk Actions + Manual Add Form */}
          <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]">
                {(
                  [
                    { id: "todos", label: `Todos (${shoppingStats.total})` },
                    { id: "comprar", label: `Comprar (${shoppingStats.toBuy})` },
                    { id: "ja_tenho", label: `Já tenho (${shoppingStats.alreadyHave})` },
                  ] as { id: "todos" | ShoppingItemStatus; label: string }[]
                ).map((tab) => {
                  const active = shoppingFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setShoppingFilter(tab.id)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? "bg-[#FF6B00] text-white"
                          : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {shoppingStore.items.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShoppingStore((prev) => ({
                        ...prev,
                        items: prev.items.map((i) => ({ ...i, status: "comprar" })),
                      }))
                    }
                    className="min-h-[34px] px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    Marcar todos p/ comprar
                  </button>
                </div>
              )}
            </div>

            {/* Add Custom Item Form */}
            <form
              onSubmit={handleAddCustomItem}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]"
            >
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Adicionar alimento extra (ex.: Café em pó, Whey...)"
                className="sm:col-span-5 min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
              />
              <input
                type="text"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qtd (ex.: 500 g)"
                className="sm:col-span-3 min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
              />
              <select
                value={newItemCategory}
                onChange={(e) =>
                  setNewItemCategory(e.target.value as ShoppingCategory)
                }
                aria-label="Categoria do alimento"
                className="sm:col-span-2 min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-2.5 text-xs font-medium text-[#0F172A] dark:text-white"
              >
                {SHOPPING_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="sm:col-span-2 min-h-[42px] px-3 rounded-xl bg-[#0F172A] dark:bg-[#26262B] hover:bg-[#FF6B00] dark:hover:bg-[#FF6B00] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            </form>
          </div>

          {/* Items List Grouped by Category */}
          {shoppingGenerating && shoppingStore.items.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto" />
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Montando sua Lista de Compras Semanal...
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA] max-w-md mx-auto">
                A Nutricionista IA está calculando as quantidades semanais para 7 dias com base no seu plano alimentar e metas nutricionais.
              </p>
            </div>
          ) : shoppingStore.items.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#151518] border border-dashed border-[#CBD5E1] dark:border-[#2E2E36] p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/12 border border-[#FF6B00]/30 flex items-center justify-center mx-auto">
                <ShoppingCart className="w-6 h-6 text-[#FF6B00]" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                  Sua lista semanal está pronta para ser gerada
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                  Peça um cardápio no chat da Nutricionista IA (a lista será criada automaticamente) ou clique abaixo para gerar agora com base nas suas metas de{" "}
                  <strong className="text-[#0F172A] dark:text-white">
                    {metabolism.calorieTarget} kcal
                  </strong>{" "}
                  e{" "}
                  <strong className="text-[#0F172A] dark:text-white">
                    {metabolism.proteinG}g de proteína
                  </strong>
                  .
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void generateWeeklyShoppingList()}
                  className="min-h-[44px] px-5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Lista de Compras Semanal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubSection("chat");
                    void sendMessage("Montar cardápio completo para minha semana");
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors cursor-pointer"
                >
                  Pedir cardápio na Nutri IA primeiro
                </button>
              </div>
            </div>
          ) : filteredShoppingByCategory.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-8 text-center text-xs text-[#475569] dark:text-[#A1A1AA]">
              Nenhum item encontrado no filtro selecionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredShoppingByCategory.map((group) => (
                <div
                  key={group.category}
                  className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0] dark:border-[#26262B]">
                    <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {group.category}
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-[#64748B] dark:text-[#A1A1AA]">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {group.items.map((item) => {
                      const isHave = item.status === "ja_tenho";
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                            isHave
                              ? "bg-emerald-500/6 dark:bg-emerald-500/8 border-emerald-500/30"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-bold ${
                                  isHave
                                    ? "line-through text-[#64748B] dark:text-[#71717A]"
                                    : "text-[#0F172A] dark:text-white"
                                }`}
                              >
                                {item.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] font-mono text-[11px] font-bold text-[#FF6B00] shrink-0">
                                {item.quantity}
                              </span>
                            </div>
                            {item.note && (
                              <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#A1A1AA] truncate">
                                {item.note}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <div
                              role="group"
                              aria-label={`Status de compra para ${item.name}`}
                              className="inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetItemStatus(item.id, "comprar")
                                }
                                className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                  !isHave
                                    ? "bg-[#FF6B00] text-white"
                                    : "text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                                }`}
                              >
                                <ShoppingCart className="w-3 h-3" />
                                <span>Comprar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetItemStatus(item.id, "ja_tenho")
                                }
                                className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                  isHave
                                    ? "bg-emerald-600 text-white"
                                    : "text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>Já tenho</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteShoppingItem(item.id)}
                              aria-label={`Remover ${item.name}`}
                              title="Remover item"
                              className="min-h-[30px] min-w-[30px] rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUB-SEÇÃO 1: CALCULADORA METABÓLICA & CHAT NUTRI IA */}
      {activeSubSection === "chat" && (
        <div role="tabpanel" aria-label="Calculadora e Chat Nutricionista IA" className="space-y-6">
          {/* Metabolic Calculator Section */}
          <section
            aria-label="Calculadora Metabólica"
            className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#FF6B00]" />
                  <span>Calculadora Metabólica (Mifflin-St Jeor)</span>
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
                  Os valores atualizam seu Dashboard e são enviados automaticamente para a Nutricionista IA.
                </p>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label
                  htmlFor="calc-weight"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Peso (kg)
                </label>
                <input
                  id="calc-weight"
                  type="number"
                  step="0.5"
                  min={35}
                  max={250}
                  value={state.profile.weightKg}
                  onChange={(e) =>
                    onUpdateProfile({ weightKg: Math.max(35, Number(e.target.value) || 70) })
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="calc-height"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Altura (cm)
                </label>
                <input
                  id="calc-height"
                  type="number"
                  min={120}
                  max={230}
                  value={state.profile.heightCm}
                  onChange={(e) =>
                    onUpdateProfile({ heightCm: Math.max(120, Number(e.target.value) || 170) })
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="calc-age"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Idade
                </label>
                <input
                  id="calc-age"
                  type="number"
                  min={14}
                  max={90}
                  value={state.profile.age}
                  onChange={(e) =>
                    onUpdateProfile({ age: Math.max(14, Number(e.target.value) || 28) })
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">Sexo</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["M", "F"] as const).map((sexOpt) => {
                    const active = state.profile.sex === sexOpt;
                    return (
                      <button
                        key={sexOpt}
                        type="button"
                        onClick={() => onUpdateProfile({ sex: sexOpt })}
                        className={`min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                            : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                        }`}
                      >
                        {sexOpt === "M" ? "Masc" : "Fem"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-2">
                <label
                  htmlFor="calc-activity"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Nível de atividade
                </label>
                <select
                  id="calc-activity"
                  value={state.profile.activityLevel}
                  onChange={(e) =>
                    onUpdateProfile({ activityLevel: e.target.value as ActivityLevel })
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 text-sm font-medium text-[#0F172A] dark:text-white"
                >
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deficit Pace Selector */}
            <div>
              <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-2">
                Ritmo de déficit natural
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEFICIT_OPTIONS.map((opt) => {
                  const active = state.profile.deficitMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        onUpdateProfile({ deficitMode: opt.value as DeficitMode })
                      }
                      className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border-[#FF6B00]"
                          : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#0F172A] dark:text-white">
                          {opt.label}
                        </span>
                        <Flame
                          className={`w-4 h-4 ${
                            active ? "text-[#FF6B00]" : "text-[#94A3B8] dark:text-[#52525B]"
                          }`}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA]">{opt.detail}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calculated Results Readout */}
            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
                <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  TMB Basal
                </span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {metabolism.tmb}{" "}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kcal</span>
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
                <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  GET Diário
                </span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {metabolism.get}{" "}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kcal</span>
                </span>
              </div>

              <div className="rounded-xl bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border border-[#FF6B00]/50 dark:border-[#FF6B00]/60 p-3">
                <span className="block text-[11px] text-[#EA580C] dark:text-[#FF6B00] font-semibold">
                  Meta Calórica
                </span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {metabolism.calorieTarget}{" "}
                  <span className="text-xs font-normal text-[#EA580C] dark:text-orange-200">kcal</span>
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
                <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  Proteína (2.0g/kg)
                </span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {metabolism.proteinG}g
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
                <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  Carb / Gordura
                </span>
                <span className="mt-1 block font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {metabolism.carbsG}g{" "}
                  <span className="text-[#94A3B8] dark:text-[#52525B] font-normal">/</span>{" "}
                  {metabolism.fatG}g
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
                <span className="flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  <Droplets className="w-3 h-3 text-[#FF6B00]" /> Água (40ml/kg)
                </span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {(metabolism.waterTargetMl / 1000).toFixed(2)} L
                </span>
              </div>
            </div>
          </section>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            {NUTRI_QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(prompt)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-sm dark:shadow-none text-xs font-medium text-[#334155] dark:text-[#E4E4E7] hover:text-[#0F172A] dark:hover:text-white transition-colors text-left cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Nutri AI Chat */}
          <section
            aria-label="Chat Nutricionista IA"
            className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none flex flex-col overflow-hidden"
          >
            <div className="p-4 sm:p-5 space-y-4 max-h-[500px] overflow-y-auto">
              {state.nutriChat.map((msg) => {
                const isUser = msg.role === "user";
                const isActivePending = !isUser && msg.id === activeAssistantId;
                const isStreamingThis = isActivePending && loadingPhase === "streaming";
                const canExtractShopping =
                  !isUser && !isActivePending && isDietRecommendationMessage(msg);
                const isSyncedToThis =
                  canExtractShopping && shoppingStore.sourceMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-sm ${
                        isUser
                          ? "bg-[#FF6B00] text-white font-medium"
                          : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#1E293B] dark:text-[#E4E4E7]"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.content ? (
                        <div>
                          <div className="ai-prose">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {isStreamingThis && <AiStreamingFooter />}

                          {canExtractShopping && (
                            <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-[#64748B] dark:text-[#A1A1AA] inline-flex items-center gap-1.5">
                                {isSyncedToThis ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Lista semanal sincronizada com esta dieta</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart className="w-3.5 h-3.5 text-[#FF6B00]" />
                                    <span>Transforme este cardápio em lista semanal</span>
                                  </>
                                )}
                              </span>

                              <button
                                type="button"
                                disabled={shoppingGenerating}
                                onClick={() =>
                                  isSyncedToThis
                                    ? setActiveSubSection("compras")
                                    : void generateWeeklyShoppingList({
                                        dietMessage: msg,
                                        openTab: true,
                                      })
                                }
                                className="min-h-[34px] px-3 rounded-lg bg-[#FF6B00]/12 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-[#FF6B00]/40 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>
                                  {isSyncedToThis
                                    ? "Abrir Lista de Compras"
                                    : "Gerar Lista desta Dieta"}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <AiTypingIndicator
                          agent="nutri"
                          phase={isActivePending ? loadingPhase : "waiting"}
                          retryInfo={isActivePending ? retryInfo : null}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mx-4 mb-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200 flex flex-wrap items-center justify-between gap-3"
              >
                <span className="leading-relaxed">{errorMsg}</span>
                {lastFailedPrompt && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void sendMessage(lastFailedPrompt)}
                    className="min-h-[34px] px-3 rounded-lg bg-[#FF6B00] hover:bg-[#F97316] text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {errorActionLabel}
                  </button>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="p-3 sm:p-4 border-t border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#111114] flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  loading
                    ? loadingPhase === "retrying"
                      ? "Reconectando automaticamente com a Nutri IA..."
                      : "Nutri IA está digitando seu plano..."
                    : "Ex.: Monte 4 refeições práticas com arroz, frango, ovos e frutas..."
                }
                disabled={loading}
                className="flex-1 min-h-[46px] rounded-xl bg-white dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] disabled:opacity-65"
              />
              {loading ? (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  aria-label="Parar resposta da Nutricionista IA"
                  className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#26262B] border border-[#CBD5E1] dark:border-[#3A3A42] hover:border-[#FF6B00]/60 text-[#0F172A] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-[#FF6B00]" />
                  <span className="hidden sm:inline">Parar</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Enviar mensagem à Nutricionista IA"
                  className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

