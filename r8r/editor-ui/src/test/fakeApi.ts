/**
 * An in-memory r8r server.
 *
 * The editor takes its client by injection, so a component test never touches
 * the network and never has to stub `fetch`. Override just the methods a test
 * cares about; the rest answer with something empty and valid.
 */

import { vi } from 'vitest'
import type { Api } from '../api'

export function fakeApi(overrides: Partial<Api> = {}): Api {
  return {
    nodeTypes: vi.fn().mockResolvedValue([]),

    listWorkflows: vi.fn().mockResolvedValue([]),
    getWorkflow: vi.fn().mockRejectedValue(new Error('no workflow was stubbed')),
    createWorkflow: vi.fn().mockRejectedValue(new Error('no workflow was stubbed')),
    updateWorkflow: vi.fn().mockRejectedValue(new Error('no workflow was stubbed')),
    deleteWorkflow: vi.fn().mockResolvedValue({ deleted: 'x' }),
    setActive: vi.fn().mockRejectedValue(new Error('no workflow was stubbed')),

    runUnsaved: vi.fn().mockRejectedValue(new Error('no run was stubbed')),
    runSaved: vi.fn().mockRejectedValue(new Error('no run was stubbed')),

    credentialTypes: vi.fn().mockResolvedValue([]),
    listCredentials: vi.fn().mockResolvedValue([]),
    getCredential: vi.fn().mockRejectedValue(new Error('no credential was stubbed')),
    createCredential: vi.fn().mockRejectedValue(new Error('no credential was stubbed')),
    updateCredential: vi.fn().mockRejectedValue(new Error('no credential was stubbed')),
    deleteCredential: vi.fn().mockResolvedValue({ deleted: 'x' }),

    listVariables: vi.fn().mockResolvedValue([]),
    setVariable: vi.fn().mockRejectedValue(new Error('no variable was stubbed')),
    deleteVariable: vi.fn().mockResolvedValue({ deleted: 'x' }),

    listVersions: vi.fn().mockResolvedValue([]),
    getVersion: vi.fn().mockRejectedValue(new Error('no version was stubbed')),
    compareVersions: vi.fn().mockRejectedValue(new Error('no version was stubbed')),
    restoreVersion: vi.fn().mockRejectedValue(new Error('no version was stubbed')),

    listExecutions: vi.fn().mockResolvedValue([]),
    getExecution: vi.fn().mockRejectedValue(new Error('no execution was stubbed')),
    deleteExecution: vi.fn().mockResolvedValue({ deleted: 'x' }),

    ...overrides,
  }
}
