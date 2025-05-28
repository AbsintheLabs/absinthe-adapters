import { createApp } from './app';
import { config } from './config';

/**
 * Start the server
 */
const startServer = (): void => {
    const app = createApp();

    app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
    });
};

// Start the application
startServer(); 