Steps I had to do:

1. create project folder
   1. abi (.json files)
   2. src
      1. /abi
      2. main.ts
      3. processor.ts
2. Create abi typing with `npx squid-evm-typegen <dest> <abis....>
   1. specifically: `npx squid-evm-typegen projects/compoundv2/src/abi projects/compoundv2/abi/*.json`
3. Create codegen for typeorm models
   1. specifically: `npx squid-typeorm-codegen`
4. Create db/migration for typeorm models
   1. make sure to rebuild first: `pnpm --filter <project> build`
   1. specifically: `dotenv -e <.env> -- npx squid-typeorm-migration generate`
5. apply migration
   1. specifically: `dotenv -e <.env> -- npx squid-typeorm-migration apply`
