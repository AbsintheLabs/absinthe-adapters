// import * as avro from 'avsc';
// import { MessageType } from '../utils/enums';
// import { baseSchema, transactionSchema, timeWeightedBalanceSchema } from '../schemas/index';

// export interface ValidationResult {
//     isValid: boolean;
//     errors?: string[];
//     eventType?: string;
// }

// class ValidationService {
//     private transactionType: avro.Type;
//     private timeWeightedBalanceType: avro.Type;
//     private baseType: avro.Type;

//     constructor() {
//         try {
//             // Avro configuration equivalent to AJV settings
//             const avroOptions = {
//                 // Equivalent to allErrors: true - we'll collect all errors manually
//                 // Equivalent to strict: false - allow some flexibility
//                 noAnonymousTypes: false,
//                 // Equivalent to addUsedSchema: false - we control schema registration
//                 wrapUnions: false
//             };

//             this.baseType = avro.Type.forSchema(baseSchema, avroOptions);

//             const registry = {
//                 'network.absinthe.adapters.Base': this.baseType,
//             };

//             // Pass both registry and options
//             this.transactionType = avro.Type.forSchema(transactionSchema, {
//                 ...avroOptions,
//                 registry
//             });
//             this.timeWeightedBalanceType = avro.Type.forSchema(timeWeightedBalanceSchema, {
//                 ...avroOptions,
//                 registry
//             });

//             console.log('✅ Avro schema validation service initialized successfully');
//         } catch (error) {
//             console.error('❌ Failed to initialize Avro validation service:', error);
//             throw error;
//         }
//     }

//     /**
//      * Validates a request body against the appropriate schema based on eventType
//      * (Mimicking AJV behavior as closely as possible)
//      */
//     public validateRequest(requestBody: any): ValidationResult {
//         if (!requestBody || typeof requestBody !== 'object') {
//             return {
//                 isValid: false,
//                 errors: ['Request body must be a valid object']
//             };
//         }

//         const eventType = requestBody.eventType;

//         if (!eventType) {
//             return {
//                 isValid: false,
//                 errors: ['eventType is required']
//             };
//         }

//         let avroType: avro.Type;

//         switch (eventType) {
//             case 'transaction':
//                 avroType = this.transactionType;
//                 break;
//             case 'timeWeightedBalance':
//                 avroType = this.timeWeightedBalanceType;
//                 break;
//             default:
//                 return {
//                     isValid: false,
//                     errors: [`Unsupported eventType: ${eventType}. Must be 'transaction' or 'timeWeightedBalance'`]
//                 };
//         }

//         const isValid = avroType.isValid(requestBody);

//         if (!isValid) {
//             // Collect all errors (equivalent to allErrors: true)
//             const errors = this.collectAllValidationErrors(avroType, requestBody);
            
//             return {
//                 isValid: false,
//                 errors,
//                 eventType
//             };
//         }

//         return {
//             isValid: true,
//             eventType
//         };
//     }

//     /**
//      * Collect all validation errors (equivalent to AJV's allErrors: true)
//      */
//     private collectAllValidationErrors(avroType: avro.Type, data: any): string[] {
//         const errors: string[] = [];
        
//         try {
//             avroType.toBuffer(data);
//         } catch (error) {
//             if (error instanceof Error) {
//                 // Parse the error message to extract multiple errors if possible
//                 const errorMessage = error.message;
                
//                 // Split on common error separators and clean up
//                 const errorParts = errorMessage.split(/(?:,\s*)|(?:\s*and\s*)|(?:\s*;\s*)/)
//                     .filter(part => part.trim().length > 0)
//                     .map(part => this.formatAvroErrorLikeAJV(part.trim()));
                
//                 if (errorParts.length > 0) {
//                     errors.push(...errorParts);
//                 } else {
//                     errors.push(this.formatAvroErrorLikeAJV(errorMessage));
//                 }
//             } else {
//                 errors.push('Unknown validation error');
//             }
//         }
        
//         return errors.length > 0 ? errors : ['Data does not match schema'];
//     }

