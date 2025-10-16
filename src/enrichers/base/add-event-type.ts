// enrichers/base/add-event-type.ts
import { Enricher } from '../core.ts';

type ActionEventTypeField = {
  eventType: 'action';
};

type TWBEventTypeField = {
  eventType: 'time_weighted_balance';
};

export const addTWBEventType = <T extends object>(): Enricher<T, T & TWBEventTypeField> => {
  return (item) => {
    return {
      ...item,
      // Hardcoded per spec
      eventType: 'time_weighted_balance',
    };
  };
};

export const addActionEventType = <T extends object>(): Enricher<T, T & ActionEventTypeField> => {
  return (item) => {
    return {
      ...item,
      eventType: 'action',
    };
  };
};
