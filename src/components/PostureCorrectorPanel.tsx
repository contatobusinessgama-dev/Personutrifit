import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import { EXERCISES, MUSCLE_GROUPS, WORKOUT_COMBOS } from "../data/exercises";
import {
  BiancoAppState,
  ExerciseItem,
  MuscleGroupId,
  TabId,
} from "../types";

interface PostureBiomechanicsProfile {
  patternLabel: string;
  cadence: string;
  keyAngles: string;
  primaryRiskArea: string;
  checkpoints: string[];
  correctionCue: string;
}

const MUSCLE_BIOMECHANICS: Record<MuscleGroupId, PostureBiomechanicsProfile> = {
  costas: {
    patternLabel: "Puxada & Retração Escapular",
    cadence: "1s puxada · 1s pico · 2–3s retorno",
    keyAngles: "Tronco neutro · cotovelos próximos a 30–45°",
    primaryRiskArea: "Lombar e elevação excessiva do trapézio",
    checkpoints: [
      "Ombros longe das orelhas antes de iniciar a puxada",
      "Peito aberto e coluna lombar firme sem balançar o tronco",
      "Cotovelos guiando o movimento em direção às costelas/quadril",
    ],
    correctionCue:
      "Reduza 10–15% da carga se precisar inclinar o tronco para trás no início da repetição.",
  },
  peito: {
    patternLabel: "Empurrada Horizontal & Estabilidade Escapular",
    cadence: "2–3s descida · pausa suave · 1s subida",
    keyAngles: "Cotovelos a ~45° do tronco · punhos neutros",
    primaryRiskArea: "Ombro anterior e punhos hiperestendidos",
    checkpoints: [
      "Escápulas retraídas e apoiadas firmemente no banco",
      "Cotovelos alinhados abaixo da linha dos ombros (~45°)",
      "Pés inteiros no chão gerando base estável sem perder o apoio glúteo",
    ],
    correctionCue:
      "Aproxime levemente os cotovelos das costelas em vez de abrir a 90° para proteger o manguito rotador.",
  },
  quadriceps: {
    patternLabel: "Dominância de Joelho & Alinhamento Patelar",
    cadence: "3s descida controlada · 1s subida firme",
    keyAngles: "Joelhos alinhados ao 2º dedo do pé · coluna neutra",
    primaryRiskArea: "Valgo de joelho e retroversão lombar",
    checkpoints: [
      "Calcanhares 100% firmes no apoio durante toda a amplitude",
      "Joelhos acompanhando a direção das pontas dos pés (sem fechar para dentro)",
      "Abdômen travado (bracing) mantendo o quadril estável sem descolar a lombar",
    ],
    correctionCue:
      "Empurre suavemente os joelhos para fora na subida e interrompa a descida antes de a pelve girar.",
  },
  posterior_gluteos: {
    patternLabel: "Dobradiça de Quadril (Hip Hinge) & Cadeia Posterior",
    cadence: "3s alongamento · 1s contração máxima de glúteo",
    keyAngles: "Quadril para trás · coluna reta da nuca ao sacro",
    primaryRiskArea: "Flexão lombar sob carga ou hiperextensão no topo",
    checkpoints: [
      "Queixo levemente recolhido acompanhando o alinhamento da coluna",
      "Movimento nasce no quadril sem arredondar a região lombar",
      "Contração firme dos glúteos no topo sem jogar a lombar para trás",
    ],
    correctionCue:
      "Imagine fechar uma porta atrás de você com o quadril mantendo as costelas conectadas ao abdômen.",
  },
  ombros: {
    patternLabel: "Plano Escapular & Controle Overhead",
    cadence: "1–2s subida · 1s topo · 2–3s descida",
    keyAngles: "Braços ~30° à frente do plano lateral · core ativo",
    primaryRiskArea: "Impacto subacromial e compensação lombar",
    checkpoints: [
      "Costelas baixas e glúteos contraídos evitando arquear a lombar",
      "Elevação no plano escapular (leve avanço de 30° à frente do corpo)",
      "Pescoço relaxado sem encolher os ombros no final do movimento",
    ],
    correctionCue:
      "Trabalhe até a altura dos ombros nas elevações e evite usar impulso das pernas para subir o peso.",
  },
  biceps_triceps: {
    patternLabel: "Isolamento Articular com Úmero Fixo",
    cadence: "1s concêntrica · 1s pico · 3s excêntrica",
    keyAngles: "Cotovelos ancorados · punhos alinhados ao antebraço",
    primaryRiskArea: "Balanço de tronco e sobrecarga de punhos",
    checkpoints: [
      "Braços (úmero) estáveis ao lado do tronco sem avançar os cotovelos",
      "Punhos retos sem dobrar para trás ou para dentro sob carga",
      "Retorno completo e controlado evitando soltar o peso por gravidade",
    ],
    correctionCue:
      "Encoste as escápulas mentalmente para trás e trave o quadril — apenas o antebraço deve se mover.",
  },
  abdomen_panturrilha: {
    patternLabel: "Estabilização de Core & Amplitude Completa",
    cadence: "2s contração · 1–2s isometria · 2s retorno",
    keyAngles: "Pelve encaixada · alinhamento cabeça–ombro–quadril",
    primaryRiskArea: "Queda da lombar ou repetições curtas sem controle",
    checkpoints: [
      "Abdômen contraído puxando o umbigo suavemente para dentro",
      "Respiração ativa soltando o ar no ponto de maior tensão",
      "Movimento lento sem usar impulso da cabeça ou pescoço",
    ],
    correctionCue:
      "Mantenha o olhar neutro e faça pausa de 1 segundo no pico para eliminar o efeito elástico.",
  },
  lombar_joelho: {
    patternLabel: "Proteção Articular & Estabilização Profunda",
    cadence: "2s ativação · 3s isometria · 2s retorno suave",
    keyAngles: "Amplitude segura indolor (45–60° no joelho) · coluna neutra",
    primaryRiskArea: "Compressão patelar e cisalhamento lombar",
    checkpoints: [
      "Zero dor aguda — respeite estritamente a amplitude confortável",
      "Ativação conjunta de glúteo e abdômen profundo antes de mover",
      "Respiração diafragmática fluida sem prender o ar na isometria",
    ],
    correctionCue:
      "Priorize estabilidade e controle isométrico sobre carga externa até dominar o alinhamento.",
  },
};

