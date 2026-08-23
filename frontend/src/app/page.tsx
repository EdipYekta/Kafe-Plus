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
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto pulse-ring">
          <Coffee className="w-8 h-8 text-white" />
        </div>
        <p className="text-white/40 text-sm">Yükleniyor...</p>
      </div>
    </div>
  );
}
