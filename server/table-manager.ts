import { storage } from './storage';
import QRCode from 'qrcode';

export interface TableCreationRequest {
  restaurantId: number;
  tableNumbers: number[];
  capacity?: number;
  baseUrl?: string;
}

export interface TableDeletionRequest {
  restaurantId: number;
  tableIds: number[];
}

/**
 * Automatically creates tables for a restaurant
 */
export async function createTablesForRestaurant(request: TableCreationRequest): Promise<any[]> {
  const { restaurantId, tableNumbers, capacity = 4, baseUrl = 'http://localhost:3000' } = request;
  
  const createdTables = [];
  
  for (const tableNumber of tableNumbers) {
    try {
      // Check if table number already exists for this restaurant
      const existingTables = await storage.getTablesByRestaurantId(restaurantId);
      const tableExists = existingTables.some(table => table.number === tableNumber);
      
      if (tableExists) {
        console.log(`Table ${tableNumber} already exists for restaurant ${restaurantId}`);
        continue;
      }
      
      // Generate QR code for the table
      const qrUrl = `${baseUrl}/menu/${restaurantId}/${tableNumber}`;
      const qrCode = await QRCode.toDataURL(qrUrl);
      
      // Create the table
      const table = await storage.createTable({
        number: tableNumber,
        qrCode,
        restaurantId,
        capacity,
        isOccupied: false
      });
      
      createdTables.push(table);
      console.log(`Created table ${tableNumber} for restaurant ${restaurantId}`);
    } catch (error) {
      console.error(`Error creating table ${tableNumber} for restaurant ${restaurantId}:`, error);
      throw error;
    }
  }
  
  return createdTables;
}

/**
 * Automatically deletes tables for a restaurant
 */
export async function deleteTablesForRestaurant(request: TableDeletionRequest): Promise<boolean[]> {
  const { restaurantId, tableIds } = request;
  
  const deletionResults = [];
  
  for (const tableId of tableIds) {
    try {
      // Check if table belongs to this restaurant
      const table = await storage.getTable(tableId);
      if (!table || table.restaurantId !== restaurantId) {
        console.log(`Table ${tableId} does not belong to restaurant ${restaurantId}`);
        deletionResults.push(false);
        continue;
      }
      
      // Check if table has active sessions
      const activeSessions = await storage.getTableSessionsByRestaurantId(restaurantId, 'active');
      const hasActiveSessions = activeSessions.some(session => session.tableId === tableId);
      
      if (hasActiveSessions) {
        throw new Error(`Cannot delete table ${tableId} - it has active sessions`);
      }
      
      // Delete the table
      const deleted = await storage.deleteTable(tableId);
      deletionResults.push(deleted);
      
      if (deleted) {
        console.log(`Deleted table ${tableId} for restaurant ${restaurantId}`);
      }
    } catch (error) {
      console.error(`Error deleting table ${tableId} for restaurant ${restaurantId}:`, error);
      throw error;
    }
  }
  
  return deletionResults;
}

/**
 * Automatically creates default tables for a new restaurant (1-10)
 */
export async function createDefaultTablesForRestaurant(restaurantId: number, baseUrl?: string): Promise<any[]> {
  const defaultTableNumbers = Array.from({ length: 10 }, (_, i) => i + 1); // Tables 1-10
  
  return createTablesForRestaurant({
    restaurantId,
    tableNumbers: defaultTableNumbers,
    capacity: 4,
    baseUrl
  });
}

/**
 * Ensures that a table exists for the given restaurant and table number
 * Creates it if it doesn't exist
 */
export async function ensureTableExists(restaurantId: number, tableNumber: number, baseUrl?: string): Promise<any> {
  try {
    const existingTables = await storage.getTablesByRestaurantId(restaurantId);
    const table = existingTables.find(t => t.number === tableNumber);
    
    if (table) {
      return table;
    }
    
    // Create the table if it doesn't exist
    console.log(`Creating missing table ${tableNumber} for restaurant ${restaurantId}`);
    const createdTables = await createTablesForRestaurant({
      restaurantId,
      tableNumbers: [tableNumber],
      baseUrl: baseUrl || 'http://localhost:3000'
    });
    
    return createdTables[0];
  } catch (error) {
    console.error(`Error ensuring table ${tableNumber} exists for restaurant ${restaurantId}:`, error);
    throw error;
  }
}

/**
 * Bulk table operations for restaurant setup
 */
export async function bulkManageTables(restaurantId: number, operations: {
  create?: number[];
  delete?: number[];
  baseUrl?: string;
}): Promise<{
  created: any[];
  deleted: boolean[];
  errors: string[];
}> {
  const results = {
    created: [] as any[],
    deleted: [] as boolean[],
    errors: [] as string[]
  };
  
  try {
    // Handle creation
    if (operations.create && operations.create.length > 0) {
      const created = await createTablesForRestaurant({
        restaurantId,
        tableNumbers: operations.create,
        baseUrl: operations.baseUrl
      });
      results.created = created;
    }
    
    // Handle deletion
    if (operations.delete && operations.delete.length > 0) {
      // Convert table numbers to table IDs
      const existingTables = await storage.getTablesByRestaurantId(restaurantId);
      const tableIdsToDelete = operations.delete
        .map(tableNumber => {
          const table = existingTables.find(t => t.number === tableNumber);
          return table ? table.id : null;
        })
        .filter(id => id !== null) as number[];
      
      if (tableIdsToDelete.length > 0) {
        const deleted = await deleteTablesForRestaurant({
          restaurantId,
          tableIds: tableIdsToDelete
        });
        results.deleted = deleted;
      }
    }
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return results;
}
