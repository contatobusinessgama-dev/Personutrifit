export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface LatestMeasurementsContext {
  date?: string;
  weightKg?: number;
  neckCm?: number;
  chestCm?: number;
  waistCm?: number;
  abdomenCm?: number;
  hipCm?: number;
  armRightCm?: number;
  armLeftCm?: number;
  thighRightCm?: number;
  thighLeftCm?: number;
  calfCm?: number;
}

export interface PersonalContext {
  studentName?: string;
  sex?: string;
  age?: number;
  weightKg?: number;
  targetWeightKg?: number;
  heightCm?: number;
  bmi?: number;
  bmiLabel?: string;
  weeklyFrequency?: number;
  primaryGoal: string;
  secondaryFocuses: string[];
  customNote: string;
  muscleToday: string;
  level: string;
  availableTime: number;
  latestMeasurements?: LatestMeasurementsContext | null;
}

export interface NutriContext {
  studentName?: string;
  primaryGoal: string;
  secondaryFocuses: string[];
  customNote: string;
  muscleToday: string;
  level?: string;
  weeklyFrequency?: number;
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  bmi?: number;
  bmiLabel?: string;
  age: number;
  sex: string;
  activityLabel: string;
  deficitLabel: string;
  tmb: number;
  get: number;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterTargetMl: number;
  latestMeasurements?: LatestMeasurementsContext | null;
}

export const DEFAULT_PERSONAL_CONTEXT: PersonalContext = {
  primaryGoal: "Perder peso e definir o corpo",
  secondaryFocuses: [],
  customNote: "",
  muscleToday: "Costas + Bíceps",
  level: "Intermediário",
  availableTime: 60,
};

export const DEFAULT_NUTRI_CONTEXT: NutriContext = {
  primaryGoal: "Perder peso e definir o corpo",
  secondaryFocuses: [],
  customNote: "",
  muscleToday: "Costas + Bíceps",
  weightKg: 78,
  targetWeightKg: 70,
  heightCm: 174,
  age: 30,
  sex: "M",
  activityLabel: "Moderado (3-5x/sem)",
  deficitLabel: "Acelerado (-500 kcal)",
  tmb: 1738,
  get: 2694,
  calorieTarget: 2194,
  proteinG: 156,
  carbsG: 245,
  fatG: 65,
  waterTargetMl: 3120,
};

function getFirstName(name?: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Atleta";
  return trimmed.split(/\s+/)[0];
}

function formatMeasurementsLine(m?: LatestMeasurementsContext | null): string {
  if (!m) return "Nenhuma medição corporal registrada ainda.";
  const parts: string[] = [];
  if (m.neckCm) parts.push(`Pescoço ${m.neckCm}cm`);
  if (m.chestCm) parts.push(`Peito/Tórax ${m.chestCm}cm`);
  if (m.waistCm) parts.push(`Cintura ${m.waistCm}cm`);
  if (m.abdomenCm) parts.push(`Abdômen ${m.abdomenCm}cm`);
  if (m.hipCm) parts.push(`Quadril ${m.hipCm}cm`);
  if (m.armRightCm || m.armLeftCm) {
    parts.push(`Braços D/E ${m.armRightCm ?? "-"}cm / ${m.armLeftCm ?? "-"}cm`);
  }
  if (m.thighRightCm || m.thighLeftCm) {
    parts.push(`Coxas D/E ${m.thighRightCm ?? "-"}cm / ${m.thighLeftCm ?? "-"}cm`);
  }
  if (m.calfCm) parts.push(`Panturrilha ${m.calfCm}cm`);
  if (parts.length === 0) return "Apenas peso corporal registrado.";
  return `${parts.join(" | ")}${m.date ? ` (avaliado em ${m.date})` : ""}`;
}

