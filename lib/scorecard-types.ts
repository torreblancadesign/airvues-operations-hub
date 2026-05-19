// Client-safe types for the /me personal scorecard.
import { Story } from "./engineering-types";

export type ScorecardEngineer = {
  id: string;
  name: string;
  role: string | null;
  internalType: string | null;
  isOrphan: boolean;
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
    openCommission: number;
    earnedInvoice: number;
    earnedCommission: number;
  };
  company: {
    ytdRevenue: number;
    revenueGoal: number;
    bonusStretch: number;
    bonusTier: "locked" | "tier1" | "tier2";
  };
};

export type ScorecardPayload = {
  scorecard: Scorecard | null;
  engineers: ScorecardEngineer[];
};
