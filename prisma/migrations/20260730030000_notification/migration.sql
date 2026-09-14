-- Notifikasi antar-user (persisted, lintas sesi/perangkat).
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "usernames" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
