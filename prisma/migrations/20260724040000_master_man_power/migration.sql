-- Roster Man Power per Group Head, supaya operator bisa pilih anak buah
-- Group Head yang lagi bertugas (bisa pindah shift/tempat, tinggal edit
-- field group_head-nya).
CREATE TABLE "MasterManPower" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group_head" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterManPower_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MasterManPower_name_key" ON "MasterManPower"("name");
