# OnlyMeID Adapter

Track user verification actions on the OnlyMeID protocol.

## Trackables

### `verify`

- **Kind**: `action`
- **Quantity Type**: `none`
- **Description**: Tracks when users call the `userVerify` function to verify their identity on OnlyMeID.

## Configuration

### Parameters

- `onlyMeIdAddress`: The OnlyMeID contract address to track (required)

### Example Configuration

```json
{
  "adapterConfig": {
    "adapterId": "onlymeid",
    "config": {
      "verify": [
        {
          "params": {
            "onlyMeIdAddress": "0xYourOnlyMeIdContractAddress"
          }
        }
      ]
    }
  }
}
```

## Notes

- This adapter tracks transaction-level events (not log events)
- Each verification emits an action with `activity: 'verify'`
- No pricing or asset information is tracked (quantityType: 'none')
- Only supports tracking one OnlyMeID contract per adapter instance (expects exactly one config entry)
