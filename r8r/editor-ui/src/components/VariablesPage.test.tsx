import { describe, expect, it, vi } from 'vitest'

import { fakeApi, renderWithProviders, screen, waitFor } from '../test/render'
import type { StoredVariable } from '../types'
import { VariablesPage } from './VariablesPage'

const variable = (key: string, value: unknown): StoredVariable =>
  ({ key, value, updatedAt: new Date().toISOString() }) as StoredVariable

function render(variables: StoredVariable[], overrides = {}) {
  const api = fakeApi({
    listVariables: vi.fn().mockResolvedValue(variables),
    setVariable: vi.fn().mockResolvedValue({ key: 'x', value: 'x' }),
    ...overrides,
  })
  return { ...renderWithProviders(<VariablesPage />, { api }), api }
}

describe('VariablesPage', () => {
  it('lists what this instance is configured with', async () => {
    render([variable('FHIR_BASE_URL', 'https://hims.example.org')])

    expect(await screen.findByText('FHIR_BASE_URL')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://hims.example.org')).toBeInTheDocument()
  })

  it('says plainly that these are not secrets', async () => {
    // Somebody will otherwise put a bearer token here, and it will be readable
    // by everyone who can edit a workflow.
    render([])

    expect(await screen.findByText(/Put tokens and passwords in Credentials/)).toBeInTheDocument()
  })

  it('refuses a name an expression could not read back, while it is being typed', async () => {
    const { user } = render([])

    await user.type(screen.getByLabelText('Name'), 'my-var')

    // Better to say so now than after it has been wired into four nodes.
    expect(await screen.findByText(/Letters, numbers and underscores only/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('adds a variable with the type it was typed as', async () => {
    const setVariable = vi.fn().mockResolvedValue({ key: 'BATCH_SIZE', value: 500 })
    const { user } = render([], { setVariable })

    await user.type(screen.getByLabelText('Name'), 'BATCH_SIZE')
    await user.type(screen.getByLabelText('Value'), '500')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(setVariable).toHaveBeenCalledWith('BATCH_SIZE', 500))
  })

  it('saves an edited value when the field is left', async () => {
    const setVariable = vi.fn().mockResolvedValue({ key: 'REGION', value: 'eu-west-1' })
    const { user } = render([variable('REGION', 'ap-south-1')], { setVariable })

    const field = await screen.findByLabelText('Value of REGION')
    await user.clear(field)
    await user.type(field, 'eu-west-1')
    await user.tab()

    await waitFor(() => expect(setVariable).toHaveBeenCalledWith('REGION', 'eu-west-1'))
  })

  it('does not save a field that was not changed', async () => {
    const setVariable = vi.fn()
    const { user } = render([variable('REGION', 'ap-south-1')], { setVariable })

    await user.click(await screen.findByLabelText('Value of REGION'))
    await user.tab()

    expect(setVariable).not.toHaveBeenCalled()
  })

  it('deletes a variable', async () => {
    const deleteVariable = vi.fn().mockResolvedValue({ deleted: 'REGION' })
    const { user } = render([variable('REGION', 'ap-south-1')], { deleteVariable })

    await user.click(await screen.findByLabelText('Delete REGION'))

    await waitFor(() => expect(deleteVariable).toHaveBeenCalledWith('REGION'))
  })

  it('says why the server refused rather than failing quietly', async () => {
    const setVariable = vi.fn().mockRejectedValue(new Error('this instance already has 200'))
    const { user } = render([], { setVariable })

    await user.type(screen.getByLabelText('Name'), 'ONE_TOO_MANY')
    await user.type(screen.getByLabelText('Value'), 'x')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(/this instance already has 200/)).toBeInTheDocument()
  })

  it('explains an empty list rather than showing an empty table', async () => {
    render([])

    expect(await screen.findByText(/A workflow that reads a variable/)).toBeInTheDocument()
  })
})