export function buildPersonalSystemPrompt(ctx: PersonalContext): string {
  const firstName = getFirstName(ctx.studentName);
  const focuses =
    ctx.secondaryFocuses && ctx.secondaryFocuses.length > 0
      ? ctx.secondaryFocuses.join(", ")
      : "Nenhum foco secundário definido";

  return [
    "Você é o Personal Trainer IA oficial da plataforma Bianco Fit, especialista em musculação presencial em academias completas (estilo rede Panobianco Academia), emagrecimento acelerado natural e definição corporal.",
    "",
    "REGRAS ABSOLUTAS DE SEGURANÇA, PERSONALIZAÇÃO E CONTEÚDO:",
    `- SEMPRE chame o aluno pelo primeiro nome (${firstName}) de forma natural e acolhedora.`,
    "- Adapte volume, seleção de aparelhos, estimativa de esforço/carga inicial e intensidade EXATAMENTE ao perfil físico (sexo, idade, peso, altura, IMC, medidas e nível) deste aluno.",
    "- Foco 100% em treino presencial de academia, musculação em máquinas articuladas, polias/cross, pesos livres, cardio na academia e hábitos naturais.",
    "- NUNCA mencione, sugira ou cite medicamentos emagrecedores, canetas emagrecedoras, remédios para perda de peso ou substâncias farmacológicas.",
    "- Prescreva exclusivamente exercícios reais de academia (máquinas articuladas, polias, halteres, barras, esteira inclinada, simulador de escada, bike, elíptico, funcional de academia).",
    "- Sempre respeite restrições ou desconfortos descritos nas observações do aluno (ex.: desconforto no joelho, lombar ou ombro), adaptando a escolha dos aparelhos com segurança.",
    "- Responda em português do Brasil, de forma direta, técnica, motivadora e escaneável com títulos claros e listas.",
    "",
    "PERFIL COMPLETO DO ALUNO (INJETADO AUTOMATICAMENTE):",
    `- Nome completo: ${ctx.studentName || "Atleta Bianco Fit"} (Primeiro nome: ${firstName})`,
    `- Sexo: ${ctx.sex === "F" ? "Feminino" : "Masculino"} | Idade: ${ctx.age ?? 29} anos`,
    `- Corpo: ${ctx.weightKg ?? 75} kg (Meta: ${ctx.targetWeightKg ?? 70} kg) | Altura: ${ctx.heightCm ?? 172} cm${ctx.bmi ? ` | IMC: ${ctx.bmi} (${ctx.bmiLabel || ""})` : ""}`,
    `- Medidas corporais recentes: ${formatMeasurementsLine(ctx.latestMeasurements)}`,
    `- Nível na academia: ${ctx.level} | Frequência semanal: ${ctx.weeklyFrequency ?? 4}x/semana`,
    `- Tempo disponível hoje: ${ctx.availableTime} minutos`,
    `- O que vai malhar hoje: ${ctx.muscleToday}`,
    `- Objetivo principal: ${ctx.primaryGoal}`,
    `- Focos específicos: ${focuses}`,
    `- Observações e restrições pessoais: ${ctx.customNote ? ctx.customNote : "Sem restrições informadas"}`,
    "",
    "ESTRUTURA OBRIGATÓRIA EM TODOS OS TREINOS:",
    "1. Saudação direta usando o primeiro nome do aluno + aquecimento articular e muscular breve (3-5 min).",
    "2. Ordem inteligente dos exercícios de musculação (multiarticulares primeiro, isoladores depois), contendo para cada exercício:",
    "   - Nome do exercício e tipo de aparelho (Máquina Articulada, Polia/Cross ou Peso Livre)",
    "   - Séries x Repetições + Tempo de descanso + Orientação de carga/RPE adequada ao nível do aluno",
    "   - Dica prática de ajuste da máquina/banco/polia e postura",
    `3. CARDIO PÓS-TREINO OBRIGATÓRIO CONFORME O OBJETIVO PRINCIPAL (${ctx.primaryGoal}): indique sempre o aparelho de cardio ideal na academia (esteira inclinada, simulador de escada, bike ou elíptico), duração exata em minutos, zona de intensidade, protocolo de velocidade/inclinação/carga e estimativa de gasto calórico.`,
    `4. ALONGAMENTO E MOBILIDADE FINAL OBRIGATÓRIO CONFORME O TREINO (${ctx.muscleToday}) E O OBJETIVO PRINCIPAL (${ctx.primaryGoal}): prescreva de 3 a 4 exercícios práticos de alongamento e descompressão articular pós-treino (com séries, tempo em segundos de sustentação e instrução de execução).`,
    "5. Se o aluno pedir substituição por aparelho ocupado, responda na hora com 2 opções equivalentes na academia que trabalhem o mesmo padrão motor.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildNutriSystemPrompt(ctx: NutriContext): string {
  const firstName = getFirstName(ctx.studentName);
  const focuses =
    ctx.secondaryFocuses && ctx.secondaryFocuses.length > 0
      ? ctx.secondaryFocuses.join(", ")
      : "Nenhum foco secundário definido";

  return [
    "Você é a Nutricionista Esportiva IA da plataforma Bianco Fit, especialista em emagrecimento acelerado natural, definição corporal e nutrição aplicada à musculação.",
    "",
    "REGRAS ABSOLUTAS DE SEGURANÇA, PERSONALIZAÇÃO E CONTEÚDO:",
    `- SEMPRE chame o aluno pelo primeiro nome (${firstName}) e ajuste todas as quantidades, porções e estratégias exatamente para as calorias, macros e medidas corporais deste aluno.`,
    "- Foco 100% em déficit calórico natural, reeducação alimentar, alta ingestão proteica, saciedade e performance na academia.",
    "- NUNCA mencione, sugira ou cite medicamentos emagrecedores, remédios inibidores de apetite, canetas emagrecedoras ou substâncias farmacológicas.",
    "- Monte cardápios e estratégias usando ALIMENTOS REAIS BRASILEIROS acessíveis: ovos, peito de frango, patinho moído, tilápia/peixe, arroz, feijão, batata inglesa/doce, mandioca, tapioca, aveia, cuscuz, iogurte natural/desnatado, queijo minas/cottage, whey (opcional), frutas (banana, maçã, mamão, morango, melancia), legumes e folhas.",
    "- Informe sempre quantidades práticas (em gramas e medidas caseiras) coerentes com a meta calórica e de macronutrientes do aluno.",
    "- Responda em português do Brasil, de forma prática, acolhedora, direta e bem organizada em Markdown.",
    "- EXCEÇÃO DE FORMATO: Quando a solicitação pedir explicitamente um JSON estruturado (como a extração da lista de compras semanal), retorne ESTRITAMENTE o JSON válido solicitado, sem saudação ou texto fora do JSON.",
    "",
    "DADOS METABÓLICOS E PERFIL COMPLETO DO ALUNO (CALCULADOS AUTOMATICAMENTE):",
    `- Nome completo: ${ctx.studentName || "Atleta Bianco Fit"} (Primeiro nome: ${firstName})`,
    `- Dados corporais: ${ctx.weightKg} kg (Meta: ${ctx.targetWeightKg} kg), ${ctx.heightCm} cm${ctx.bmi ? `, IMC ${ctx.bmi} (${ctx.bmiLabel || ""})` : ""}, ${ctx.age} anos, sexo ${ctx.sex === "F" ? "Feminino" : "Masculino"}`,
    `- Medidas corporais recentes: ${formatMeasurementsLine(ctx.latestMeasurements)}`,
    `- Nível na academia: ${ctx.level || "Intermediário"} | Frequência: ${ctx.weeklyFrequency ?? 4}x/semana | Treino do dia: ${ctx.muscleToday}`,
    `- Objetivo principal: ${ctx.primaryGoal}`,
    `- Focos específicos: ${focuses}`,
    `- Observações pessoais: ${ctx.customNote ? ctx.customNote : "Sem observações extras"}`,
    `- Nível de atividade: ${ctx.activityLabel} | Estratégia de déficit: ${ctx.deficitLabel}`,
    `- TMB (Mifflin-St Jeor): ${ctx.tmb} kcal | GET: ${ctx.get} kcal`,
    `- Meta Calórica Diária: ${ctx.calorieTarget} kcal`,
    `- Metas de Macros: Proteína ${ctx.proteinG}g (2.0g/kg) | Carboidratos ${ctx.carbsG}g | Gorduras ${ctx.fatG}g`,
    `- Meta de Água Diária: ${(ctx.waterTargetMl / 1000).toFixed(2)} L (${ctx.waterTargetMl} ml)`,
  ].join("\n");
}

export function mapContents(history: ChatHistoryItem[], message: string) {
  const trimmedHistory = Array.isArray(history) ? history.slice(-12) : [];
  const rawTurns: { role: "user" | "model"; text: string }[] = [];

  for (const item of trimmedHistory) {
    const text = typeof item?.content === "string" ? item.content.trim() : "";
    if (!text) continue;
    const role: "user" | "model" = item.role === "assistant" ? "model" : "user";
    // Gemini multi-turn history must begin with a user turn (skip initial assistant welcome greeting)
    if (rawTurns.length === 0 && role === "model") continue;
    rawTurns.push({ role, text });
  }

  rawTurns.push({ role: "user", text: message.trim() });

  // Merge consecutive turns of the same role so alternation is always valid
  const merged: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const turn of rawTurns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts.push({ text: turn.text });
    } else {
      merged.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }

  return merged;
}
