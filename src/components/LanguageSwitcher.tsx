import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current =
    LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ??
    LANGUAGES.find((l) => l.code === (i18n.language || "en").split("-")[0]) ??
    LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("common.language")}
          title={current.label}
        >
          <span className="text-lg leading-none" aria-hidden>{current.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[3rem] p-1">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            aria-label={l.label}
            title={l.label}
            className={
              "flex justify-center px-2 py-1.5 " +
              (l.code === current.code ? "bg-accent" : "")
            }
          >
            <span className="text-lg leading-none" aria-hidden>{l.flag}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
