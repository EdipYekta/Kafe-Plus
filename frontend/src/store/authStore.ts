import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPermissions {
  can_take_payment: boolean;
  can_view_revenue: boolean;
  can_view_history: 'all' | 'today_only' | false;
  can_view_products: boolean;
  can_view_kitchen: boolean;
  can_view_staff: boolean;
  can_manage_expenses: boolean;
  can_print_z_report: boolean;
  can_view_weekly_monthly: boolean;
  can_edit_table_items: boolean;
  can_view_dashboard: boolean;
}

export interface User {
  id: number;
  full_name: string;
  username: string;
  role: 'SuperAdmin' | 'Owner' | 'Admin' | 'Manager' | 'Cashier' | 'Waiter' | 'Kitchen';
  cafe_id: number;
  cafe_name: string;
  logo_url?: string;
  avatar_color: string;
  permissions: UserPermissions;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_take_payment: false,
  can_view_revenue: false,
  can_view_history: 'today_only',
  can_view_products: false,
  can_view_kitchen: false,
  can_view_staff: false,
  can_manage_expenses: false,
  can_print_z_report: false,
  can_view_weekly_monthly: false,
  can_edit_table_items: false,
  can_view_dashboard: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => set({
        token,
        user: {
          ...user,
          permissions: user.permissions || DEFAULT_PERMISSIONS,
        },
        isAuthenticated: true,
      }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'kafeplus-auth' }
  )
);
