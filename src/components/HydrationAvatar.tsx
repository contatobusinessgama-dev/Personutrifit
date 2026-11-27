import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Droplets, Volume2, VolumeX, X } from "lucide-react";

export const HYDRATION_AVATAR_IMAGE_URL =
  "/src/assets/images/hydration_coach_avatar_1795695957641.jpg";

export const WATER_AVATAR_AUTO_DISMISS_MS = 16000;

export interface WaterReminderAvatarAlert {
  id: number;
  message: string;
  consumedMl: number;
  targetMl: number;
  remainingMl: number;
  soundPlayed: boolean;
}

interface HydrationMascotBadgeProps {
  size?: "xs" | "sm" | "md" | "lg";
  active?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<HydrationMascotBadgeProps["size"]>, string> = {
  xs: "w-6 h-6 rounded-lg",
  sm: "w-9 h-9 rounded-xl",
  md: "w-11 h-11 rounded-2xl",
  lg: "w-14 h-14 rounded-2xl",
};

const ICON_SIZES: Record<NonNullable<HydrationMascotBadgeProps["size"]>, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export const HydrationMascotBadge: React.FC<HydrationMascotBadgeProps> = ({
  size = "md",
  active = false,
  onClick,
  title,
  className = "",
}) => {
  const [imgError, setImgError] = useState(false);

  const inner = (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 border-2 ${
        active
          ? "border-sky-400/80 dark:border-sky-400/70 shadow-[0_0_12px_rgba(14,165,233,0.28)]"
          : "border-[#E2E8F0] dark:border-[#26262B]"
      } bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgError ? (
        <img
          src={HYDRATION_AVATAR_IMAGE_URL}
          alt="Avatar de hidratação"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <Droplets className={`${ICON_SIZES[size]} text-white`} />
      )}
      {active && size !== "xs" && (
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#151518]"
        />
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title || "Ver avatar do lembrete de água"}
        className="inline-flex shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-2xl"
      >
        {inner}
      </button>
    );
  }

  return (
    <span title={title} className="inline-flex shrink-0">
      {inner}
    </span>
  );
};

interface WaterReminderAvatarPopupProps {
  alert: WaterReminderAvatarAlert | null;
  shiftUp?: boolean;
  onDrink: (ml: number) => void;
  onReplaySound: () => void;
  onDismiss: () => void;
}

