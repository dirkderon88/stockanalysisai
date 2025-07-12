import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get or create user subscription
    let { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No subscription exists, create one
      const { data: newSub, error: createError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan: 'free',
          reports_used: 0,
          reports_limit: 5
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create subscription:', createError)
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
      }
      
      subscription = newSub
    } else if (error) {
      console.error('Failed to get subscription:', error)
      return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
    }

    // Check if billing period has expired
    const now = new Date()
    const periodEnd = new Date(subscription.billing_period_end)
    
    if (now > periodEnd) {
      // Reset usage for new billing period
      const { data: updatedSub, error: resetError } = await supabase
        .from('user_subscriptions')
        .update({
          reports_used: 0,
          billing_period_start: now.toISOString(),
          billing_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (resetError) {
        console.error('Failed to reset billing period:', resetError)
      } else {
        subscription = updatedSub
      }
    }

    const canGenerate = subscription.reports_used < subscription.reports_limit

    return NextResponse.json({
      canGenerate,
      reportsUsed: subscription.reports_used,
      reportsLimit: subscription.reports_limit,
      remainingReports: subscription.reports_limit - subscription.reports_used
    })

  } catch (error) {
    console.error('Usage check error:', error)
    return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
  }
}