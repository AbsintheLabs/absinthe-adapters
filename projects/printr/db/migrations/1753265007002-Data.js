module.exports = class Data1753265007002 {
    name = 'Data1753265007002'

    async up(db) {
        await db.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "decimals" integer NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "pool" ("id" character varying NOT NULL, "address" text NOT NULL, "token0_address" text NOT NULL, "token1_address" text NOT NULL, "fee" integer NOT NULL, "is_active" boolean NOT NULL, CONSTRAINT "PK_db1bfe411e1516c01120b85f8fe" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_0764827295d4ed49e259aa398f" ON "pool" ("address") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "token"`)
        await db.query(`DROP TABLE "pool"`)
        await db.query(`DROP INDEX "public"."IDX_0764827295d4ed49e259aa398f"`)
    }
}
