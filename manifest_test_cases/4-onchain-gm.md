TEST CASE 4: onchain gm - action with quantity

## manifest

```ts
{
  name: "onchain-gm",
  version: "0.0.1",
  trackableTypes: [
    {
      id: "gm",
      kind: "action",
      quantityType: "count",
      inputs: [
        {
          role: "gmAddress",
          requiredWhen: "always",
          description: "GM contract address"
        },
      ],
    }
  ]
}
```

## config

```ts
{
  adapter: "onchain-gm",
  version: "0.0.1",
  trackableInstances: [
    {
      itemId: "gm",
      inputs: {
        gmAddress: "0x1234567890123456789012345678901234567890"
      }
    }
  ]
}
```
