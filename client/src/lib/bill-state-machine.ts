import { createMachine, assign, interpret } from '@xstate/fsm';

// Define bill generation states
export enum BillState {
  IDLE = 'idle',
  SELECTING_TYPE = 'selectingType',
  SELECTING_CUSTOMERS = 'selectingCustomers',
  REVIEWING = 'reviewing',
  GENERATING = 'generating',
  GENERATED = 'generated',
  FAILED = 'failed',
}

// Define bill types
export enum BillType {
  INDIVIDUAL = 'individual',
  COMBINED = 'combined',
  CUSTOM = 'custom',
}

// Define events that can be sent to the machine
export type BillEvent =
  | { type: 'SELECT_TYPE'; billType: BillType }
  | { type: 'SELECT_CUSTOMER'; customerId: number }
  | { type: 'UNSELECT_CUSTOMER'; customerId: number }
  | { type: 'REVIEW' }
  | { type: 'GENERATE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; error: string }
  | { type: 'RESET' };

// Define the context (state data)
interface BillContext {
  billType: BillType | null;
  selectedCustomerIds: number[];
  error: string | null;
  generatedBillIds: number[];
}

// Create the state machine
export const createBillMachine = () => {
  return createMachine<BillContext, BillEvent>({
    id: 'billGeneration',
    initial: BillState.IDLE,
    context: {
      billType: null,
      selectedCustomerIds: [],
      error: null,
      generatedBillIds: []
    },
    states: {
      [BillState.IDLE]: {
        on: {
          // @ts-ignore - XState type compatibility issue
          SELECT_TYPE: {
            target: BillState.SELECTING_TYPE,
            actions: assign({
              billType: (_, event) => event.billType,
              selectedCustomerIds: () => [] // Reset selections when changing type
            })
          }
        }
      },
      [BillState.SELECTING_TYPE]: {
        on: {
          // @ts-ignore - XState type compatibility issue
          SELECT_TYPE: {
            target: BillState.SELECTING_TYPE,
            actions: assign({
              billType: (_, event) => event.billType,
              selectedCustomerIds: () => [] // Reset selections when changing type
            })
          },
          SELECT_CUSTOMER: [
            {
              // Only allow customer selection for custom bill type
              cond: (context) => context.billType === BillType.CUSTOM,
              actions: assign({
                selectedCustomerIds: (context, event) => 
                  [...context.selectedCustomerIds, event.customerId]
              })
            }
          ],
          UNSELECT_CUSTOMER: [
            {
              cond: (context) => context.billType === BillType.CUSTOM,
              actions: assign({
                selectedCustomerIds: (context, event) => 
                  context.selectedCustomerIds.filter(id => id !== event.customerId)
              })
            }
          ],
          REVIEW: [
            {
              // For individual or combined, always go to review
              cond: (context) => 
                context.billType === BillType.INDIVIDUAL || 
                context.billType === BillType.COMBINED,
              target: BillState.REVIEWING
            },
            {
              // For custom, only go to review if customers are selected
              cond: (context) => 
                context.billType === BillType.CUSTOM && 
                context.selectedCustomerIds.length > 0,
              target: BillState.REVIEWING
            }
          ]
        }
      },
      [BillState.SELECTING_CUSTOMERS]: {
        on: {
          SELECT_CUSTOMER: {
            actions: assign({
              selectedCustomerIds: (context, event) => 
                [...context.selectedCustomerIds, event.customerId]
            })
          },
          UNSELECT_CUSTOMER: {
            actions: assign({
              selectedCustomerIds: (context, event) => 
                context.selectedCustomerIds.filter(id => id !== event.customerId)
            })
          },
          REVIEW: {
            target: BillState.REVIEWING,
            // Only allow review if at least one customer is selected for custom bills
            cond: (context) => 
              context.billType !== BillType.CUSTOM || 
              context.selectedCustomerIds.length > 0
          }
        }
      },
      [BillState.REVIEWING]: {
        on: {
          GENERATE: {
            target: BillState.GENERATING
          },
          // @ts-ignore - XState type compatibility issue
          SELECT_TYPE: {
            target: BillState.SELECTING_TYPE,
            actions: assign({
              billType: (_, event) => event.billType,
              selectedCustomerIds: () => [] // Reset selections when changing type
            })
          }
        }
      },
      [BillState.GENERATING]: {
        on: {
          SUCCESS: {
            target: BillState.GENERATED,
            actions: assign({
              // @ts-ignore - XState type compatibility issue
              generatedBillIds: (_, event) => event.generatedBillIds || []
            })
          },
          FAILURE: {
            target: BillState.FAILED,
            actions: assign({
              error: (_, event) => event.error
            })
          }
        }
      },
      [BillState.GENERATED]: {
        on: {
          // @ts-ignore - XState type compatibility issue
          RESET: {
            target: BillState.IDLE,
            actions: assign({
              billType: null,
              selectedCustomerIds: [],
              error: null,
              generatedBillIds: []
            })
          }
        }
      },
      [BillState.FAILED]: {
        on: {
          // @ts-ignore - XState type compatibility issue
          RESET: {
            target: BillState.IDLE,
            actions: assign({
              error: null
            })
          }
        }
      }
    }
  });
};

// Create a service to interpret the machine
export const createBillService = () => {
  const billMachine = createBillMachine();
  // @ts-ignore - XState type compatibility issue
  return interpret(billMachine);
};

// Utility functions to work with the machine
export const canReviewBill = (state: any) => {
  const { billType, selectedCustomerIds } = state.context;
  
  if (billType === BillType.INDIVIDUAL || billType === BillType.COMBINED) {
    return true;
  }
  
  if (billType === BillType.CUSTOM) {
    return selectedCustomerIds.length > 0;
  }
  
  return false;
};

export const canGenerateBill = (state: any) => {
  return state.matches(BillState.REVIEWING);
};

export const isGeneratingBill = (state: any) => {
  return state.matches(BillState.GENERATING);
};

export const getBillError = (state: any) => {
  return state.context.error;
};

export const getSelectedCustomerIds = (state: any) => {
  return state.context.selectedCustomerIds;
}; 