-- Step 7 TEAR on Threat
ALTER TABLE "threats"
  ADD COLUMN "tear_strategy" "tear_strategy",
  ADD COLUMN "alarp_justification" TEXT;
