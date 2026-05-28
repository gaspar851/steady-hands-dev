import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { TradeWorkspace } from "@/components/trade/TradeWorkspace";
import { getMyProfile } from "@/lib/profile.functions";
import type { ProfileDTO } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/trade")({
  head: () => ({
    meta: [
      { title: "Trade — Open Trader" },
      { name: "description", content: "Your demo trading workspace." },
    ],
  }),
  component: TradePage,
});

function TradePage() {
  const { t } = useTranslation();
  const fetchMe = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery<{ profile: ProfileDTO; roles: string[] }>({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
  });
  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">{t("trade.loading_workspace")}</div>;
  return <TradeWorkspace profile={data.profile} />;
}

