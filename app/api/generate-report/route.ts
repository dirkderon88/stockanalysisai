import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANALYSIS_PROMPT = `I'm analyzing [COMPANY_NAME] as a potential long-term investment (20+ year horizon). Please provide a comprehensive business intelligence report covering:

**BUSINESS MODEL DEEP DIVE**
1. What exactly does this company do? Explain their business in simple terms
2. What products/services do they offer? List main offerings and revenue generators
3. How do they make money? Break down revenue streams and pricing models
4. Who are their customers? What types of companies/consumers buy from them
5. What's their value proposition? Why do customers choose them over alternatives

**COMPETITIVE ADVANTAGES & MARKET POSITION**
1. What is their competitive moat? (Strong brand, network effects, switching costs, scale, etc.)
2. Do they have genuine pricing power? Can they raise prices without losing customers?
3. Who are their main competitors and how do they compare in market position?
4. What makes this company unique or difficult to replicate?

**FINANCIAL QUALITY METRICS**
1. Profit margins - Are gross, operating, and net margins high and stable?
2. Revenue & earnings growth - Are both growing consistently over past 5 years?
3. Free cash flow - Is FCF generation strong, growing, and consistent?
4. Balance sheet strength - Debt levels, cash position, overall financial health
5. Return on invested capital - Is ROIC consistently above 15%?

**MANAGEMENT TEAM ASSESSMENT**
1. CEO profile and track record
2. Leadership team credentials and experience
3. Management compensation and shareholder alignment
4. Capital allocation decisions and track record

**GROWTH SUSTAINABILITY**
1. What are clear prospects for sustainable future growth?
2. Can they fund growth internally or depend on external financing?
3. Are growth plans realistic and achievable?

**MAJOR RISK ASSESSMENT**
What are the top 3 risks that could cause this stock to decline significantly?

**INVESTMENT RECOMMENDATION**
Provide a clear BUY/HOLD/SELL recommendation with reasoning.

**STRENGTHS & CONCERNS**
List 3-5 key strengths and 2-3 main concerns.

Please structure this as a professional investment research report.`

export async function POST(request: NextRequest) {
  try {
    const { companyName, ticker, userId } = await request.json()

    if (!companyName || !ticker || !userId) {
      return NextResponse.json({ error: 'Company name, ticker, and user ID required' }, { status: 400 })
    }

    // Check user's usage limits
    let { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Create subscription if doesn't exist
    if (subError && subError.code === 'PGRST116') {
      const now = new Date()
      const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const { data: newSub, error: createError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan: 'free',
          reports_used: 0,
          reports_limit: 5,
          billing_period_start: now.toISOString(),
          billing_period_end: oneMonthLater.toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create subscription:', createError)
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
      }
      
      subscription = newSub
    } else if (subError) {
      console.error('Failed to get subscription:', subError)
      return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
    }

    // Check if billing period has expired and reset if needed
    const now = new Date()
    const periodEnd = new Date(subscription.billing_period_end)
    
    if (now > periodEnd) {
      const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const { data: updatedSub, error: resetError } = await supabase
        .from('user_subscriptions')
        .update({
          reports_used: 0,
          billing_period_start: now.toISOString(),
          billing_period_end: newPeriodEnd.toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (!resetError) {
        subscription = updatedSub
      }
    }

    // Check if user has reports remaining
    if (subscription.reports_used >= subscription.reports_limit) {
      return NextResponse.json({ 
        error: 'Monthly report limit reached. Upgrade to generate more reports.',
        reportsUsed: subscription.reports_used,
        reportsLimit: subscription.reports_limit
      }, { status: 403 })
    }

    // Generate the AI report
    const prompt = ANALYSIS_PROMPT.replace('[COMPANY_NAME]', `${companyName} (${ticker})`)

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const report = message.content[0].type === 'text' ? message.content[0].text : 'Error generating report'

    // Save report to database
    const { data: savedReport, error: saveError } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        company_name: companyName,
        ticker: ticker.toUpperCase(),
        report_content: report
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save report:', saveError)
    }

    // Increment usage count
    if (savedReport) {
      await supabase
        .from('user_subscriptions')
        .update({ 
          reports_used: subscription.reports_used + 1
        })
        .eq('user_id', userId)
    }

    return NextResponse.json({ 
      report,
      company: companyName,
      ticker,
      reportId: savedReport?.id,
      reportsUsed: subscription.reports_used + 1,
      reportsLimit: subscription.reports_limit,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' }, 
      { status: 500 }
    )
  }
}