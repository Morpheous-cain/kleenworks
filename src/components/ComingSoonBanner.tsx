import { Sparkles } from "lucide-react";

interface ComingSoonBannerProps {
  feature: string;
  detail?: string;
}

/**
 * Drop this directly under a page's <header> for any tab that is
 * still rendering preview/sample data instead of live data from the API.
 * Keeps the tab visible/explorable for stakeholders without implying
 * the numbers shown are real.
 */
export function ComingSoonBanner({ feature, detail }: ComingSoonBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/30">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
        <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
          {feature} — Coming Soon
        </p>
        <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400/70">
          {detail ?? "This page is a preview. The data shown below is sample data and isn't connected to your live account yet."}
        </p>
      </div>
    </div>
  );
}
