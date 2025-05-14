import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    @IntColumn_({nullable: false})
    decimals!: number

    @StringColumn_({nullable: true})
    coingeckoId!: string | undefined | null
}
