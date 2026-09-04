-- Add a per-turn discourse `move` (expand/clarify/pushback/probe/reframe/
-- concede_qualify/respond) so managed discussions rotate reply types instead of
-- defaulting to agreement. Nullable — legacy/plain turns leave it NULL.
ALTER TABLE bom_ai_discussion_turn
  ADD COLUMN move VARCHAR(24) NULL AFTER ordinal;
