module.exports = class Data1750788039732 {
    name = 'Data1750788039732'

    async up(db) {
        await db.query(`CREATE TABLE "active_balances" ("id" character varying NOT NULL, "active_balances_map" jsonb NOT NULL, CONSTRAINT "PK_74928f950c9f521a27a8e273458" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "pool_process_state" ("id" character varying NOT NULL, "last_interpolated_ts" numeric, CONSTRAINT "PK_ce5faef0da4676fbbf3736dd9d9" PRIMARY KEY ("id"))`)
    }

    async down(db) {
        await db.query(`DROP TABLE "active_balances"`)
        await db.query(`DROP TABLE "pool_process_state"`)
    }
}
