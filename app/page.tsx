'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!error) {
          setConnected(true)
        }
      } catch (error) {
        console.log('Connection error:', error)
      } finally {
        setLoading(false)
      }
    }
    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">
          StockAnalysisAI
        </h1>
        <p className="text-xl text-blue-200 mb-8">
          AI-Powered Stock Analysis in Minutes
        </p>
        <div className="mb-8 p-4 bg-white/10 rounded-lg">
          <p className="text-white text-lg">
            {loading ? '🔄 Testing connection...' : 
             connected ? '✅ Supabase Connected!' : '❌ Connection Failed'}
          </p>
        </div>
        <Link href="/auth/signup">
          <button className="bg-white text-blue-900 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Get Started
          </button>
        </Link>
      </div>
    </div>
  )
}