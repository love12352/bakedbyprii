export type Status = 'new' | 'confirmed' | 'completed' | 'cancelled';
export type Payment = 'cash' | 'bank' | 'card' | 'paypal';
export type Fulfilment = 'collection' | 'delivery';

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  allergens: string;
}

export interface OrderItemInput { id: string; qty: number; }

export interface CreateOrderBody {
  customer: { name: string; email: string; phone: string; notes: string };
  items: OrderItemInput[];
  fulfilment: Fulfilment;
  date: string;
  payment: Payment;
  address: { line: string; postcode: string };
}

export interface CreateOrderResult {
  ref: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment: Payment;
  fulfilment: Fulfilment;
}

export interface OrderLine { item_id: string; name: string; price: number; qty: number; }

export interface PublicOrder {
  ref: string; name: string; status: Status;
  fulfilment: Fulfilment; address: string | null; postcode: string | null;
  required_date: string; payment: Payment;
  subtotal: number; delivery_fee: number; total: number;
  items: OrderLine[]; created_at: string; cancellable: boolean;
}

export interface AdminOrder {
  ref: string; created_at: string; name: string; email: string; phone: string;
  notes: string | null; fulfilment: Fulfilment; address: string | null; postcode: string | null;
  required_date: string; payment: Payment;
  subtotal: number; delivery_fee: number; total: number; status: Status;
  items: OrderLine[];
}

export interface AdminStats { total: number; new: number; revenue: number; }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
