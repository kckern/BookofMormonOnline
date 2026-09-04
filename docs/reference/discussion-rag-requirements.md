# Discussion RAG requirements

Discussion retrieval has two coordinated axes:

1. **Topic grounding:** derive concepts from the selected scripture passage and
   retrieve the most relevant scripture, commentary, concepts, and approved
   author-corpus evidence.
2. **Biographical grounding:** compare those concepts with reviewed life
   milestones and, later, indexed biography chunks for every eligible speaker.

The result is a single `DiscussionRetrievalPacket` containing topic evidence and
per-person biographical evidence with relevance scores. Orchestration may use
those scores to choose the best-fit speaker. Generation receives only the
selected speaker's relevant evidence, plus the topic evidence it needs.

Required invariants:

- Speaker selection and response grounding consume the same retrieval result.
- Eligibility is resolved before relevance: channel membership, joined state,
  enabled state, group language, bot class, participant role, bans/mutes, and
  group participation policy are hard filters. Retrieval cannot reintroduce an
  excluded person.
- Biography is indexed and filtered by stable `bot_id`, not display name alone.
- A passage/topic query is applied to both topical and biographical indexes.
- Reviewed hard-coded life sketches are the fallback while biography vectors
  are unavailable.
- Low relevance must fall back to normal voice rotation; it must not invent a
  personal connection.
- Bots may refer to supplied life events sparingly, but may never manufacture
  memories, quotations, motives, or events.
- Evidence retains source, locator, language, rights class, and score when the
  vector-backed implementation is added.
- Retrieval failure cannot prevent a scheduled discussion from continuing.

Current implementation: `retrieveDiscussionPacket` in
`backend/src/bots/mastra/rag.ts` performs topic retrieval and scores reviewed
life-sketch milestones. Its retriever is injectable. Future biography vector
retrieval should enrich `biographyEvidence` through this same contract rather
than introducing a second orchestration path.
