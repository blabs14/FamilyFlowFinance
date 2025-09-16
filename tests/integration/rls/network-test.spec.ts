import { describe, it, expect } from 'vitest'

describe('Network Connectivity Test', () => {
  it('should be able to make HTTPS requests', async () => {
    try {
      const response = await fetch('https://httpbin.org/get')
      const data = await response.json()
      
      console.log('Network test successful:', data.url)
      expect(response.ok).toBe(true)
    } catch (error) {
      console.error('Network test failed:', error)
      throw error
    }
  })
  
  it('should be able to reach Supabase domain', async () => {
    try {
      const response = await fetch('https://ebitcwrrcumsvqjgrapw.supabase.co/rest/v1/', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY'
        }
      })
      
      console.log('Supabase API response status:', response.status)
      console.log('Supabase API response headers:', Object.fromEntries(response.headers.entries()))
      
      // Mesmo que retorne 404 ou outro erro, se não for 'fetch failed', a conectividade está OK
      expect(response).toBeDefined()
    } catch (error) {
      console.error('Supabase connectivity test failed:', error)
      throw error
    }
  })
})