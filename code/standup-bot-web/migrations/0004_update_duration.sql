-- Length of a voice clip, for the "hours saved" stat; NULL for text updates and clips Slack gave no length for
ALTER TABLE updates ADD COLUMN duration_ms INTEGER;