function normalizeText(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferMuscleGroupsFromWorkoutText(text: string): MuscleGroupId[] {
  const norm = normalizeText(text);
  const groups: MuscleGroupId[] = [];
  if (norm.includes("lombar") || norm.includes("joelho") || norm.includes("terapeut")) {
    groups.push("lombar_joelho");
  }
  if (norm.includes("costa") || norm.includes("dorsal") || norm.includes("puxar")) {
    groups.push("costas");
  }
  if (norm.includes("peito") || norm.includes("peitoral") || norm.includes("empurrar")) {
    groups.push("peito");
  }
  if (norm.includes("perna") || norm.includes("quadriceps") || norm.includes("inferior")) {
    groups.push("quadriceps");
  }
  if (norm.includes("gluteo") || norm.includes("posterior")) {
    groups.push("posterior_gluteos");
  }
  if (norm.includes("ombro") || norm.includes("deltoide")) {
    groups.push("ombros");
  }
  if (norm.includes("bicep") || norm.includes("tricep") || norm.includes("braco")) {
    groups.push("biceps_triceps");
  }
  if (norm.includes("abdom") || norm.includes("core") || norm.includes("panturrilha")) {
    groups.push("abdomen_panturrilha");
  }
  return groups;
}

interface RankedExerciseGuide {
  exercise: ExerciseItem;
  rank: number;
  frequencyScore: number;
  sessionsCount: number;
  completedSetsCount: number;
  lastWeightKg: number;
  sourceLabel: string;
  biomechanics: PostureBiomechanicsProfile;
}

/** Crisp domain-specific biomechanical posture SVG diagram */
const PostureDiagramSvg: React.FC<{ muscleGroup: MuscleGroupId; exerciseName: string }> = ({
  muscleGroup,
  exerciseName,
}) => {
  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3.5 bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white select-none">
      <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] dark:text-[#A1A1AA]">
        <span>Guia Biomecânico</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          Eixo Neutro
        </span>
      </div>

      <svg
        viewBox="0 0 280 156"
        role="img"
        aria-label={`Diagrama postural para ${exerciseName}`}
        className="w-full h-[132px] my-1"
      >
        {/* Subtle technical grid */}
        <defs>
          <pattern id={`grid-${muscleGroup}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.06"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect x="0" y="0" width="280" height="156" fill={`url(#grid-${muscleGroup})`} rx="8" />

        {muscleGroup === "costas" && (
          <g>
            {/* Neutral spine vertical guide */}
            <line x1="126" y1="22" x2="112" y2="128" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="4 4" />
            {/* Head */}
            <circle cx="126" cy="34" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Torso slightly angled */}
            <line x1="124" y1="45" x2="116" y2="96" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Pelvis & legs seated */}
            <line x1="116" y1="96" x2="156" y2="96" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="156" y1="96" x2="158" y2="132" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Arm pulling back */}
            <line x1="123" y1="54" x2="156" y2="66" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            <line x1="156" y1="66" x2="184" y2="60" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            {/* Pull vector arrow */}
            <path d="M 192 60 L 166 60 M 172 55 L 166 60 L 172 65" fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Scapula highlight */}
            <circle cx="123" cy="54" r="5" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="1.8" />
            {/* Labels */}
            <text x="16" y="42" fill="#16A34A" fontSize="9.5" fontWeight="600">Coluna neutra</text>
            <text x="16" y="60" fill="currentColor" fillOpacity="0.7" fontSize="9">Escápula baixa</text>
            <text x="188" y="48" fill="#FF6B00" fontSize="9.5" fontWeight="600">Tração dorsal</text>
            <text x="174" y="128" fill="currentColor" fillOpacity="0.55" fontSize="8.5">Sem balanço lombar</text>
          </g>
        )}

        {muscleGroup === "peito" && (
          <g>
            {/* Bench */}
            <line x1="56" y1="108" x2="210" y2="108" stroke="currentColor" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
            {/* Neutral spine / scapular anchor */}
            <line x1="86" y1="98" x2="168" y2="98" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 3" />
            {/* Head */}
            <circle cx="72" cy="96" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Torso on bench */}
            <line x1="82" y1="98" x2="156" y2="98" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Legs planted */}
            <line x1="156" y1="98" x2="190" y2="112" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="190" y1="112" x2="192" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Pressing arm vertical stack */}
            <line x1="108" y1="96" x2="108" y2="44" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            <circle cx="108" cy="40" r="6" fill="#FF6B00" fillOpacity="0.2" stroke="#FF6B00" strokeWidth="2" />
            {/* Upward press vector */}
            <path d="M 124 68 L 124 40 M 119 46 L 124 40 L 129 46" fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Scapula lock */}
            <circle cx="108" cy="98" r="5" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="1.8" />
            <text x="136" y="46" fill="#FF6B00" fontSize="9.5" fontWeight="600">Empurrada alinhada</text>
            <text x="136" y="61" fill="currentColor" fillOpacity="0.7" fontSize="9">Cotovelo ~45°</text>
            <text x="64" y="130" fill="#16A34A" fontSize="9.5" fontWeight="600">Escápulas firmes no banco</text>
          </g>
        )}

        {muscleGroup === "quadriceps" && (
          <g>
            {/* Floor */}
            <line x1="40" y1="136" x2="240" y2="136" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
            {/* Knee tracking vertical line */}
            <line x1="154" y1="54" x2="154" y2="136" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="4 3" />
            {/* Head */}
            <circle cx="136" cy="30" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Torso parallel to shin */}
            <line x1="132" y1="40" x2="106" y2="86" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Thigh */}
            <line x1="106" y1="86" x2="154" y2="94" stroke="#FF6B00" strokeWidth="3.5" strokeLinecap="round" />
            {/* Shin */}
            <line x1="154" y1="94" x2="144" y2="134" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Foot */}
            <line x1="142" y1="134" x2="164" y2="134" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Knee alignment marker */}
            <circle cx="154" cy="94" r="6" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="2" />
            {/* Force up */}
            <path d="M 106 72 L 106 46 M 101 52 L 106 46 L 111 52" fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="16" y="54" fill="#FF6B00" fontSize="9.5" fontWeight="600">Força nos calcanhares</text>
            <text x="166" y="88" fill="#16A34A" fontSize="9.5" fontWeight="600">Joelho alinhado</text>
            <text x="166" y="102" fill="currentColor" fillOpacity="0.65" fontSize="8.8">Sem fechar para dentro</text>
          </g>
        )}

        {muscleGroup === "posterior_gluteos" && (
          <g>
            <line x1="40" y1="136" x2="240" y2="136" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
            {/* Neutral spine line */}
            <line x1="172" y1="54" x2="108" y2="74" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 3" />
            {/* Head aligned with spine */}
            <circle cx="176" cy="52" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Hinged torso */}
            <line x1="166" y1="56" x2="108" y2="74" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Vertical arm holding load */}
            <line x1="150" y1="62" x2="148" y2="108" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            {/* Legs slight knee bend */}
            <line x1="108" y1="74" x2="128" y2="104" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            <line x1="128" y1="104" x2="124" y2="134" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            {/* Hip hinge pivot */}
            <circle cx="108" cy="74" r="6" fill="#FF6B00" fillOpacity="0.22" stroke="#FF6B00" strokeWidth="2" />
            {/* Hip back arrow */}
            <path d="M 96 74 L 72 74 M 78 69 L 72 74 L 78 79" fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="16" y="64" fill="#FF6B00" fontSize="9.5" fontWeight="600">Quadril p/ trás</text>
            <text x="158" y="34" fill="#16A34A" fontSize="9.5" fontWeight="600">Coluna alinhada</text>
            <text x="160" y="114" fill="currentColor" fillOpacity="0.65" fontSize="8.8">Carga rente à coxa</text>
          </g>
        )}

        {muscleGroup === "ombros" && (
          <g>
            {/* Central axis */}
            <line x1="140" y1="18" x2="140" y2="142" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="140" cy="38" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Torso */}
            <line x1="140" y1="48" x2="140" y2="102" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="126" y1="102" x2="124" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="154" y1="102" x2="156" y2="138" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Arms in scapular plane */}
            <line x1="140" y1="56" x2="96" y2="54" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            <line x1="140" y1="56" x2="184" y2="54" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            {/* Elevation arc arrows */}
            <path d="M 88 76 Q 82 64 90 54" fill="none" stroke="#FF6B00" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 192 76 Q 198 64 190 54" fill="none" stroke="#FF6B00" strokeWidth="1.8" strokeLinecap="round" />
            {/* Core lock */}
            <circle cx="140" cy="84" r="5" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="1.8" />
            <text x="14" y="46" fill="#FF6B00" fontSize="9.5" fontWeight="600">Plano escapular 30°</text>
            <text x="190" y="96" fill="#16A34A" fontSize="9.5" fontWeight="600">Core travado</text>
            <text x="190" y="110" fill="currentColor" fillOpacity="0.65" fontSize="8.8">Sem arquear lombar</text>
          </g>
        )}

        {muscleGroup === "biceps_triceps" && (
          <g>
            {/* Vertical humerus lock line */}
            <line x1="126" y1="48" x2="126" y2="112" stroke="#16A34A" strokeWidth="1.8" strokeDasharray="4 3" />
            <circle cx="126" cy="30" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <line x1="126" y1="40" x2="126" y2="104" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="126" y1="104" x2="126" y2="140" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Fixed upper arm + curling forearm */}
            <line x1="126" y1="52" x2="126" y2="86" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="126" y1="86" x2="162" y2="68" stroke="#FF6B00" strokeWidth="3.5" strokeLinecap="round" />
            {/* Elbow anchor */}
            <circle cx="126" cy="86" r="5.5" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="2" />
            {/* Arc path */}
            <path d="M 156 104 A 36 36 0 0 0 166 72" fill="none" stroke="#FF6B00" strokeWidth="1.8" strokeDasharray="3 3" />
            <text x="18" y="88" fill="#16A34A" fontSize="9.5" fontWeight="600">Cotovelo fixo</text>
            <text x="172" y="66" fill="#FF6B00" fontSize="9.5" fontWeight="600">Arco controlado</text>
            <text x="172" y="82" fill="currentColor" fillOpacity="0.65" fontSize="8.8">Punho neutro</text>
          </g>
        )}

        {muscleGroup === "abdomen_panturrilha" && (
          <g>
            {/* Floor */}
            <line x1="36" y1="128" x2="244" y2="128" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
            {/* Straight alignment axis (Plank / Core) */}
            <line x1="66" y1="74" x2="216" y2="112" stroke="#16A34A" strokeWidth="2" strokeDasharray="5 3" />
            {/* Head */}
            <circle cx="64" cy="76" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Torso + legs */}
            <line x1="74" y1="80" x2="214" y2="114" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Forearm support */}
            <line x1="88" y1="84" x2="86" y2="124" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            <line x1="86" y1="124" x2="64" y2="124" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
            {/* Core engagement center */}
            <circle cx="136" cy="96" r="6" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="2" />
            <text x="108" y="54" fill="#16A34A" fontSize="9.5" fontWeight="600">Linha cabeça · quadril · calcanhar</text>
            <text x="116" y="118" fill="#FF6B00" fontSize="9">Pelve encaixada (sem ceder lombar)</text>
          </g>
        )}

        {muscleGroup === "lombar_joelho" && (
          <g>
            <line x1="34" y1="130" x2="246" y2="130" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
            {/* Bridge / neutral lumbopelvic alignment */}
            <line x1="80" y1="114" x2="164" y2="74" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 3" />
            {/* Head & shoulders on mat */}
            <circle cx="66" cy="118" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Back + lifted hips */}
            <line x1="78" y1="118" x2="162" y2="78" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Shins vertical */}
            <line x1="162" y1="78" x2="180" y2="128" stroke="#FF6B00" strokeWidth="3.5" strokeLinecap="round" />
            {/* Safe joint highlight */}
            <circle cx="132" cy="92" r="6" fill="#16A34A" fillOpacity="0.22" stroke="#16A34A" strokeWidth="2" />
            <circle cx="162" cy="78" r="6" fill="#FF6B00" fillOpacity="0.22" stroke="#FF6B00" strokeWidth="2" />
            <text x="92" y="54" fill="#16A34A" fontSize="9.5" fontWeight="600">Core + Glúteo ativos</text>
            <text x="186" y="96" fill="#FF6B00" fontSize="9.5" fontWeight="600">Zero impacto</text>
            <text x="186" y="110" fill="currentColor" fillOpacity="0.65" fontSize="8.8">Amplitude indolor</text>
          </g>
        )}
      </svg>

      <div className="flex items-center justify-between gap-2 text-[10px] text-[#64748B] dark:text-[#A1A1AA]">
        <span className="truncate">{MUSCLE_BIOMECHANICS[muscleGroup].keyAngles}</span>
      </div>
    </div>
  );
};

