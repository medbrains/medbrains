/** The `/onboarding` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  OnboardingInitRequest,
  OnboardingInitResponse,
  OnboardingProgress,
  OnboardingSetupRequest,
  OnboardingStatusResponse,
  Sizing,
  TrialPlan,
} from "@medbrains/types";
import { request } from "../client.js";

export const onboardingApi = {
  // Onboarding
  onboardingStatus: () => request<OnboardingStatusResponse>("/onboarding/status"),
  onboardingInit: (data: OnboardingInitRequest) =>
    request<OnboardingInitResponse>("/onboarding/init", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTrialSizing: (data: TrialPlan) =>
    request<Sizing>("/onboarding/sizing", { method: "POST", body: JSON.stringify(data) }),
  onboardingProgress: () => request<OnboardingProgress>("/onboarding/progress"),
  updateOnboardingProgress: (data: { current_step: number; completed_steps: number[] }) =>
    request<OnboardingProgress>("/onboarding/progress", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  onboardingSetup: (data: OnboardingSetupRequest) =>
    request<{ status: string }>("/onboarding/setup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeOnboarding: () => request<{ status: string }>("/onboarding/complete", { method: "POST" }),
};
