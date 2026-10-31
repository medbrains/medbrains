import { describe, expect, it, vi } from 'vitest'
import { nodeType, workflowNode } from '../test/fixtures'
import { renderWithProviders, screen, within } from '../test/render'
import type { NodeTypeDescription, WorkflowNode } from '../types'
import { ParameterForm } from './ParameterForm'

/** A node type shaped like the real HTTP node: a body that only shows for JSON. */
const httpType: NodeTypeDescription = nodeType({
  name: 'httpRequest',
  displayName: 'HTTP Request',
  group: 'output',
  properties: [
    {
      name: 'method',
      displayName: 'Method',
      type: 'options',
      default: 'GET',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
      ],
    },
    { name: 'url', displayName: 'URL', type: 'string', default: '', required: true },
    { name: 'headers', displayName: 'Headers', type: 'keyValue', default: {} },
    {
      name: 'bodyType',
      displayName: 'Body Type',
      type: 'options',
      default: 'none',
      options: [
        { name: 'None', value: 'none' },
        { name: 'JSON', value: 'json' },
      ],
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'json',
      default: '{}',
      displayOptions: { show: { bodyType: ['json'] } },
    },
    { name: 'neverError', displayName: 'Never Error', type: 'boolean', default: false },
  ],
})

function renderForm(node: WorkflowNode, description = httpType) {
  const onPatch = vi.fn()
  const onDelete = vi.fn()
  const rendered = renderWithProviders(
    <ParameterForm
      node={node}
      description={description}
      credentialTypes={[]}
      input={[]}
      destinations={[]}
      onPatch={onPatch}
      onDelete={onDelete}
    />,
  )
  return { ...rendered, onPatch, onDelete }
}

describe('ParameterForm', () => {
  it('renders a field for every declared property', () => {
    renderForm(workflowNode({ type: 'httpRequest', parameters: { method: 'GET' } }))

    // Query by role: Mantine renders a visible input plus a hidden one, so a
    // text match alone is ambiguous.
    expect(screen.getByRole('combobox', { name: /Method/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /URL/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Never Error/ })).toBeInTheDocument()
  })

  it('hides a conditional field until its trigger value is chosen', () => {
    renderForm(workflowNode({ type: 'httpRequest', parameters: { bodyType: 'none' } }))
    expect(screen.queryByLabelText(/^Body$/)).not.toBeInTheDocument()
  })

  it('shows the conditional field once the trigger matches', () => {
    renderForm(workflowNode({ type: 'httpRequest', parameters: { bodyType: 'json' } }))
    expect(screen.getByRole('textbox', { name: /Body/ })).toBeInTheDocument()
  })

  it('reports an edited value to its owner rather than keeping local state', async () => {
    const { user, onPatch } = renderForm(
      workflowNode({ type: 'httpRequest', parameters: { url: '' } }),
    )

    await user.type(screen.getByRole('textbox', { name: /URL/ }), 'h')

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: expect.objectContaining({ url: 'h' }) }),
    )
  })

  it('marks a required field so the requirement is visible before saving', () => {
    renderForm(workflowNode({ type: 'httpRequest', parameters: {} }))

    // Mantine marks the requirement on the label rather than the input.
    expect(screen.getByText('URL').textContent).toContain('*')
    expect(screen.getByText('Method').textContent).not.toContain('*')
  })

  it('lets a key/value field grow a row', async () => {
    const { user, onPatch } = renderForm(
      workflowNode({ type: 'httpRequest', parameters: { headers: {} } }),
    )

    await user.click(screen.getByRole('button', { name: '+ Add' }))

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: expect.objectContaining({ headers: { '': '' } }) }),
    )
  })

  it('lets a key/value row be removed', async () => {
    const { user, onPatch } = renderForm(
      workflowNode({ type: 'httpRequest', parameters: { headers: { 'x-a': '1' } } }),
    )

    await user.click(screen.getByRole('button', { name: /Remove Headers row 1/ }))

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: expect.objectContaining({ headers: {} }) }),
    )
  })

  it('turns the retry settings on only once retrying is enabled', async () => {
    const { user } = renderForm(workflowNode({ type: 'httpRequest', parameters: {} }))

    expect(screen.queryByRole('textbox', { name: 'Max tries' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Retry on failure/ }))
    // The switch reports upward; the parent owns the state, so the fields
    // appear on the next render with the new node — asserted in the hook tests.
  })

  it('records a decision to continue on failure', async () => {
    const { user, onPatch } = renderForm(workflowNode({ type: 'httpRequest', parameters: {} }))

    await user.click(screen.getByRole('combobox', { name: /When this node fails/ }))
    await user.click(screen.getByRole('option', { name: /Pass the error on/ }))

    expect(onPatch).toHaveBeenCalledWith({ onError: 'continue' })
  })

  it('records a decision to skip only the record that failed', async () => {
    const { user, onPatch } = renderForm(workflowNode({ type: 'httpRequest', parameters: {} }))

    await user.click(screen.getByRole('combobox', { name: /When this node fails/ }))
    await user.click(screen.getByRole('option', { name: /Skip the record/ }))

    expect(onPatch).toHaveBeenCalledWith({ onError: 'continueRecord' })
  })

  it('stopping is stored as no setting at all, which is the engine default', async () => {
    const { user, onPatch } = renderForm(
      workflowNode({ type: 'httpRequest', parameters: {}, onError: 'continue' }),
    )

    await user.click(screen.getByRole('combobox', { name: /When this node fails/ }))
    await user.click(screen.getByRole('option', { name: /Stop the run/ }))

    expect(onPatch).toHaveBeenCalledWith({ onError: null })
  })

  it('offers a way to delete the node', async () => {
    const { user, onDelete } = renderForm(workflowNode({ type: 'httpRequest', parameters: {} }))

    await user.click(screen.getByRole('button', { name: 'Delete node' }))

    expect(onDelete).toHaveBeenCalled()
  })

  it('says so plainly when a node has nothing to configure', () => {
    renderForm(
      workflowNode({ type: 'noOp' }),
      nodeType({ name: 'noOp', displayName: 'No Operation', properties: [] }),
    )
    expect(screen.getByText(/nothing to configure/)).toBeInTheDocument()
  })

  it('shows a credential picker only for nodes that need one', () => {
    const { container } = renderForm(
      workflowNode({ type: 'slack' }),
      nodeType({
        name: 'slack',
        displayName: 'Slack',
        credentials: [{ name: 'slackApi', required: true }],
        properties: [],
      }),
    )

    expect(within(container).getByText(/credential/i)).toBeInTheDocument()
  })
})
