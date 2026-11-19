import React from "react";
import { AVATAR_PRESETS, getInitials } from "../utils/metabolism";

interface StudentAvatarProps {
  avatar?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<StudentAvatarProps["size"]>, string> = {
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-20 h-20 text-2xl",
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  avatar,
  name,
  size = "md",
  className = "",
}) => {
  const isImage =
    typeof avatar === "string" &&
    (avatar.startsWith("data:image/") ||
      avatar.startsWith("http://") ||
      avatar.startsWith("https://"));

  const preset =
    AVATAR_PRESETS.find((p) => p.id === avatar) || AVATAR_PRESETS[0];

  if (isImage && avatar) {
    return (
      <img
        src={avatar}
        alt={`Avatar de ${name}`}
        referrerPolicy="no-referrer"
        className={`${SIZE_CLASSES[size]} rounded-2xl object-cover border border-[#E2E8F0] dark:border-[#26262B] shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={`Avatar de ${name}`}
      className={`${SIZE_CLASSES[size]} ${preset.bgClass} ${preset.accentText} rounded-2xl border border-white/10 font-display font-extrabold tracking-tight flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};
