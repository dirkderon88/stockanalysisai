import { supabase } from './supabase'

export interface Company {
  id: number
  ticker: string
  name: string
  exchange?: string
  sector?: string
  country?: string
}

export async function searchCompanies(query: string): Promise<Company[]> {
  if (!query || query.length < 1) {
    return []
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(10)

  if (error) {
    console.error('Search error:', error)
    return []
  }

  return data || []
}

export async function getCompanyByTicker(ticker: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .single()

  if (error) {
    console.error('Company fetch error:', error)
    return null
  }

  return data
}