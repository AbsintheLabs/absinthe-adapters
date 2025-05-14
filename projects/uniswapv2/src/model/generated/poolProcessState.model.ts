import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PoolConfig} from "./poolConfig.model"

@Entity_()
export class PoolProcessState {
    constructor(props?: Partial<PoolProcessState>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PoolConfig, {nullable: true})
    pool!: PoolConfig

    @BigIntColumn_({nullable: true})
    lastInterpolatedTs!: bigint | undefined | null
}
