import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, Moon, RotateCcw, Sun } from "lucide-react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "bianco-fit-theme";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Ignore storage read errors in restricted contexts
  }
  return "dark";
}

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = theme;
  root.style.backgroundColor = isDark ? "#0B0B0D" : "#F8FAFC";

  const themeColorMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", isDark ? "#0B0B0D" : "#F8FAFC");
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === THEME_STORAGE_KEY &&
        (event.newValue === "light" || event.newValue === "dark")
      ) {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de um ThemeProvider.");
  }
  return ctx;
}

interface ThemeToggleButtonProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  className = "",
  showLabel = false,
  size = "md",
}) => {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Alternar para tema claro" : "Alternar para tema escuro";

  const sizeClasses =
    size === "sm"
      ? showLabel
        ? "h-9 px-3 text-xs gap-2"
        : "w-9 h-9"
      : showLabel
        ? "h-10 px-3.5 text-xs gap-2"
        : "w-10 h-10";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] dark:border-[#26262B] bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] hover:border-[#CBD5E1] dark:hover:border-[#3F3F46] text-[#0F172A] dark:text-[#E4E4E7] transition-colors cursor-pointer shrink-0 shadow-xs dark:shadow-none ${sizeClasses} ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
      )}
      {showLabel && (
        <span className="font-semibold tracking-tight">
          {isDark ? "Modo Claro" : "Modo Escuro"}
        </span>
      )}
    </button>
  );
};

interface ThemeSegmentedControlProps {
  className?: string;
}

export const ThemeSegmentedControl: React.FC<ThemeSegmentedControlProps> = ({
  className = "",
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Selecionar tema de aparência"
      className={`grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        onClick={() => setTheme("light")}
        className={`flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          theme === "light"
            ? "bg-[#FF6B00] text-white shadow-sm shadow-[#FF6B00]/25"
            : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-white/70 dark:hover:bg-[#151518]"
        }`}
      >
        <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Claro</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          theme === "dark"
            ? "bg-[#FF6B00] text-white shadow-sm shadow-[#FF6B00]/25"
            : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-white/70 dark:hover:bg-[#151518]"
        }`}
      >
        <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Escuro</span>
      </button>
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "Ocorreu um erro inesperado.",
    };
  }

  componentDidCatch(error: Error) {
    console.error("Personal Nutri Fit ErrorBoundary caught:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyMessage =
      "Ocorreu um erro ao carregar os dados. Tente recarregar a página.";
    if (this.state.message.includes("Quota exceeded")) {
      friendlyMessage =
        "O limite diário gratuito de operações do banco foi atingido e será renovado amanhã.";
    } else if (this.state.message.includes("Missing or insufficient permissions")) {
      friendlyMessage =
        "Sua sessão precisa ser reautenticada para acessar os dados salvos com segurança.";
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex items-center justify-center p-6 transition-colors duration-200">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-white">
            Algo interrompeu seu treino
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
            {friendlyMessage}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-[46px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Recarregar Personal Nutri Fit</span>
          </button>
        </div>
      </div>
    );
  }
}
