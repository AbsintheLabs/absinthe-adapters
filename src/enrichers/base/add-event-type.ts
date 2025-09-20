// enrichers/base/add-event-type.ts
import { Enricher } from '../core.ts';

type EventTypeField = {
  eventType: string;
};

export const addTWBEventType = <T extends object>(): Enricher<T, T & EventTypeField> => {
  return (item) => {
    return {
      ...item,
      // Hardcoded per spec
      eventType: 'time_weighted_balance',
    };
  };
};
