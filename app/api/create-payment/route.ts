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
    const { userId, userEmail } = await request.json()

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'User ID and email required' }, { status: 400 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'StockAnalysisAI Pro',
              description: 'Monthly subscription with unlimited reports',
            },
            unit_amount: 700, // €7.00 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard?payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        plan: 'pro'
      },
    })

    return NextResponse.json({ 
      sessionUrl: session.url,
      sessionId: session.id
    })

  } catch (error) {
    console.error('Stripe payment creation error:', error)
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 })
  }
}