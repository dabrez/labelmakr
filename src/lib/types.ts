export type MessageRole = 'system' | 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string
}

export type ExampleStatus = 'pending' | 'approved' | 'rejected'
export type ExampleSource = 'manual' | 'imported' | 'synthetic'

export interface Example {
  id: string
  datasetId: string
  messages: Message[]
  status: ExampleStatus
  source: ExampleSource
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Dataset {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    examples: number
  }
}

export interface DatasetWithStats extends Dataset {
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}
