Steps I had to do:
1. create project folder
   1. abi (.json files)
   2. src
      1. /abi
      2. main.ts
      3. processor.ts
2. Create abi typing with `npx squid-evm-typegen <dest> <abis....>
   1. specifically: `npx squid-evm-typegen projects/compoundv2/src/abi projects/compoundv2/abi/*.json`
3. 