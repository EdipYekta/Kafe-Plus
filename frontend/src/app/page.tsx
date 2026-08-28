'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Coffee } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const role = user?.role;
    if (role === 'Kitchen') router.push('/kitchen');
    else if (role === 'Waiter') router.push('/waiter');
    else if (role === 'Cashier') router.push('/cashier');
    else router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app)' }}>
      <div className="text-center space-y-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto animate-pulse"
          style={{ background: 'linear-gradient(135deg, var(--brand), #ff9500)' }}
        >
          <Coffee className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yukleniyor...</p>
      </div>
    </div>
  );
}
