CREATE TABLE IF NOT EXISTS videos (
 id UUID PRIMARY KEY,
 topic TEXT NOT NULL,
 title TEXT,
 status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SCRIPTING','NARRATING','RENDERING','READY_FOR_REVIEW','APPROVED','REJECTED','FAILED')),
 script JSONB,
 narration TEXT,
 audio_seconds DOUBLE PRECISION,
 media_path TEXT,
 qa_report JSONB,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
