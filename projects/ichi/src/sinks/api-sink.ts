import { AbsintheApiClient } from '@absinthe/common';
import { Sink } from '../types';

class ApiSink implements Sink {
  constructor(private apiClient: AbsintheApiClient) {}

  async write(batch: any[]): Promise<void> {
    if (!batch || batch.length === 0) {
      return;
    }

    console.log(JSON.stringify(batch, null, 2));

    console.log(`Sending ${batch.length} items to Absinthe API`);
    await this.apiClient.send(batch);
  }
}

export { ApiSink };
