// Client-safe types for the /me personal scorecard.
import { Story } from "./engineering-types";

export type ScorecardEngineer = {
  id: string;
  name: string;
  role: string | null;
  internalType: string | null;
  isOrphan: boolean;
};

export type EarningsBuckets = {
  lifetime: number;
  ytd: number;
  mtd: number;
  outstanding: number;
};

export type ShippedBuckets = {
  lifetime: number;
  ytd: number;
  mtd: number;
};

export type ScorecardPayment = {
  id: string;
  amount: number;
  status: string | null;
  date: string | null;
  function: string | null;
  client: string | null;
  project: string | null;
  airtableUrl: string;
};

export type Scorecard = {
  engineer: ScorecardEngineer;
  stories: Story[];
  nextToShip: Story[];
  byStatus: {
    inProgress: Story[];
    todo: Story[];
    qa: Story[];
    onHold: Story[];
    done: Story[];
  };
  totals: {
    storyCount: number;
    activeCount: number;
    doneCount: number;
    inProgressCount: number;
    todoCount: number;
    onHoldCount: number;
    qaCount: number;
    openInvoice: number;
    openCost: number;
    openCommission: number;
    earnedInvoice: number;
    earnedCost: number;
    earnedCommission: number;
  };
  earnings: EarningsBuckets;
  payments: ScorecardPayment[];
  shipped: ShippedBuckets;
  /**
   * Annual earnings goal from People.Annual Earnings Goal (USD).
   * Null when not set — UI shows a "set a goal" placeholder.
   */
  goal: {
    annualEarnings: number | null;
  };
  /**
   * True when story YTD/MTD buckets are approximated from Sprint End
   * (no real Completed Date field on Stories yet).
   */
  shippedIsApproximate: boolean;
  /**
   * Commission rate used for this person's projections (decimal, e.g. 0.15).
   * Pulled from People.Commission Percentage; falls back to global 15%.
   */
  commissionPct: number;
  commissionPctSource: "person" | "default";
};

export type ScorecardPayload = {
  scorecard: Scorecard | null;
  engineers: ScorecardEngineer[];
};
