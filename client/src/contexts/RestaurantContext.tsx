import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Restaurant, TableSession, Customer } from "@shared/schema";

interface RestaurantContextType {
  restaurantId: number | null;
  tableNumber: string | null;
  restaurant: Restaurant | null;
  session: TableSession | null;
  customer: Customer | null;
  setRestaurantId: (id: number) => void;
  setTableNumber: (table: string) => void;
  setSession: (session: TableSession) => void;
  setCustomer: (customer: Customer) => void;
  isLoading: boolean;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<number | null>(() => {
    const saved = localStorage.getItem("restaurantId");
    return saved ? parseInt(saved) : null;
  });
  
  const [tableNumber, setTableNumber] = useState<string | null>(() => {
    return localStorage.getItem("tableNumber");
  });
  
  const [session, setSession] = useState<TableSession | null>(() => {
    const saved = localStorage.getItem("tableSession");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [customer, setCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem("customer");
    return saved ? JSON.parse(saved) : null;
  });

  const { data: restaurant, isLoading } = useQuery({
    queryKey: [`/api/public/restaurants/${restaurantId}`],
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (restaurantId) {
      localStorage.setItem("restaurantId", restaurantId.toString());
    } else {
      localStorage.removeItem("restaurantId");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (tableNumber) {
      localStorage.setItem("tableNumber", tableNumber);
    } else {
      localStorage.removeItem("tableNumber");
    }
  }, [tableNumber]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("tableSession", JSON.stringify(session));
    } else {
      localStorage.removeItem("tableSession");
    }
  }, [session]);

  useEffect(() => {
    if (customer) {
      localStorage.setItem("customer", JSON.stringify(customer));
    } else {
      localStorage.removeItem("customer");
    }
  }, [customer]);

  const handleSetRestaurantId = (id: number) => {
    setRestaurantId(id);
  };

  const handleSetTableNumber = (table: string) => {
    setTableNumber(table);
  };

  const handleSetSession = (newSession: TableSession) => {
    setSession(newSession);
  };

  const handleSetCustomer = (newCustomer: Customer) => {
    setCustomer(newCustomer);
  };

  return (
    <RestaurantContext.Provider
      value={{
        restaurantId,
        tableNumber,
        restaurant: (restaurant as Restaurant) || null,
        session,
        customer,
        setRestaurantId: handleSetRestaurantId,
        setTableNumber: handleSetTableNumber,
        setSession: handleSetSession,
        setCustomer: handleSetCustomer,
        isLoading,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error("useRestaurant must be used within a RestaurantProvider");
  }
  return context;
} 