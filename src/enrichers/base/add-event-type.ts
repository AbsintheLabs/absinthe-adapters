// enrichers/base/add-event-type.ts
import { Enricher } from '../core.ts';

type ActionEventTypeField = {
  event_type: 'action';
};

type TWBEventTypeField = {
  event_type: 'time_weighted_balance';
};

export const addTWBEventType = <T extends object>(): Enricher<T, T & TWBEventTypeField> => {
  return (item) => {
    return {
      ...item,
      // Hardcoded per spec
      event_type: 'time_weighted_balance',
    };
  };
};

export const addActionEventType = <T extends object>(): Enricher<T, T & ActionEventTypeField> => {
  return (item) => {
    return {
      ...item,
      event_type: 'action',
    };
  };
};
