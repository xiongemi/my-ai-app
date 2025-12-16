import { getCredits } from '@/lib/billing';
import { NextResponse } from 'next/server';

export function GET() {
  const credits = getCredits();
  return NextResponse.json({ credits });
}
