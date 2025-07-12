'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { searchCompanies, Company } from '@/lib/companies'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Company[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [recentReports, setRecentReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [reportsUsed, setReportsUsed] = useState(0)
  const [reportsLimit, setReportsLimit] = useState(5)
  const [upgrading, setUpgrading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push('/auth/login')
      }
      setLoading(false)
    }

    checkUser()
  }, [router])

  // Load user's usage info
  const loadUsageInfo = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('reports_used, reports_limit')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load usage:', error)
      } else if (data) {
        setReportsUsed(data.reports_used)
        setReportsLimit(data.reports_limit)
      }
    } catch (error) {
      console.error('Error loading usage:', error)
    }
  }

  // Load user's recent reports
  const loadRecentReports = async () => {
    if (!user) return
    
    setLoadingReports(true)
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Failed to load reports:', error)
      } else {
        setRecentReports(data || [])
      }
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  // Load usage and reports when user is loaded
  useEffect(() => {
    if (user) {
      loadUsageInfo()
      loadRecentReports()
    }
  }, [user])

  // Search companies as user types
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 1) {
        setSearchResults([])
        return
      }

      setSearchLoading(true)
      const results = await searchCompanies(searchQuery)
      setSearchResults(results)
      setSearchLoading(false)
    }

    const timeoutId = setTimeout(performSearch, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company)
    setSearchQuery(company.ticker)
    setSearchResults([])
  }

  const handleGenerateReport = async () => {
    if (!selectedCompany || !user) return

    setGenerating(true)
    
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: selectedCompany.name,
          ticker: selectedCompany.ticker,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setReportContent(data.report)
        // Update usage counts from API response
        setReportsUsed(data.reportsUsed)
        setReportsLimit(data.reportsLimit)
        loadRecentReports()
      } else {
        alert('Failed to generate report: ' + data.error)
      }
    } catch (error) {
      alert('Error generating report')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return
    
    setUpgrading(true)
    
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to Stripe Checkout
        window.location.href = data.sessionUrl
      } else {
        alert('Failed to create payment session: ' + data.error)
      }
    } catch (error) {
      alert('Error creating payment session')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                StockAnalysisAI
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Your Dashboard
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Search any stock ticker to generate your AI-powered analysis
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Generate Stock Report
            </h3>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Stock Ticker or Company Name
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., AAPL, Apple, Tesla, ASML"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => handleCompanySelect(company)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-semibold text-gray-900">
                          {company.ticker}
                        </div>
                        <div className="text-sm text-gray-600">
                          {company.name} • {company.exchange}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchLoading && searchQuery && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                    <div className="text-gray-500">Searching...</div>
                  </div>
                )}
              </div>

              {/* Selected Company Display */}
              {selectedCompany && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-blue-900">
                        {selectedCompany.ticker} - {selectedCompany.name}
                      </div>
                      <div className="text-sm text-blue-700">
                        {selectedCompany.sector} • {selectedCompany.exchange}
                      </div>
                    </div>
                    <div className="text-green-600 font-semibold">
                      ✓ Selected
                    </div>
                  </div>
                </div>
              )}
              
              <button 
                onClick={handleGenerateReport}
                disabled={!selectedCompany || generating || reportsUsed >= reportsLimit}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
              >
                {reportsUsed >= reportsLimit ? 
                  'Monthly Limit Reached - Upgrade Required' :
                  generating ? '🤖 Generating Report...' : 
                  selectedCompany ? `Generate Analysis for ${selectedCompany.ticker}` : 
                  'Select a Company First'
                }
              </button>
            </div>

            {/* Usage Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-medium">
                  Reports Remaining:
                </span>
                <span className="text-blue-900 font-bold text-lg">
                  {reportsLimit - reportsUsed} / {reportsLimit}
                </span>
              </div>
              <p className="text-blue-700 text-sm mt-1">
                Resets monthly • €7/month subscription
              </p>
              {reportsUsed >= reportsLimit && (
                <p className="text-red-600 text-sm mt-2 font-medium">
                  ⚠️ Monthly limit reached. Upgrade to generate more reports.
                </p>
              )}
            </div>

            {/* Upgrade Section - Show when limit reached */}
            {reportsUsed >= reportsLimit && (
              <div className="mt-6 p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
                <h4 className="text-xl font-semibold mb-2">
                  Upgrade to Pro
                </h4>
                <p className="mb-4">
                  Get unlimited reports for just €7/month
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {upgrading ? 'Creating Payment...' : 'Upgrade Now - €7/month'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Generated Report Display */}
        {reportContent && (
          <div className="mt-12">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-900">
                Generated Report
              </h3>
              <button
                onClick={() => setReportContent('')}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {reportContent}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Reports Section */}
        <div className="mt-12">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            Recent Reports
          </h3>
          <div className="bg-white rounded-xl shadow-lg p-8">
            {loadingReports ? (
              <p className="text-gray-500 text-center">Loading reports...</p>
            ) : recentReports.length > 0 ? (
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setReportContent(report.report_content)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {report.ticker} - {report.company_name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Generated {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setReportContent(report.report_content)
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center">
                No reports generated yet. Create your first analysis above!
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}