export const WaterReminderAvatarPopup: React.FC<WaterReminderAvatarPopupProps> = ({
  alert,
  shiftUp = false,
  onDrink,
  onReplaySound,
  onDismiss,
}) => {
  const [imgError, setImgError] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (alert) {
      setPulseCount((prev) => prev + 1);
    }
  }, [alert?.id]);

  const progressPct = alert
    ? Math.min(100, Math.round((alert.consumedMl / Math.max(1, alert.targetMl)) * 100))
    : 0;

  const handleReplay = () => {
    setPulseCount((prev) => prev + 1);
    onReplaySound();
  };

  return (
    <AnimatePresence>
      {alert && (
        <motion.aside
          key={alert.id}
          role="dialog"
          aria-live="assertive"
          aria-label="Lembrete de hidratação com avatar"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
          className={`fixed right-3 left-3 sm:left-auto sm:right-5 sm:w-[372px] z-50 ${
            shiftUp ? "bottom-40 md:bottom-24" : "bottom-20 md:bottom-6"
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#151518]/95 backdrop-blur-md border border-sky-400/50 dark:border-sky-500/40 shadow-[0_18px_50px_rgba(14,165,233,0.22)] dark:shadow-[0_20px_54px_rgba(0,0,0,0.65)]">
            {/* Subtle top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-cyan-400 to-[#FF6B00]" />

            <div className="p-4 space-y-3.5">
              {/* Top Row: Animated Avatar + Speech Bubble Header */}
              <div className="flex items-start gap-3.5">
                {/* Avatar Portrait with Synchronized Sound-Wave Rings */}
                <div className="relative shrink-0 mt-0.5">
                  {alert.soundPlayed && (
                    <>
                      <motion.span
                        key={`ring-1-${pulseCount}`}
                        aria-hidden="true"
                        initial={{ scale: 0.85, opacity: 0.75 }}
                        animate={{ scale: 1.55, opacity: 0 }}
                        transition={{ duration: 1.4, repeat: 2, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border-2 border-sky-400 pointer-events-none"
                      />
                      <motion.span
                        key={`ring-2-${pulseCount}`}
                        aria-hidden="true"
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: 1.85, opacity: 0 }}
                        transition={{
                          duration: 1.4,
                          delay: 0.3,
                          repeat: 2,
                          ease: "easeOut",
                        }}
                        className="absolute inset-0 rounded-full border-2 border-[#FF6B00]/70 pointer-events-none"
                      />
                    </>
                  )}

                  <motion.button
                    key={`avatar-bounce-${pulseCount}`}
                    type="button"
                    onClick={handleReplay}
                    title="Clique para repetir o aviso sonoro"
                    aria-label="Avatar do lembrete de água — clique para repetir o som"
                    initial={{ rotate: -8, scale: 0.88 }}
                    animate={{
                      rotate: [0, -7, 7, -4, 3, 0],
                      scale: [1, 1.07, 1, 1.04, 1],
                      y: [0, -3, 0],
                    }}
                    transition={{ duration: 1.15, ease: "easeInOut" }}
                    className="relative w-16 h-16 rounded-full overflow-hidden border-[3px] border-sky-400 dark:border-sky-400/90 shadow-lg bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 flex items-center justify-center cursor-pointer"
                  >
                    {!imgError ? (
                      <img
                        src={HYDRATION_AVATAR_IMAGE_URL}
                        alt="Avatar Gota Coach"
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Droplets className="w-8 h-8 text-white" />
                    )}
                  </motion.button>

                  {/* Tiny live sound indicator badge pinned on avatar */}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-[#151518] shadow ${
                      alert.soundPlayed
                        ? "bg-sky-500 text-white"
                        : "bg-[#64748B] text-white"
                    }`}
                  >
                    {alert.soundPlayed ? (
                      <Volume2 className="w-3 h-3" />
                    ) : (
                      <VolumeX className="w-3 h-3" />
                    )}
                  </span>
                </div>

                {/* Speech Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                          Hora de beber água!
                        </span>
                        {alert.soundPlayed ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
                            <span className="inline-flex items-end gap-0.5 h-2.5">
                              <motion.span
                                animate={{ height: ["35%", "100%", "45%"] }}
                                transition={{ duration: 0.55, repeat: Infinity }}
                                className="w-0.5 bg-current rounded-full"
                              />
                              <motion.span
                                animate={{ height: ["100%", "40%", "95%"] }}
                                transition={{ duration: 0.55, delay: 0.12, repeat: Infinity }}
                                className="w-0.5 bg-current rounded-full"
                              />
                              <motion.span
                                animate={{ height: ["50%", "95%", "35%"] }}
                                transition={{ duration: 0.55, delay: 0.24, repeat: Infinity }}
                                className="w-0.5 bg-current rounded-full"
                              />
                            </span>
                            Som tocado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA] text-[10px] font-semibold">
                            Som silenciado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#334155] dark:text-[#D4D4D8]">
                        {alert.message}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={onDismiss}
                      aria-label="Fechar aviso de água"
                      className="w-7 h-7 rounded-lg text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact Hydration Progress */}
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#475569] dark:text-[#A1A1AA]">
                    Hidratação de hoje
                  </span>
                  <span className="font-mono font-bold tabular-nums text-[#0F172A] dark:text-white">
                    {(alert.consumedMl / 1000).toFixed(2)} L /{" "}
                    {(alert.targetMl / 1000).toFixed(2)} L{" "}
                    <span className="text-sky-600 dark:text-sky-400">({progressPct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Quick Hydration Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDrink(250)}
                  className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Bebi +250 ml</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDrink(500)}
                  className="min-h-[38px] px-3 rounded-xl bg-sky-500/12 dark:bg-sky-500/15 hover:bg-sky-500/20 border border-sky-500/35 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>+500 ml</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplay}
                  title="Tocar aviso sonoro novamente"
                  aria-label="Tocar aviso sonoro novamente"
                  className="min-h-[38px] w-[38px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Subtle auto-dismiss countdown bar */}
            <motion.div
              key={`timer-${alert.id}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: WATER_AVATAR_AUTO_DISMISS_MS / 1000, ease: "linear" }}
              className="h-0.5 w-full origin-left bg-sky-400/55"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