interface PostureMiniGuideCardProps {
  item: RankedExerciseGuide;
  isExpanded: boolean;
  onToggleExpand: () => void;
  checkedSteps: Record<number, boolean>;
  onToggleStep: (stepIdx: number) => void;
  onAskAiForExercise: (exercise: ExerciseItem) => void;
}

const PostureMiniGuideCard: React.FC<PostureMiniGuideCardProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  checkedSteps,
  onToggleStep,
  onAskAiForExercise,
}) => {
  const { exercise, rank, sessionsCount, completedSetsCount, lastWeightKg, sourceLabel, biomechanics } =
    item;
  const [visualMode, setVisualMode] = useState<"diagram" | "start" | "peak">("diagram");
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  const completedChecklistCount = biomechanics.checkpoints.filter(
    (_, idx) => Boolean(checkedSteps[idx])
  ).length;
  const allChecked = completedChecklistCount === biomechanics.checkpoints.length;

  const activePhotoUrl =
    visualMode === "start" ? exercise.imageUrl : exercise.secondaryImageUrl;
  const photoUnavailable = Boolean(imgFailed[visualMode]);

  return (
    <article className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] overflow-hidden transition-colors">
      {/* Main 2-column visual + guide header */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Visual Preview Slot */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] dark:border-[#26262B] flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#0B0B0D]">
          <div className="relative h-[212px] w-full overflow-hidden">
            {visualMode === "diagram" || photoUnavailable ? (
              <PostureDiagramSvg
                muscleGroup={exercise.muscleGroup}
                exerciseName={exercise.name}
              />
            ) : (
              <div className="relative w-full h-full bg-[#0F172A]">
                <img
                  src={activePhotoUrl}
                  alt={`${exercise.name} — ${
                    visualMode === "start" ? "posição inicial" : "contração final"
                  }`}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setImgFailed((prev) => ({ ...prev, [visualMode]: true }))
                  }
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex items-end justify-between px-3.5 pb-2.5 text-[11px] font-medium text-white">
                  <span>
                    {visualMode === "start"
                      ? "Fase 1 · Preparação"
                      : "Fase 2 · Contração máxima"}
                  </span>
                  <span className="font-mono tabular-nums text-white/80">
                    {exercise.equipment}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Visual Switcher */}
          <div className="p-2.5 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center gap-1 bg-white dark:bg-[#151518]">
            {(
              [
                { id: "diagram", label: "Diagrama" },
                { id: "start", label: "Fase 1" },
                { id: "peak", label: "Fase 2" },
              ] as const
            ).map((tab) => {
              const active = visualMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVisualMode(tab.id)}
                  className={`flex-1 min-h-[34px] px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A]"
                      : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Descriptive Mini-Guide Content */}
        <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono font-bold tabular-nums text-[#FF6B00]">
                  #{rank}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#334155] dark:text-[#D4D4D8]">
                  {exercise.muscleLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>{exercise.equipment}</span>
                {sessionsCount > 0 ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {sessionsCount} {sessionsCount === 1 ? "sessão" : "sessões"}
                      {completedSetsCount > 0 ? ` / ${completedSetsCount} séries` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{sourceLabel}</span>
                  </>
                )}
              </div>

              {lastWeightKg > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                  Carga ref.: <strong className="text-[#0F172A] dark:text-white">{lastWeightKg} kg</strong>
                </span>
              )}
            </div>

            {/* Title & Pattern */}
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                {exercise.name}
              </h3>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#A1A1AA]">
                {biomechanics.patternLabel} · Cadência sugerida:{" "}
                <span className="font-mono tabular-nums text-[#334155] dark:text-[#D4D4D8]">
                  {biomechanics.cadence}
                </span>
              </p>
            </div>

            {/* Core Posture & Error Summary (clean hairline divider layout) */}
            <div className="pt-2.5 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-2.5 text-xs sm:text-[13px] leading-relaxed">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Postura correta
                </p>
                <p className="mt-0.5 text-[#334155] dark:text-[#D4D4D8]">
                  {exercise.guide.posture}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#E2E8F0] dark:border-[#26262B]">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Erro comum a corrigir
                </p>
                <p className="mt-0.5 text-[#334155] dark:text-[#D4D4D8]">
                  {exercise.guide.commonMistake}
                </p>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Ocultar checklist & ajuste</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>
                    Abrir checklist postural{" "}
                    <span className="font-mono tabular-nums text-[#64748B] dark:text-[#A1A1AA]">
                      ({completedChecklistCount}/{biomechanics.checkpoints.length})
                    </span>
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onAskAiForExercise(exercise)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pedir correção à IA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Deep Posture Checklist + Machine Setup + Breathing */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#111114]"
          >
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Setup & Breathing Details */}
              <div className="space-y-3.5 text-xs sm:text-[13px] leading-relaxed">
                <div>
                  <h4 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Ajuste do aparelho & base</span>
                  </h4>
                  <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                    {exercise.guide.machineSetup}
                  </p>
                </div>

                {exercise.guide.breathing && (
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                    <h4 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Respiração recomendada</span>
                    </h4>
                    <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                      {exercise.guide.breathing}
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                  <h4 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Dica rápida de correção</span>
                  </h4>
                  <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                    {biomechanics.correctionCue}
                  </p>
                </div>
              </div>

              {/* Interactive Pre-Set Posture Checklist */}
              <div className="space-y-3 md:border-l md:border-[#E2E8F0] md:dark:border-[#26262B] md:pl-5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] dark:text-white">
                    Checklist antes da série
                  </h4>
                  <span
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      allChecked
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[#64748B] dark:text-[#A1A1AA]"
                    }`}
                  >
                    {allChecked
                      ? "Postura validada"
                      : `${completedChecklistCount}/${biomechanics.checkpoints.length} marcados`}
                  </span>
                </div>

                <div className="space-y-2">
                  {biomechanics.checkpoints.map((point, idx) => {
                    const checked = Boolean(checkedSteps[idx]);
                    return (
                      <button
                        key={point}
                        type="button"
                        onClick={() => onToggleStep(idx)}
                        className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-left text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                          checked
                            ? "bg-emerald-500/10 border-emerald-500/40 text-[#0F172A] dark:text-white"
                            : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#334155] dark:text-[#D4D4D8] hover:border-[#FF6B00]/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            checked
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-[#CBD5E1] dark:border-[#3A3A42]"
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <span className={checked ? "line-through opacity-80" : ""}>
                          {point}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-[#64748B] dark:text-[#71717A]">
                  Ponto de atenção principal: {biomechanics.primaryRiskArea}.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
};

interface PostureCorrectorPanelProps {
  state: BiancoAppState;
  onAskAiForPosture: (prompt: string) => void;
  onNavigateTab: (tab: TabId) => void;
}

export const PostureCorrectorPanel: React.FC<PostureCorrectorPanelProps> = ({
  state,
  onAskAiForPosture,
  onNavigateTab,
}) => {
  const [viewMode, setViewMode] = useState<"frequent" | "all">("frequent");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupId | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, Record<number, boolean>>>({});

  const { rankedGuides, hasHistoryData, topMuscleLabel, totalTrackedSessions } = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        sessions: number;
        sets: number;
        fromActiveCombo: boolean;
        fromSavedPlan: boolean;
        customTracked: boolean;
      }
    >();

    for (const ex of EXERCISES) {
      statsMap.set(ex.id, {
        sessions: 0,
        sets: 0,
        fromActiveCombo: false,
        fromSavedPlan: false,
        customTracked: false,
      });
    }

    const resolveSwapped = (exId: string) => state.swappedExercises[exId] || exId;

    // 1. Analyze completed workout history
    for (const workout of state.workoutHistory) {
      const titleNorm = normalizeText(workout.title);
      const groupNorm = normalizeText(workout.muscleGroup);

      const matchedCombo = WORKOUT_COMBOS.find((combo) => {
        const comboTitle = normalizeText(combo.title);
        return (
          titleNorm.includes(comboTitle) ||
          comboTitle.includes(titleNorm) ||
          groupNorm.includes(comboTitle)
        );
      });

      if (matchedCombo) {
        const perExSets = Math.max(
          1,
          Math.round((workout.setsCompleted || 12) / matchedCombo.exerciseIds.length)
        );
        for (const rawId of matchedCombo.exerciseIds) {
          const exId = resolveSwapped(rawId);
          const entry = statsMap.get(exId);
          if (entry) {
            entry.sessions += 1;
            entry.sets += perExSets;
          }
        }
      } else {
        const inferredGroups = inferMuscleGroupsFromWorkoutText(
          `${workout.title} ${workout.muscleGroup}`
        );
        if (inferredGroups.length > 0) {
          const matchedExercises = EXERCISES.filter((ex) =>
            inferredGroups.includes(ex.muscleGroup)
          ).slice(0, 6);
          const perExSets = Math.max(
            1,
            Math.round((workout.setsCompleted || 10) / Math.max(1, matchedExercises.length))
          );
          for (const ex of matchedExercises) {
            const entry = statsMap.get(ex.id);
            if (entry) {
              entry.sessions += 1;
              entry.sets += perExSets;
            }
          }
        }
      }
    }

    // 2. Analyze active exercise logs (sets completed & tracked loads)
    let totalLoggedSets = 0;
    for (const ex of EXERCISES) {
      const log = state.exerciseLogs[ex.id];
      const entry = statsMap.get(ex.id);
      if (!log || !entry) continue;

      const doneSets = log.completedSets.filter(Boolean).length;
      totalLoggedSets += doneSets;
      if (doneSets > 0) {
        entry.sets += doneSets;
        if (entry.sessions === 0) entry.sessions = 1;
      }
      if (log.weightKg !== ex.defaultWeightKg || log.lastWeightKg > 0) {
        entry.customTracked = true;
      }
    }

    // 3. Mark exercises from current active combo & saved AI plan
    const activeCombo = WORKOUT_COMBOS.find((c) => c.id === state.activeComboId);
    if (activeCombo) {
      for (const rawId of activeCombo.exerciseIds) {
        const entry = statsMap.get(resolveSwapped(rawId));
        if (entry) entry.fromActiveCombo = true;
      }
    }
    if (state.savedPlan?.matchedExerciseIds) {
      for (const exId of state.savedPlan.matchedExerciseIds) {
        const entry = statsMap.get(exId);
        if (entry) entry.fromSavedPlan = true;
      }
    }

    const todayGroups = inferMuscleGroupsFromWorkoutText(
      `${state.profile.muscleToday} ${state.goals.primary}`
    );

    const scored = EXERCISES.map((ex) => {
      const stat = statsMap.get(ex.id)!;
      const log = state.exerciseLogs[ex.id];
      const matchesToday = todayGroups.includes(ex.muscleGroup);

      const frequencyScore =
        stat.sessions * 12 +
        stat.sets * 2 +
        (stat.fromActiveCombo ? 6 : 0) +
        (stat.fromSavedPlan ? 5 : 0) +
        (stat.customTracked ? 3 : 0) +
        (matchesToday ? 2 : 0);

      let sourceLabel = "Guia preventivo recomendado";
      if (stat.sessions > 0) {
        sourceLabel = "Mais realizado no histórico";
      } else if (stat.fromSavedPlan) {
        sourceLabel = "Na sua ficha do Personal IA";
      } else if (stat.fromActiveCombo) {
        sourceLabel = "Na sua ficha ativa";
      } else if (matchesToday) {
        sourceLabel = "Alinhado ao foco atual";
      }

      return {
        exercise: ex,
        frequencyScore,
        sessionsCount: stat.sessions,
        completedSetsCount: stat.sets,
        lastWeightKg: log?.weightKg ?? ex.defaultWeightKg,
        sourceLabel,
        biomechanics: MUSCLE_BIOMECHANICS[ex.muscleGroup],
      };
    }).sort((a, b) => b.frequencyScore - a.frequencyScore);

    const ranked: RankedExerciseGuide[] = scored.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // Top muscle group across ranked top 6
    const muscleCounts = new Map<string, number>();
    for (const item of ranked.slice(0, 6)) {
      muscleCounts.set(
        item.exercise.muscleLabel,
        (muscleCounts.get(item.exercise.muscleLabel) || 0) + Math.max(1, item.frequencyScore)
      );
    }
    let dominantMuscle = ranked[0]?.exercise.muscleLabel || "Costas";
    let maxScore = -1;
    for (const [label, score] of muscleCounts.entries()) {
      if (score > maxScore) {
        maxScore = score;
        dominantMuscle = label;
      }
    }

    const historyPresent = state.workoutHistory.length > 0 || totalLoggedSets > 0;

    return {
      rankedGuides: ranked,
      hasHistoryData: historyPresent,
      topMuscleLabel: dominantMuscle,
      totalTrackedSessions: state.workoutHistory.length,
    };
  }, [
    state.workoutHistory,
    state.exerciseLogs,
    state.activeComboId,
    state.swappedExercises,
    state.savedPlan,
    state.profile.muscleToday,
    state.goals.primary,
  ]);

  const visibleGuides = useMemo(() => {
    const query = normalizeText(searchQuery.trim());
    let list = viewMode === "frequent" ? rankedGuides.slice(0, 6) : rankedGuides;

    if (selectedMuscle !== "all") {
      list = rankedGuides.filter((item) => item.exercise.muscleGroup === selectedMuscle);
    }

    if (query) {
      list = rankedGuides.filter((item) => {
        const haystack = normalizeText(
          `${item.exercise.name} ${item.exercise.muscleLabel} ${item.exercise.equipment} ${item.exercise.guide.posture} ${item.exercise.guide.commonMistake}`
        );
        return haystack.includes(query);
      });
    }

    return list;
  }, [rankedGuides, viewMode, selectedMuscle, searchQuery]);

  const handleToggleExpand = (exId: string) => {
    setExpandedIds((prev) => ({ ...prev, [exId]: !prev[exId] }));
  };

  const handleToggleStep = (exId: string, stepIdx: number) => {
    setCheckedMap((prev) => ({
      ...prev,
      [exId]: {
        ...(prev[exId] || {}),
        [stepIdx]: !prev[exId]?.[stepIdx],
      },
    }));
  };

  const handleAskAiForExercise = (exercise: ExerciseItem) => {
    const prompt = `Atue como meu Corretor de Postura para o exercício "${exercise.name}" (${exercise.muscleLabel} · ${exercise.equipment}). Considerando meu nível (${state.profile.level}) e objetivo (${state.goals.primary}), me dê um passo a passo curto de alinhamento corporal, 3 sinais de que estou errando a execução e uma dica prática para corrigir imediatamente na academia.`;
    onAskAiForPosture(prompt);
  };

  const resetFilters = () => {
    setViewMode("frequent");
    setSelectedMuscle("all");
    setSearchQuery("");
  };

  return (
    <section
      role="tabpanel"
      aria-label="Corretor de Postura"
      className="space-y-5"
    >
      {/* Header & Frequency Summary Surface */}
      <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
              {hasHistoryData
                ? `Priorizado com base em ${totalTrackedSessions} ${
                    totalTrackedSessions === 1 ? "treino concluído" : "treinos concluídos"
                  } e séries registradas`
                : "Priorizado com base na sua ficha ativa e foco muscular atual"}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
              Corretor de Postura · Mini-Guias Biomecânicos
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] max-w-2xl">
              Revise alinhamento articular, diagrama postural, fase de execução e erros comuns dos exercícios que você mais pratica antes de iniciar suas séries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onAskAiForPosture(
                  `Faça uma auditoria postural dos meus 3 exercícios mais frequentes (${rankedGuides
                    .slice(0, 3)
                    .map((g) => g.exercise.name)
                    .join(", ")}) com foco em prevenir lesões e melhorar ativação muscular para meu nível ${state.profile.level}.`
                )
              }
              className="min-h-[42px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>Auditoria Postural com IA</span>
            </button>

            {!hasHistoryData && (
              <button
                type="button"
                onClick={() => onNavigateTab("treinos")}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Registrar primeiro treino</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Unboxed Metric Strip (Hairline Dividers, Zero Nested Cards) */}
        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 sm:divide-x sm:divide-[#E2E8F0] dark:sm:divide-[#26262B]">
          <div className="sm:pr-5">
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              Exercício mais frequente
            </p>
            <p className="mt-1 text-sm font-bold text-[#0F172A] dark:text-white truncate">
              {rankedGuides[0]?.exercise.name || "Puxada Alta na Polia"}
            </p>
          </div>
          <div className="sm:px-5">
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              Grupo muscular dominante
            </p>
            <p className="mt-1 text-sm font-bold text-[#0F172A] dark:text-white">
              {topMuscleLabel}
            </p>
          </div>
          <div className="sm:pl-5">
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              Mini-guias disponíveis
            </p>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#FF6B00]">
              {EXERCISES.length} exercícios · 8 padrões biomecânicos
            </p>
          </div>
        </div>

        {/* Interactive Filter Toolbar */}
        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Segmented Mode Control */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] self-start">
              <button
                type="button"
                onClick={() => {
                  setViewMode("frequent");
                  setSelectedMuscle("all");
                }}
                className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === "frequent" && selectedMuscle === "all" && !searchQuery.trim()
                    ? "bg-white dark:bg-[#151518] text-[#0F172A] dark:text-white shadow-xs"
                    : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                }`}
              >
                Top 6 Mais Frequentes
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === "all" && selectedMuscle === "all" && !searchQuery.trim()
                    ? "bg-white dark:bg-[#151518] text-[#0F172A] dark:text-white shadow-xs"
                    : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                }`}
              >
                Todos os Exercícios
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar exercício ou articulação..."
                aria-label="Buscar guia postural por exercício"
                className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none text-xs text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
              />
            </div>
          </div>

          {/* Muscle Group Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedMuscle("all")}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                selectedMuscle === "all"
                  ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                  : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              Todos
            </button>
            {MUSCLE_GROUPS.map((group) => {
              const active = selectedMuscle === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedMuscle(group.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  {group.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mini-Guides Feed */}
      {visibleGuides.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-8 text-center space-y-3">
          <Eye className="w-7 h-7 text-[#94A3B8] dark:text-[#71717A] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Nenhum exercício encontrado para esse filtro
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              Tente outro nome de aparelho ou limpe os filtros para voltar aos seus exercícios mais frequentes.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[38px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Voltar aos mais frequentes</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGuides.map((item) => (
            <PostureMiniGuideCard
              key={item.exercise.id}
              item={item}
              isExpanded={Boolean(expandedIds[item.exercise.id])}
              onToggleExpand={() => handleToggleExpand(item.exercise.id)}
              checkedSteps={checkedMap[item.exercise.id] || {}}
              onToggleStep={(stepIdx) => handleToggleStep(item.exercise.id, stepIdx)}
              onAskAiForExercise={handleAskAiForExercise}
            />
          ))}
        </div>
      )}

      {/* Safety Footnote */}
      <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] px-4 py-3.5 flex items-start gap-3 text-xs text-[#475569] dark:text-[#A1A1AA]">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#0F172A] dark:text-white">Regra de segurança articular:</strong>{" "}
          sinta fadiga muscular controlada, nunca dor aguda ou fisgada articular. Ao notar perda de alinhamento na lombar ou nos joelhos, reduza a carga ou clique em{" "}
          <span className="font-semibold text-[#FF6B00]">Pedir correção à IA</span> para adaptar a execução.
        </p>
      </div>
    </section>
  );
};
