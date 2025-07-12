import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId

      if (userId) {
        // Upgrade user to pro plan
        const now = new Date()
        const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan: 'pro',
            reports_used: 0,
            reports_limit: 999, // Unlimited for pro users
            billing_period_start: now.toISOString(),
            billing_period_end: oneMonthLater.toISOString()
          })

        if (error) {
          console.error('Failed to upgrade user:', error)
        } else {
          console.log('User upgraded successfully:', userId)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}