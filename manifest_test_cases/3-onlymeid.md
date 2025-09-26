TEST CASE 3: onlymeid - action with no quantity

## manifest

```ts
{
  name: "onlymeid",
  version: "0.0.1",
  trackableTypes: [
    {
      id: "verify",
      kind: "action",
      quantityType: "none",
      inputs: [
        {
          role: "onlyMeIdAddress",
          requiredWhen: "always",
          description: "OnlyMeId contract address"
        },
      ],
    }
  ]
}
```

## config

```ts
{
  adapter: "onlymeid",
  version: "0.0.1",
  trackableInstances: [
    {
      itemId: "verify",
      inputs: {
        onlyMeIdAddress: "0x1234567890123456789012345678901234567890"
      }
    }
  ]
}
```
