import { ActiveBalance } from "@absinthe/common";

function mapToJson(map: Map<string, ActiveBalance>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of map.entries()) {
      result[key] = {
        balance: value.balance.toString(),
        updatedBlockTs: value.updatedBlockTs,
        updatedBlockHeight: value.updatedBlockHeight
      };
    }
    return result;
  }
  
  function jsonToMap(json: Record<string, any>): Map<string, ActiveBalance> {
    const result = new Map<string, ActiveBalance>();
    if (!json) return result;
  
    for (const [key, value] of Object.entries(json)) {
      if (key === '__metadata') continue;
      result.set(key, {
        balance: BigInt(value.balance),
        updatedBlockTs: value.updatedBlockTs,
        updatedBlockHeight: value.updatedBlockHeight
      });
    }
    return result;
  }

  export { mapToJson, jsonToMap };