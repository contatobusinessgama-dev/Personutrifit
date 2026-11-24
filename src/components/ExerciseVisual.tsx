import React, { useEffect, useState } from "react";
import {
  Activity,
  Dumbbell,
  Pause,
  Play,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { EquipmentType, MuscleGroupId } from "../types";

interface ExerciseVisualProps {
  name: string;
  muscleGroup: MuscleGroupId | "cardio";
  muscleLabel: string;
  equipment: EquipmentType;
  imageUrl?: string;
  secondaryImageUrl?: string;
  variant: "thumbnail" | "modal";
  onClick?: () => void;
}

function getEquipmentIcon(equipment: EquipmentType, className: string) {
  switch (equipment) {
    case "Cardio":
      return <Activity className={className} />;
    case "Polia/Cross":
      return <SlidersHorizontal className={className} />;
    case "Peso Corporal":
      return <User className={className} />;
    default:
      return <Dumbbell className={className} />;
  }
}

/**
 * Handcrafted Dark & Orange anatomical silhouette SVG highlighting the active muscle group.
 * Rendered automatically whenever an exercise photograph cannot load (zero broken images).
 */
const AnatomicalFallbackSvg: React.FC<{
  muscleGroup: MuscleGroupId | "cardio";
  equipment: EquipmentType;
  muscleLabel: string;
  compact?: boolean;
  frame?: 0 | 1;
}> = ({ muscleGroup, equipment, muscleLabel, compact = false, frame = 0 }) => {
  const isUpperBack = muscleGroup === "costas";
  const isChest = muscleGroup === "peito";
  const isQuads = muscleGroup === "quadriceps";
  const isPosterior = muscleGroup === "posterior_gluteos";
  const isShoulders = muscleGroup === "ombros";
  const isArms = muscleGroup === "biceps_triceps";
  const isCoreCalves = muscleGroup === "abdomen_panturrilha";
  const isJointCare = muscleGroup === "lombar_joelho";
  const isCardio = muscleGroup === "cardio";

  const hi = "#FF6B00";
  const hiSoft = "rgba(255, 107, 0, 0.34)";
  const baseBody = "#27272F";
  const strokeBody = "#3F3F4A";

  const pulseScale = frame === 1 ? 1.04 : 1;

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#19191F] via-[#121216] to-[#0B0B0D] flex items-center justify-center overflow-hidden select-none">
      {/* Subtle radial orange studio glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,107,0,0.18) 0%, rgba(11,11,13,0) 68%)",
        }}
      />

      <svg
        viewBox="0 0 120 140"
        role="img"
        aria-label={`Diagrama muscular: ${muscleLabel}`}
        className={`${compact ? "w-14 h-16" : "w-36 h-44"} relative z-10 transition-transform duration-300`}
        style={{ transform: `scale(${pulseScale})` }}
      >
        {/* Head */}
        <circle cx="60" cy="18" r="9.5" fill={baseBody} stroke={strokeBody} strokeWidth="1.5" />

        {/* Shoulders */}
        <ellipse
          cx="40"
          cy="37"
          rx="8"
          ry="6"
          fill={isShoulders || isCardio ? hi : baseBody}
          stroke={isShoulders ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />
        <ellipse
          cx="80"
          cy="37"
          rx="8"
          ry="6"
          fill={isShoulders || isCardio ? hi : baseBody}
          stroke={isShoulders ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />

        {/* Torso / Back & Chest */}
        <path
          d="M42 34 L78 34 L74 68 L46 68 Z"
          fill={isUpperBack ? hiSoft : baseBody}
          stroke={isUpperBack ? hi : strokeBody}
          strokeWidth="1.5"
        />

        {/* Chest Pecs */}
        <path
          d="M45 36 L59 36 L59 49 Q52 52 45 48 Z"
          fill={isChest ? hi : isUpperBack ? hi : "#2F2F38"}
          opacity={isChest || isUpperBack ? 0.95 : 0.7}
        />
        <path
          d="M61 36 L75 36 L75 48 Q68 52 61 49 Z"
          fill={isChest ? hi : isUpperBack ? hi : "#2F2F38"}
          opacity={isChest || isUpperBack ? 0.95 : 0.7}
        />

        {/* Core / Abs / Lower Back */}
        <rect
          x="51"
          y="51"
          width="18"
          height="19"
          rx="4"
          fill={isCoreCalves || isJointCare || isCardio ? hi : "#23232B"}
          stroke={isCoreCalves || isJointCare ? "#FDBA74" : "none"}
          strokeWidth="1"
        />

        {/* Arms (Biceps/Triceps) */}
        <path
          d="M35 41 L27 68 L34 71 L42 44 Z"
          fill={isArms ? hi : baseBody}
          stroke={isArms ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />
        <path
          d="M85 41 L93 68 L86 71 L78 44 Z"
          fill={isArms ? hi : baseBody}
          stroke={isArms ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />

        {/* Glutes / Pelvis */}
        <path
          d="M45 69 L75 69 L78 82 L42 82 Z"
          fill={isPosterior || isJointCare || isCardio ? hi : baseBody}
          stroke={isPosterior || isJointCare ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />

        {/* Thighs (Quads & Posterior) */}
        <path
          d="M43 82 L58 82 L55 110 L44 110 Z"
          fill={isQuads || isPosterior || isJointCare || isCardio ? hi : baseBody}
          stroke={isQuads || isPosterior || isJointCare ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />
        <path
          d="M62 82 L77 82 L76 110 L65 110 Z"
          fill={isQuads || isPosterior || isJointCare || isCardio ? hi : baseBody}
          stroke={isQuads || isPosterior || isJointCare ? "#FDBA74" : strokeBody}
          strokeWidth="1.4"
        />

        {/* Calves */}
        <path
          d="M45 112 L55 112 L53 133 L46 133 Z"
          fill={isCoreCalves || isCardio ? hi : baseBody}
          stroke={isCoreCalves ? "#FDBA74" : strokeBody}
          strokeWidth="1.3"
        />
        <path
          d="M65 112 L75 112 L74 133 L67 133 Z"
          fill={isCoreCalves || isCardio ? hi : baseBody}
          stroke={isCoreCalves ? "#FDBA74" : strokeBody}
          strokeWidth="1.3"
        />
      </svg>

      {!compact && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 text-xs text-[#D4D4D8]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-white">
            {getEquipmentIcon(equipment, "w-3.5 h-3.5 text-[#FF6B00]")}
            <span>{muscleLabel}</span>
          </span>
          <span className="text-[11px] text-[#A1A1AA]">{equipment}</span>
        </div>
      )}

      {compact && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 z-20 w-5 h-5 rounded-md bg-[#0B0B0D]/85 border border-[#26262B] flex items-center justify-center text-[#FF6B00]"
        >
          {getEquipmentIcon(equipment, "w-3 h-3")}
        </span>
      )}
    </div>
  );
};

export const ExerciseVisual: React.FC<ExerciseVisualProps> = ({
  name,
  muscleGroup,
  muscleLabel,
  equipment,
  imageUrl,
  secondaryImageUrl,
  variant,
  onClick,
}) => {
  const [primaryError, setPrimaryError] = useState(false);
  const [secondaryError, setSecondaryError] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [activeFrame, setActiveFrame] = useState<0 | 1>(0);

  // Reset image error and frame state when exercise changes
  useEffect(() => {
    setPrimaryError(false);
    setSecondaryError(false);
    setActiveFrame(0);
    setIsAnimating(true);
  }, [imageUrl, secondaryImageUrl]);

  // Alternate between Position 1 (0.jpg) and Position 2 (1.jpg) every 1.2s in modal animation mode
  useEffect(() => {
    if (variant !== "modal" || !isAnimating) return;
    const timer = window.setInterval(() => {
      setActiveFrame((prev) => (prev === 0 ? 1 : 0));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [variant, isAnimating]);

  const hasPrimary = Boolean(imageUrl) && !primaryError;
  const hasSecondary = Boolean(secondaryImageUrl) && !secondaryError;

  if (variant === "thumbnail") {
    const content = (
      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] bg-[#0B0B0D] shrink-0 group">
        {hasPrimary ? (
          <>
            <img
              src={imageUrl}
              alt={`Demonstração de execução: ${name}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setPrimaryError(true)}
              className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
            />
          </>
        ) : (
          <AnatomicalFallbackSvg
            muscleGroup={muscleGroup}
            equipment={equipment}
            muscleLabel={muscleLabel}
            compact
          />
        )}
      </div>
    );

    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          aria-label={`Ver demonstração visual de ${name}`}
          title="Ver como executar"
          className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B00] cursor-pointer"
        >
          {content}
        </button>
      );
    }

    return content;
  }

  // Modal variant: large visual showcase + 1.2s animation toggle
  const showFallback = !hasPrimary && !hasSecondary;
  const currentUrl =
    activeFrame === 1 && hasSecondary
      ? secondaryImageUrl
      : hasPrimary
      ? imageUrl
      : secondaryImageUrl;

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] bg-[#0B0B0D]">
        {!showFallback && currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt={`${name} — ${activeFrame === 0 ? "Posição inicial" : "Posição final"}`}
              referrerPolicy="no-referrer"
              onError={() => {
                if (activeFrame === 0) {
                  setPrimaryError(true);
                } else {
                  setSecondaryError(true);
                }
              }}
              className="w-full h-full object-cover object-center transition-opacity duration-300"
            />
            {/* Hidden preloader for secondary frame to make 1.2s alternation instant */}
            {hasSecondary && activeFrame === 0 && (
              <img
                src={secondaryImageUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                onError={() => setSecondaryError(true)}
                className="hidden"
              />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D]/90 via-transparent to-[#0B0B0D]/20"
            />
            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-white">
                {activeFrame === 0 ? "Posição 1 · Início do movimento" : "Posição 2 · Pico de contração"}
              </span>
              <span className="font-mono tabular-nums text-[#FF6B00] font-semibold">
                {activeFrame + 1}/2
              </span>
            </div>
          </>
        ) : (
          <AnatomicalFallbackSvg
            muscleGroup={muscleGroup}
            equipment={equipment}
            muscleLabel={muscleLabel}
            frame={activeFrame}
          />
        )}
      </div>

      {/* Animation & Position Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsAnimating((prev) => !prev)}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            isAnimating
              ? "bg-[#FF6B00] text-white hover:bg-[#F97316]"
              : "bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white hover:border-[#FF6B00]/60"
          }`}
        >
          {isAnimating ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar animação</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Animar movimento</span>
            </>
          )}
        </button>

        <div
          role="group"
          aria-label="Alternar posição do exercício"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
        >
          <button
            type="button"
            onClick={() => {
              setIsAnimating(false);
              setActiveFrame(0);
            }}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeFrame === 0
                ? "bg-white dark:bg-[#26262B] text-[#0F172A] dark:text-white shadow-xs dark:shadow-none"
                : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
            }`}
          >
            Posição 1
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAnimating(false);
              setActiveFrame(1);
            }}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeFrame === 1
                ? "bg-white dark:bg-[#26262B] text-[#0F172A] dark:text-white shadow-xs dark:shadow-none"
                : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
            }`}
          >
            Posição 2
          </button>
        </div>
      </div>
    </div>
  );
};
