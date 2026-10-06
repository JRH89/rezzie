import type { CreditBalance } from "./api";

type GenerationOptions = {
  credentialMode: "byok" | "subscription";
  hasApiKey: boolean;
  balance?: CreditBalance;
  balanceFailed: boolean;
  usesTrustedSources: boolean;
  includesResume: boolean;
  includesCoverLetter: boolean;
};

export function generationAccess(options: GenerationOptions) {
  const subscriber = ["active", "trialing"].includes(
    options.balance?.subscription_status ?? "",
  );
  // Estimate the API's existing charge rules. The server remains authoritative
  // and rechecks the balance before generation; BYOK is allowed with sources.
  const sourceCredits = options.usesTrustedSources && !subscriber ? 1 : 0;
  const credits = options.balance?.unlimited
    ? 0
    : Number(options.credentialMode === "subscription" && options.includesResume) +
      Number(options.includesCoverLetter) +
      sourceCredits;

  let blockedReason: string | undefined;
  if (options.credentialMode === "byok" && !options.hasApiKey) {
    blockedReason = "Enter your Anthropic API key to continue.";
  } else if (credits > 0 && !options.balance) {
    blockedReason = options.balanceFailed
      ? "We could not check your credit balance. Retry to continue."
      : "Checking your credit balance…";
  } else if (credits > 0 && options.balance) {
    const available =
      options.balance.subscription_remaining + options.balance.purchased_credits;
    if (available < credits) {
      blockedReason = `This run needs ${credits} Rezzie ${credits === 1 ? "credit" : "credits"}; you have ${available}.`;
    }
  }

  return { credits, blockedReason };
}
