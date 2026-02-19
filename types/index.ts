// Workspace
export type WorkspaceBillingStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive';

export interface WorkspaceBilling {
    status: WorkspaceBillingStatus;
    plan?: 'monthly' | 'yearly';
    trialEndsAt?: number;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    checkoutSessionId?: string;
    updatedAt?: number;
}

export interface WorkspaceLegal {
    acceptedTermsAt?: number;
    acceptedPrivacyAt?: number;
    acceptedByUid?: string;
    acceptedByEmail?: string;
}

export interface Workspace {
    id: string;
    name: string;
    members: string[];
    ownerId: string;
    ownerEmail?: string;
    createdAt: number;
    pendingInvites?: string[];
    billing?: WorkspaceBilling;
    legal?: WorkspaceLegal;
}

// Conta Bancária
export interface Account {
    id: string;
    name: string;
    balance: number;
    startingBalance?: number;
    lastReconciledAt?: number;
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
    notes?: string;
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

    // Origem e vínculos de automações/fluxos internos
    source?: 'manual' | 'bill_payment' | 'transfer';
    billPaymentId?: string;

    // Metadados para transferência entre contas
    transferId?: string;
    transferDirection?: 'in' | 'out';
    transferFromAccountId?: string;
    transferToAccountId?: string;
    transferPairId?: string;
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
    skippedAt?: number;
}

// Nota Financeira (bloco de notas / empréstimos)
export interface FinancialNote {
    id: string;
    title: string;
    description?: string;
    type: 'general' | 'to_receive' | 'to_pay';
    status: 'open' | 'resolved';
    personName?: string | null;
    amount?: number | null;
    dueDate?: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface OpsAlert {
    id: string;
    app?: string;
    env?: string;
    level: 'info' | 'warning' | 'error';
    source: string;
    message: string;
    workspaceId?: string;
    context?: Record<string, any>;
    timestamp?: string;
    createdAt: number;
    delivery?: {
        webhook?: boolean;
        firestore?: boolean;
    };
}

export interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId?: string | null;
    actorUid?: string | null;
    summary?: string;
    payload?: Record<string, any>;
    createdAt: number;
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
    amountMode?: 'auto' | 'manual';
    status: 'open' | 'closed' | 'paid';
    paidAt?: number;
    paidAccountId?: string;
}

// Perfil do Usuário
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    subscriptionStatus: 'active' | 'inactive' | 'trial' | 'trialing' | 'past_due' | 'canceled';
    subscriptionPlan?: 'monthly' | 'yearly';
    createdAt: number;
    updatedAt: number;
    lastSeenAt?: number;
}
