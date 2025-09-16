import { describe, it, expect } from 'vitest'

describe('Simple Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2)
  })
  
  it('should have access to environment variables', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('Available env keys:', Object.keys(process.env).filter(key => key.includes('SUPABASE')).join(', '))
    expect(true).toBe(true)
  })
})