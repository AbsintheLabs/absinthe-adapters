import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"
import {PoolConfig} from "./poolConfig.model"

@Entity_()
export class PoolState {
    constructor(props?: Partial<PoolState>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PoolConfig, {nullable: true})
    pool!: PoolConfig

    @BigIntColumn_({nullable: false})
    reserve0!: bigint

    @BigIntColumn_({nullable: false})
    reserve1!: bigint

    @BigIntColumn_({nullable: false})
    totalSupply!: bigint

    @IntColumn_({nullable: false})
    lastBlock!: number

    @BigIntColumn_({nullable: false})
    lastTsMs!: bigint

    @DateTimeColumn_({nullable: false})
    updatedAt!: Date
}
