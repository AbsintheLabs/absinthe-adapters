module.exports = class Data1749832533885 {
    name = 'Data1749832533885'

    async up(db) {
        await db.query(`ALTER TABLE "pool_process_state" DROP COLUMN "last_interpolated_ts"`)
        await db.query(`ALTER TABLE "pool_process_state" ADD "last_interpolated_ts" numeric`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "pool_process_state" ADD "last_interpolated_ts" integer`)
        await db.query(`ALTER TABLE "pool_process_state" DROP COLUMN "last_interpolated_ts"`)
    }
}