//     /**
//      * Format Avro errors to look like AJV errors (maintaining compatibility)
//      */
//     private formatAvroErrorLikeAJV(errorMessage: string): string {
//         // Format to match AJV error style: "instancePath: message (received: data)"
//         let formatted = errorMessage
//             .replace(/invalid "([^"]*)" at path "([^"]*)"/, '$2: Invalid value "$1"')
//             .replace(/at path "([^"]*)"/, '$1: ')
//             .replace(/field "([^"]*)" is required/, '$1: Missing required field')
//             .replace(/expected type: ([^,]+), found type: ([^,]+)/, ': Expected $1, found $2');

//         // If no path was found, add "root" like AJV does
//         if (!formatted.includes(':')) {
//             formatted = `root: ${formatted}`;
//         }

//         return formatted;
//     }

//     /**
//      * Get detailed validation errors for debugging (exact same as AJV implementation)
//      */
//     public getDetailedErrors(requestBody: any): any[] {
//         const eventType = requestBody?.eventType;
//         let avroType: avro.Type;

//         switch (eventType) {
//             case 'transaction':
//                 avroType = this.transactionType;
//                 break;
//             case 'timeWeightedBalance':
//                 avroType = this.timeWeightedBalanceType;
//                 break;
//             default:
//                 return [{ message: `Unsupported eventType: ${eventType}` }];
//         }

//         const isValid = avroType.isValid(requestBody);
        
//         if (isValid) {
//             return [];
//         }

//         try {
//             avroType.toBuffer(requestBody);
//             return [{ message: 'Data does not match schema', instancePath: 'root' }];
//         } catch (error) {
//             const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
//             return [{ 
//                 message: errorMessage,
//                 instancePath: this.extractPathFromError(errorMessage) || 'root',
//                 schemaPath: 'unknown'
//             }];
//         }
//     }

//     /**
//      * Extract path from Avro error message
//      */
//     private extractPathFromError(errorMessage: string): string | null {
//         const pathMatch = errorMessage.match(/at path "([^"]*)"/);
//         return pathMatch ? pathMatch[1] : null;
//     }

//     /**
//      * Get supported event types
//      */
//     public getSupportedEventTypes(): string[] {
//         return Object.values(MessageType);
//     }

//     /**
//      * Get schema information
//      */
//     public getSchemaInfo(eventType: string): any {
//         switch (eventType) {
//             case 'transaction':
//                 return this.transactionType.schema;
//             case 'timeWeightedBalance':
//                 return this.timeWeightedBalanceType.schema;
//             default:
//                 return null;
//         }
//     }

//     /**
//      * Check if a specific field is valid for a given event type
//      */
//     public validateField(eventType: string, fieldPath: string, value: any): ValidationResult {
//         let avroType: avro.Type;

//         switch (eventType) {
//             case 'transaction':
//                 avroType = this.transactionType;
//                 break;
//             case 'timeWeightedBalance':
//                 avroType = this.timeWeightedBalanceType;
//                 break;
//             default:
//                 return {
//                     isValid: false,
//                     errors: [`Unsupported eventType: ${eventType}`]
//                 };
//         }

//         try {
//             // Create a minimal object with just this field to test
//             const testObj = this.createMinimalObjectWithField(fieldPath, value);
//             avroType.isValid(testObj);
            
//             return { isValid: true };
//         } catch (error) {
//             return {
//                 isValid: false,
//                 errors: [error instanceof Error ? error.message : 'Field validation failed']
//             };
//         }
//     }

//     /**
//      * Helper to create minimal test object for field validation
//      */
//     private createMinimalObjectWithField(fieldPath: string, value: any): any {
//         const parts = fieldPath.split('.');
//         const obj: any = {};
//         let current = obj;

//         for (let i = 0; i < parts.length - 1; i++) {
//             current[parts[i]] = {};
//             current = current[parts[i]];
//         }

//         current[parts[parts.length - 1]] = value;
//         return obj;
//     }
// }

// export const validationService = new ValidationService(); 