// Workspace
export interface Workspace {
    id: string;
    name: string;
    members: string[];
    ownerId: string;
    createdAt: number;
    pendingInvites?: string[];
}

// Conta Bancária
export interface Account {
    id: string;
    name: string;
    balance: number;
    type: 'checking' | 'investment' | 'cash';
    color: string;
}

// Cartão de Crédito
export interface CreditCard {
    id: string;
    name: string;
    limit: number;
    closingDay: number;
    dueDay: number;
    brand: 'visa' | 'mastercard' | 'amex' | 'elo' | 'other';
    color: string;
}

// Categoria
export interface Category {
    id: string;
    name: string;
    icon: string;
    type: 'expense' | 'income';
    color: string;
}

// Lançamento (Receita/Despesa)
export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: number;
    dueDate?: number;
    type: 'expense' | 'income';
    status: 'paid' | 'pending';

    // Vínculos
    accountId?: string;
    cardId?: string;
    categoryId?: string;
    userId: string;

    // Parcelamento
    installments?: {
        current: number;
        total: number;
    };

    paidAt?: number;
    paidAccountId?: string;
}

// Despesa Fixa (Recorrente)
export interface RecurringBill {
    id: string;
    name: string;
    amount: number;
    dueDay: number;
    categoryId?: string;
    accountId?: string;
    isActive: boolean;
    createdAt: number;
}

// Pagamento de Despesa Fixa (instância mensal)
export interface BillPayment {
    id: string;
    billId: string;
    billName: string;
    amount: number;
    month: number;
    year: number;
    dueDay: number;
    status: 'paid' | 'pending' | 'overdue' | 'skipped';
    paidAt?: number;
    paidAmount?: number;
    paidAccountId?: string;
}

// Fatura do Cartão
export interface CardStatement {
    id: string;
    cardId: string;
    cardName: string;
    month: number;
    year: number;
    closingDate: number;
    dueDate: number;
    totalAmount: number;
    status: 'open' | 'closed' | 'paid';
    paidAt?: number;
    paidAccountId?: string;
}
