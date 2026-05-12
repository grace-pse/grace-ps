-- Per-question surveyor comments. Stored as a parallel JSON map
-- ({ [questionId]: commentText }) on SurveyResponse so scoring,
-- AAA scoring, and drift logic that read `answers` are unaffected.

ALTER TABLE "survey_responses"
  ADD COLUMN "comments" JSONB NOT NULL DEFAULT '{}';
