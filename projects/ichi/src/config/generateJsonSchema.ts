import * as z from 'zod';
import { AppConfig } from './schema';
import fs from 'fs';

fs.writeFileSync(
  './src/config/absconfig.json',
  JSON.stringify(z.toJSONSchema(AppConfig, { io: 'input' }), null, 2),
);
