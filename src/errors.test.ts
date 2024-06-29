import { describe, expect, it } from 'vitest'

import { IllegalMovementError } from './errors'

describe('IllegalMovementError', () => {
  it('should create an instance with the correct name and message', () => {
    const errorMessage = 'Illegal movement detected'
    const error = new IllegalMovementError(errorMessage)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(IllegalMovementError)
    expect(error.name).toBe('IllegalMovementError')
    expect(error.message).toBe(errorMessage)
  })
})
