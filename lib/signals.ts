// Open-web signals a person logs against a company: a raise, a launch, a hire, press. Each one keeps its
// source, so "look again" can show why. Points come from the same lookAgain() rule as the sample signals.
import type { SignalKind } from "./flow";

export const SIGNAL_TYPES = ["Raised", "Launched", "Hired", "Expanded", "Press/News", "Trigger met", "Pitched again", "Shut down"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface LoggedSignal {
  id: string;
  kind: SignalType;
  /** YYYY-MM-DD the event happened. */
  at: string;
  text: string;
  publisher?: string;
  url?: string;
  note?: string;
  by: string;
  /** When it was logged (ISO). */
  loggedAt: string;
}

/** How a logged type maps onto the kinds lookAgain() scores. */
export function toFlowKind(t: SignalType): SignalKind {
  switch (t) {
    case "Raised":
      return "Raised elsewhere";
    case "Trigger met":
      return "Trigger met";
    case "Pitched again":
      return "Pitched again";
    case "Shut down":
      return "Shut down";
    default:
      return "Team grew";
  }
}

export const SIGNAL_HELP: Record<SignalType, string> = {
  Raised: "Raised a round from someone else. Counts 3 points towards look again.",
  Launched: "Shipped a product or entered a market. Context only; no points.",
  Hired: "A senior hire or team growth. Context only; no points.",
  Expanded: "New geography or segment. Context only; no points.",
  "Press/News": "Coverage worth keeping. Context only; no points.",
  "Trigger met": "The re-engage condition set at the pass has been met. Counts 3 points.",
  "Pitched again": "The founder came back with a new deck. Counts 2 points.",
  "Shut down": "The company closed. Removes it from look again.",
};
