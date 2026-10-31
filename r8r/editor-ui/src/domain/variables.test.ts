import { describe, expect, it } from 'vitest'

import { parseValue, showValue, validateKey } from './variables'

describe('parseValue', () => {
  it('keeps a number a number', () => {
    // A batch size that reaches a node as the string "500" fails differently,
    // and later, than one that reaches it as 500.
    expect(parseValue('500')).toBe(500)
    expect(parseValue('1.5')).toBe(1.5)
    expect(parseValue('-3')).toBe(-3)
  })

  it('recognises the two booleans and null', () => {
    expect(parseValue('true')).toBe(true)
    expect(parseValue('false')).toBe(false)
    expect(parseValue('null')).toBeNull()
  })

  it('leaves a URL alone', () => {
    expect(parseValue('https://hims.example.org/api/fhir')).toBe(
      'https://hims.example.org/api/fhir',
    )
  })

  it('treats something that merely looks like JSON as text', () => {
    // A value with braces in it is far more likely to be a template than an
    // object somebody meant to nest.
    expect(parseValue('{{ vars.OTHER }}')).toBe('{{ vars.OTHER }}')
    expect(parseValue('{"a":1}')).toBe('{"a":1}')
  })

  it('does not turn an empty box into zero', () => {
    // `Number('')` is 0, which would store a number nobody typed.
    expect(parseValue('')).toBe('')
    expect(parseValue('   ')).toBe('   ')
  })

  it('does not read a version string as a number', () => {
    expect(parseValue('1.2.3')).toBe('1.2.3')
  })

  it('preserves surrounding spaces in text but not around a number', () => {
    // Trimming a hostname would hide a typo; trimming ' 500 ' would not.
    expect(parseValue(' 500 ')).toBe(500)
    expect(parseValue(' hello ')).toBe(' hello ')
  })
})

describe('showValue', () => {
  it('shows a string without quotes', () => {
    // Typing `https://x` and seeing `"https://x"` come back reads as an error.
    expect(showValue('https://x')).toBe('https://x')
  })

  it('shows other types the way they would be typed back in', () => {
    expect(showValue(500)).toBe('500')
    expect(showValue(true)).toBe('true')
    expect(showValue(null)).toBe('null')
  })

  it('round-trips through the field without changing the value', () => {
    for (const value of ['https://x', 500, true, null, '']) {
      expect(parseValue(showValue(value))).toEqual(value)
    }
  })
})

describe('validateKey', () => {
  it('accepts the names people actually use', () => {
    expect(validateKey('FHIR_BASE_URL')).toBeNull()
    expect(validateKey('_internal')).toBeNull()
    expect(validateKey('region2')).toBeNull()
  })

  it('refuses a name an expression could not read back', () => {
    // `{{ vars.my-var }}` parses as a subtraction, so the variable would be
    // settable and permanently unreadable.
    expect(validateKey('my-var')).toContain('underscores')
    expect(validateKey('has.dot')).toContain('underscores')
    expect(validateKey('with space')).toContain('underscores')
  })

  it('refuses a name starting with a digit', () => {
    expect(validateKey('2fast')).toBe('Start with a letter or underscore')
  })

  it('asks for a name rather than complaining about the characters in nothing', () => {
    expect(validateKey('')).toBe('A name is required')
  })

  it('refuses a name too long to be a name', () => {
    expect(validateKey('A'.repeat(129))).toContain('128')
  })
})
