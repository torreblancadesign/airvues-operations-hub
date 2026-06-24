// Display labels + help copy for the two confusable Quote status fields.
// Underlying types (status / projectStatus) keep their names — this is
// pure UI vocabulary. Change here once to relabel everywhere.

export const DEAL_STAGE_LABEL = "Deal Stage";
export const DEAL_STAGE_HELP =
  "Internal sales pipeline — where the proposal document sits in our workflow. Not shown to the client.";

export const CLIENT_JOURNEY_LABEL = "Proposal Status";
export const CLIENT_JOURNEY_HELP =
  "Client-facing delivery milestone — the 7-stage progress bar shown on the web quote. (Airtable field: Project Status)";
