// enrichers/base/add-event-type.ts
import { Enricher } from '../core.ts';

type ActionEventTypeField = {
  topic_type: 'action';
};

type TWBEventTypeField = {
  topic_type: 'position';
};

export const addTWBEventType = <T extends object>(): Enricher<T, T & TWBEventTypeField> => {
  return (item) => {
    return {
      ...item,
      topic_type: 'position',
    };
  };
};

export const addActionEventType = <T extends object>(): Enricher<T, T & ActionEventTypeField> => {
  return (item) => {
    return {
      ...item,
      topic_type: 'action',
    };
  };
};
