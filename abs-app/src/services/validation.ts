import Ajv, { ValidateFunction } from 'ajv';

// Import schemas as JSON
const baseSchema = require('../../../packages/common/src/schemas/base.schema.json');
const transactionSchema = require('../../../packages/common/src/schemas/transaction.schema.json');
const timeWeightedBalanceSchema = require('../../../packages/common/src/schemas/timeWeightedBalance.schema.json');

export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
    eventType?: string;
}

class ValidationService {
    private ajv: Ajv;
    private transactionValidator: ValidateFunction;
    private timeWeightedBalanceValidator: ValidateFunction;

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            strict: false,
            addUsedSchema: false // Prevent automatic schema addition
        });

        try {
            // Add base schema first with its $id
            this.ajv.addSchema(baseSchema);

            // Compile validators for each event type
            this.transactionValidator = this.ajv.compile(transactionSchema);
            this.timeWeightedBalanceValidator = this.ajv.compile(timeWeightedBalanceSchema);

            console.log('✅ Schema validation service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize validation service:', error);
            throw error;
        }
    }

    /**
     * Validates a request body against the appropriate schema based on eventType
     */
    public validateRequest(requestBody: any): ValidationResult {
        if (!requestBody || typeof requestBody !== 'object') {
            return {
                isValid: false,
                errors: ['Request body must be a valid object']
            };
        }

        const eventType = requestBody.eventType;

        if (!eventType) {
            return {
                isValid: false,
                errors: ['eventType is required']
            };
        }

        let validator: ValidateFunction;

        switch (eventType) {
            case 'transaction':
                validator = this.transactionValidator;
                break;
            case 'timeWeightedBalance':
                validator = this.timeWeightedBalanceValidator;
                break;
            default:
                return {
                    isValid: false,
                    errors: [`Unsupported eventType: ${eventType}. Must be 'transaction' or 'timeWeightedBalance'`]
                };
        }

        const isValid = validator(requestBody);

        if (!isValid) {
            const errors = validator.errors?.map(error => {
                const instancePath = error.instancePath || 'root';
                const schemaPath = error.schemaPath;
                const message = error.message;
                const data = error.data !== undefined ? ` (received: ${JSON.stringify(error.data)})` : '';
                return `${instancePath}: ${message}${data}`;
            }) || ['Unknown validation error'];

            return {
                isValid: false,
                errors,
                eventType
            };
        }

        return {
            isValid: true,
            eventType
        };
    }

    /**
     * Get detailed validation errors for debugging
     */
    public getDetailedErrors(requestBody: any): any[] {
        const eventType = requestBody?.eventType;
        let validator: ValidateFunction;

        switch (eventType) {
            case 'transaction':
                validator = this.transactionValidator;
                break;
            case 'timeWeightedBalance':
                validator = this.timeWeightedBalanceValidator;
                break;
            default:
                return [{ message: `Unsupported eventType: ${eventType}` }];
        }

        validator(requestBody);
        return validator.errors || [];
    }

    /**
     * Get supported event types
     */
    public getSupportedEventTypes(): string[] {
        return ['transaction', 'timeWeightedBalance'];
    }
}

export const validationService = new ValidationService(); 