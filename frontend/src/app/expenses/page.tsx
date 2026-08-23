'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExpensesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cashier?tab=giderler');
  }, [router]);

  return null;
}
