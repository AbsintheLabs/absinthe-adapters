module.exports = class Data1750362515299 {
    name = 'Data1750362515299'

    async up(db) {
        await db.query(`ALTER TABLE "pool_process_state" DROP CONSTRAINT "FK_ebe20179c7605f00942cdaf4bfd"`)
        await db.query(`DROP INDEX "public"."IDX_ebe20179c7605f00942cdaf4bf"`)
        await db.query(`ALTER TABLE "pool_process_state" DROP COLUMN "pool_id"`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "pool_process_state" ADD CONSTRAINT "FK_ebe20179c7605f00942cdaf4bfd" FOREIGN KEY ("pool_id") REFERENCES "pool_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`CREATE INDEX "IDX_ebe20179c7605f00942cdaf4bf" ON "pool_process_state" ("pool_id") `)
        await db.query(`ALTER TABLE "pool_process_state" ADD "pool_id" character varying`)
    }
}
