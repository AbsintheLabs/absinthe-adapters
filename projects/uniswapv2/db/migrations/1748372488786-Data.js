module.exports = class Data1748372488786 {
    name = 'Data1748372488786'

    async up(db) {
        await db.query(`ALTER TABLE "pool_state" ADD "last_interpolated_ts" numeric`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "pool_state" DROP COLUMN "last_interpolated_ts"`)
    }
}
