import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  isMainCustomer: boolean;
  paymentStatus?: string;
}

interface CustomerNamesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number;
  onCustomersCollected: (customers: Customer[], sessionData: {
    sessionName?: string;
    partySize: number;
    splitType: 'individual' | 'combined' | 'custom';
  }) => void;
}

export function CustomerNamesDialog({ 
  isOpen, 
  onOpenChange, 
  tableNumber, 
  onCustomersCollected 
}: CustomerNamesDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([
    { id: 1, name: '', email: '', phone: '', isMainCustomer: true, paymentStatus: 'pending' }
  ]);
  const [sessionName, setSessionName] = useState('');
  const [splitType, setSplitType] = useState<'individual' | 'combined' | 'custom'>('individual');
  const [partySize, setPartySize] = useState(1);
  const { toast } = useToast();

  const addCustomer = () => {
    const newCustomer: Customer = {
      id: Date.now(),
      name: '',
      email: '',
      phone: '',
      isMainCustomer: false,
      paymentStatus: 'pending'
    };
    setCustomers([...customers, newCustomer]);
    setPartySize(customers.length + 1);
  };

  const removeCustomer = (id: number) => {
    if (customers.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one customer is required",
        variant: "destructive"
      });
      return;
    }

    const customerToRemove = customers.find(c => c.id === id);
    if (customerToRemove?.isMainCustomer) {
      // Make the first remaining customer the main customer
      const updatedCustomers = customers.filter(c => c.id !== id);
      if (updatedCustomers.length > 0) {
        updatedCustomers[0].isMainCustomer = true;
      }
      setCustomers(updatedCustomers);
    } else {
      setCustomers(customers.filter(c => c.id !== id));
    }
    setPartySize(Math.max(1, partySize - 1));
  };

  const updateCustomer = (id: number, field: keyof Customer, value: string | boolean) => {
    setCustomers(customers.map(customer => 
      customer.id === id ? { ...customer, [field]: value } : customer
    ));
  };

  const setMainCustomer = (id: number) => {
    setCustomers(customers.map(customer => ({
      ...customer,
      isMainCustomer: customer.id === id
    })));
  };

  const handleSubmit = () => {
    // Validate that all customers have names
    const invalidCustomers = customers.filter(c => !c.name.trim());
    if (invalidCustomers.length > 0) {
      toast({
        title: "Missing Names",
        description: "Please enter names for all customers",
        variant: "destructive"
      });
      return;
    }

    // Ensure there's a main customer
    const mainCustomer = customers.find(c => c.isMainCustomer);
    if (!mainCustomer) {
      customers[0].isMainCustomer = true;
    }

    onCustomersCollected(customers, {
      sessionName: sessionName.trim() || undefined,
      partySize: customers.length,
      splitType
    });
  };

  const quickAddOptions = [2, 3, 4, 5, 6, 7, 8, 10, 12];

  const setQuickPartySize = (size: number) => {
    const currentCount = customers.length;
    
    if (size > currentCount) {
      // Add customers
      const newCustomers = [];
      for (let i = currentCount; i < size; i++) {
        newCustomers.push({
          id: Date.now() + i,
          name: '',
          email: '',
          phone: '',
          isMainCustomer: false,
          paymentStatus: 'pending'
        });
      }
      setCustomers([...customers, ...newCustomers]);
    } else if (size < currentCount) {
      // Remove customers (keeping the main customer)
      const mainCustomerIndex = customers.findIndex(c => c.isMainCustomer);
      const keptCustomers = customers.slice(0, size);
      
      // Ensure main customer is kept
      if (mainCustomerIndex >= size) {
        keptCustomers[0].isMainCustomer = true;
        keptCustomers.forEach((c, i) => {
          if (i > 0) c.isMainCustomer = false;
        });
      }
      
      setCustomers(keptCustomers);
    }
    
    setPartySize(size);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Customer Information - Table {tableNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Session Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Session Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sessionName">Session Name (Optional)</Label>
                  <Input
                    id="sessionName"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Birthday party, Business meeting..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="splitType">Billing Type</Label>
                  <Select value={splitType} onValueChange={(value: any) => setSplitType(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual Bills</SelectItem>
                      <SelectItem value="combined">Combined Bill</SelectItem>
                      <SelectItem value="custom">Custom Split</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Party Size */}
              <div>
                <Label>Quick Party Size</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickAddOptions.map(size => (
                    <Button
                      key={size}
                      variant={customers.length === size ? "default" : "outline"}
                      size="sm"
                      onClick={() => setQuickPartySize(size)}
                      className="min-w-[40px]"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Customers ({customers.length})</span>
                <Button
                  onClick={addCustomer}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Customer
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {customers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className={`p-4 border rounded-lg ${
                      customer.isMainCustomer ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Customer {index + 1}</span>
                        {customer.isMainCustomer && (
                          <Badge variant="default" className="text-xs">
                            Main Contact
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!customer.isMainCustomer && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMainCustomer(customer.id)}
                          >
                            Make Main
                          </Button>
                        )}
                        {customers.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeCustomer(customer.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`name-${customer.id}`}>Name *</Label>
                        <Input
                          id={`name-${customer.id}`}
                          value={customer.name}
                          onChange={(e) => updateCustomer(customer.id, 'name', e.target.value)}
                          placeholder="Enter name"
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`email-${customer.id}`}>Email (Optional)</Label>
                        <Input
                          id={`email-${customer.id}`}
                          type="email"
                          value={customer.email}
                          onChange={(e) => updateCustomer(customer.id, 'email', e.target.value)}
                          placeholder="email@example.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`phone-${customer.id}`}>Phone (Optional)</Label>
                        <Input
                          id={`phone-${customer.id}`}
                          type="tel"
                          value={customer.phone}
                          onChange={(e) => updateCustomer(customer.id, 'phone', e.target.value)}
                          placeholder="+1234567890"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <p><strong>Party Size:</strong> {customers.length} {customers.length === 1 ? 'person' : 'people'}</p>
                  <p><strong>Billing:</strong> {splitType.charAt(0).toUpperCase() + splitType.slice(1)} {splitType === 'individual' ? 'bills' : 'bill'}</p>
                  {sessionName && <p><strong>Session:</strong> {sessionName}</p>}
                </div>
                <div className="text-right">
                  <p className="text-gray-600">Table {tableNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Start Session & Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 