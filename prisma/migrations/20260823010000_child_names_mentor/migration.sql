-- The child names their own mentor during the first session.
ALTER TABLE "MentorProfile" ALTER COLUMN "mentorName" DROP DEFAULT;
ALTER TABLE "MentorProfile" ALTER COLUMN "mentorName" DROP NOT NULL;
UPDATE "MentorProfile" SET "mentorName" = NULL WHERE "mentorName" = 'Nova';
ALTER TABLE "MentorProfile" ADD COLUMN IF NOT EXISTS "mentorNamedAt" TIMESTAMP(3);
