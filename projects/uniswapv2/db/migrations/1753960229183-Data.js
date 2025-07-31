module.exports = class Data1753960229183 {
    name = 'Data1753960229183'

    async up(db) {
        await db.query(`CREATE TABLE "active_balances" ("id" character varying NOT NULL, "active_balances_map" jsonb NOT NULL, CONSTRAINT "PK_74928f950c9f521a27a8e273458" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "address" text NOT NULL, "decimals" integer NOT NULL, "coingecko_id" text, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_40a4dcc6b727285c6539aa1d1c" ON "token" ("address") `)
        await db.query(`CREATE TABLE "pool_config" ("id" character varying NOT NULL, "token0_id" character varying, "token1_id" character varying, "lp_token_id" character varying, CONSTRAINT "PK_cba734efedb40dfc544c955a9bc" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_166e44755f7ce13517522d61f6" ON "pool_config" ("token0_id") `)
        await db.query(`CREATE INDEX "IDX_f6d805a451f97d89e4d8c5de32" ON "pool_config" ("token1_id") `)
        await db.query(`CREATE INDEX "IDX_59dfa786d57faacfad31e3dd41" ON "pool_config" ("lp_token_id") `)
        await db.query(`CREATE TABLE "pool_process_state" ("id" character varying NOT NULL, "last_interpolated_ts" numeric, "pool_id" character varying, CONSTRAINT "PK_ce5faef0da4676fbbf3736dd9d9" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_ebe20179c7605f00942cdaf4bf" ON "pool_process_state" ("pool_id") `)
        await db.query(`CREATE TABLE "pool_state" ("id" character varying NOT NULL, "reserve0" numeric NOT NULL, "reserve1" numeric NOT NULL, "total_supply" numeric NOT NULL, "last_block" integer NOT NULL, "last_ts_ms" numeric NOT NULL, "last_interpolated_ts" numeric, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_dirty" boolean NOT NULL, "pool_id" character varying, CONSTRAINT "PK_ee1996f0e117f7cfdfb3e42ffab" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_dce90a2f3a7694e9f1d4b80f19" ON "pool_state" ("pool_id") `)
        await db.query(`ALTER TABLE "pool_config" ADD CONSTRAINT "FK_166e44755f7ce13517522d61f65" FOREIGN KEY ("token0_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "pool_config" ADD CONSTRAINT "FK_f6d805a451f97d89e4d8c5de324" FOREIGN KEY ("token1_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "pool_config" ADD CONSTRAINT "FK_59dfa786d57faacfad31e3dd413" FOREIGN KEY ("lp_token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "pool_process_state" ADD CONSTRAINT "FK_ebe20179c7605f00942cdaf4bfd" FOREIGN KEY ("pool_id") REFERENCES "pool_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "pool_state" ADD CONSTRAINT "FK_dce90a2f3a7694e9f1d4b80f196" FOREIGN KEY ("pool_id") REFERENCES "pool_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`DROP TABLE "active_balances"`)
        await db.query(`DROP TABLE "token"`)
        await db.query(`DROP INDEX "public"."IDX_40a4dcc6b727285c6539aa1d1c"`)
        await db.query(`DROP TABLE "pool_config"`)
        await db.query(`DROP INDEX "public"."IDX_166e44755f7ce13517522d61f6"`)
        await db.query(`DROP INDEX "public"."IDX_f6d805a451f97d89e4d8c5de32"`)
        await db.query(`DROP INDEX "public"."IDX_59dfa786d57faacfad31e3dd41"`)
        await db.query(`DROP TABLE "pool_process_state"`)
        await db.query(`DROP INDEX "public"."IDX_ebe20179c7605f00942cdaf4bf"`)
        await db.query(`DROP TABLE "pool_state"`)
        await db.query(`DROP INDEX "public"."IDX_dce90a2f3a7694e9f1d4b80f19"`)
        await db.query(`ALTER TABLE "pool_config" DROP CONSTRAINT "FK_166e44755f7ce13517522d61f65"`)
        await db.query(`ALTER TABLE "pool_config" DROP CONSTRAINT "FK_f6d805a451f97d89e4d8c5de324"`)
        await db.query(`ALTER TABLE "pool_config" DROP CONSTRAINT "FK_59dfa786d57faacfad31e3dd413"`)
        await db.query(`ALTER TABLE "pool_process_state" DROP CONSTRAINT "FK_ebe20179c7605f00942cdaf4bfd"`)
        await db.query(`ALTER TABLE "pool_state" DROP CONSTRAINT "FK_dce90a2f3a7694e9f1d4b80f196"`)
    }
}
