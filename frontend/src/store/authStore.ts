import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  full_name: string;
  username: string;
  role: 'Admin' | 'Manager' | 'Cashier' | 'Waiter' | 'Kitchen';
  cafe_id: number;
  cafe_name: string;
  logo_url?: string;
  avatar_color: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'kafeplus-auth' }
  )
);
