import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@absinthe/common';

const HEIGHT_FILE = path.join(__dirname, '../../preload-height.json');

interface HeightData {
  lastProcessedHeight: number;
  timestamp: number;
  phase: 'preload' | 'main';
}

export class HeightStorage {
  /**
   * Store the last processed height to file
   */
  static async storeHeight(height: number, phase: 'preload' | 'main'): Promise<void> {
    try {
      const data: HeightData = {
        lastProcessedHeight: height,
        timestamp: Date.now(),
        phase,
      };

      await fs.promises.writeFile(HEIGHT_FILE, JSON.stringify(data, null, 2));
      logger.info(`📁 Stored height ${height} (phase: ${phase}) to file`);
    } catch (error) {
      logger.error(`❌ Failed to store height ${height}:`, error);
    }
  }

  /**
   * Get the last processed height from file
   */
  static async getHeight(): Promise<{ height: number; phase: 'preload' | 'main' } | null> {
    try {
      if (!fs.existsSync(HEIGHT_FILE)) {
        logger.info('📁 No height file found, starting fresh');
        return null;
      }

      const content = await fs.promises.readFile(HEIGHT_FILE, 'utf8');
      const data: HeightData = JSON.parse(content);

      logger.info(
        `📁 Retrieved height ${data.lastProcessedHeight} (phase: ${data.phase}) from file`,
      );
      return {
        height: data.lastProcessedHeight,
        phase: data.phase,
      };
    } catch (error) {
      logger.error('❌ Failed to read height file:', error);
      return null;
    }
  }

  /**
   * Check if preload phase is complete
   */
  static async isPreloadComplete(): Promise<boolean> {
    const data = await this.getHeight();
    return data !== null && data.phase === 'preload';
  }

  /**
   * Clear the height file (for restarting)
   */
  static async clearHeight(): Promise<void> {
    try {
      if (fs.existsSync(HEIGHT_FILE)) {
        await fs.promises.unlink(HEIGHT_FILE);
        logger.info('📁 Cleared height file');
      }
    } catch (error) {
      logger.error('❌ Failed to clear height file:', error);
    }
  }
}
