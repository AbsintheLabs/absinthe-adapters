module.exports = class Data1691424065505 {
    name = 'Data1691424065505'

    async up(db) {
        await db.query(`CREATE TABLE "usdc_transfer" ("id" character varying NOT NULL, "block" integer NOT NULL, "from" text NOT NULL, "to" text NOT NULL, "value" numeric NOT NULL, "txn_hash" text NOT NULL, CONSTRAINT "PK_b0b9b4bd33005512b0ec225672e" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_9898eeb569b5efa1237c152d3e" ON "usdc_transfer" ("from") `)
        await db.query(`CREATE INDEX "IDX_2279faac5f3516882e78c92cf0" ON "usdc_transfer" ("to") `)
        await db.query(`CREATE INDEX "IDX_ee2d1922ac2009ee22c0ad5c12" ON "usdc_transfer" ("txn_hash") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "usdc_transfer"`)
        await db.query(`DROP INDEX "public"."IDX_9898eeb569b5efa1237c152d3e"`)
        await db.query(`DROP INDEX "public"."IDX_2279faac5f3516882e78c92cf0"`)
        await db.query(`DROP INDEX "public"."IDX_ee2d1922ac2009ee22c0ad5c12"`)
    }
}
