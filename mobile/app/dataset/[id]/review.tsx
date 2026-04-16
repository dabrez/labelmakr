import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { API_BASE_URL } from '../../../config'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface DpoPayload { prompt: Message[]; chosen: string; rejected: string }

interface Example {
  id: string
  exampleType: 'sft' | 'dpo'
  payload: Message[] | DpoPayload
  status: string
  source: string
  notes: string | null
}

const ROLE_COLORS: Record<string, { label: string; text: string; bg: string }> = {
  system: { label: 'System', text: '#c4b5fd', bg: '#2e1065' },
  user: { label: 'User', text: '#93c5fd', bg: '#1e3a5f' },
  assistant: { label: 'Assistant', text: '#86efac', bg: '#052e16' },
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [queue, setQueue] = useState<Example[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedMessages, setEditedMessages] = useState<Message[]>([])
  const [editedChosen, setEditedChosen] = useState('')
  const [editedRejected, setEditedRejected] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API_BASE_URL}/api/datasets/${id}/examples?status=pending&limit=100`)
    const data = await res.json()
    setQueue(data.examples)
    setIdx(0)
    setDone(data.examples.length === 0)
    setLoading(false)
  }, [id])

  useEffect(() => { loadQueue() }, [loadQueue])

  const current = queue[idx]

  useEffect(() => {
    if (!current) return
    setNotes(current.notes ?? '')
    setEditing(false)
    if (current.exampleType === 'dpo') {
      const p = current.payload as DpoPayload
      setEditedChosen(p.chosen)
      setEditedRejected(p.rejected)
      setEditedMessages(p.prompt)
    } else {
      setEditedMessages(current.payload as Message[])
      setEditedChosen('')
      setEditedRejected('')
    }
  }, [current])

  const decide = async (status: 'approved' | 'rejected') => {
    if (!current || saving) return
    setSaving(true)
    const body: Record<string, unknown> = { status, notes: notes.trim() || null }
    if (editing) {
      if (current.exampleType === 'dpo') {
        body.chosen = editedChosen
        body.rejected = editedRejected
        body.prompt = editedMessages
      } else {
        body.messages = editedMessages
      }
    }
    await fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    const next = idx + 1
    if (next >= queue.length) setDone(true)
    else setIdx(next)
  }

  const skip = () => {
    const next = idx + 1
    if (next >= queue.length) setDone(true)
    else setIdx(next)
  }

  const updateMessage = (i: number, content: string) => {
    setEditedMessages((prev) => prev.map((m, mi) => mi === i ? { ...m, content } : m))
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#60a5fa" /></View>
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
        <Text style={styles.doneTitle}>Review complete!</Text>
        <Text style={styles.doneHint}>No more pending examples.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back to Dataset</Text>
        </Pressable>
        <Pressable style={[styles.backBtn, { backgroundColor: '#2563eb', marginTop: 8 }]} onPress={loadQueue}>
          <Text style={styles.backBtnText}>Refresh Queue</Text>
        </Pressable>
      </View>
    )
  }

  const isDpo = current.exampleType === 'dpo'

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(idx / queue.length) * 100}%` }]} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{idx + 1} / {queue.length}</Text>
          <View style={[styles.typeBadge, isDpo ? { backgroundColor: '#3b0764' } : { backgroundColor: '#1e3a5f' }]}>
            <Text style={[styles.typeBadgeText, { color: isDpo ? '#c4b5fd' : '#93c5fd' }]}>
              {isDpo ? 'DPO' : 'SFT'}
            </Text>
          </View>
          <Text style={styles.sourceText}>{current.source}</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {isDpo ? (
            // DPO layout: prompt + side-by-side chosen/rejected
            <DpoReviewContent
              payload={current.payload as DpoPayload}
              editing={editing}
              editedMessages={editedMessages}
              editedChosen={editedChosen}
              editedRejected={editedRejected}
              onUpdateMessage={updateMessage}
              onChosenChange={setEditedChosen}
              onRejectedChange={setEditedRejected}
            />
          ) : (
            // SFT layout: message thread
            (editing ? editedMessages : (current.payload as Message[])).map((m, i) => {
              const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.user
              return (
                <View key={i} style={[styles.messageBlock, { backgroundColor: rc.bg }]}>
                  <Text style={[styles.roleLabel, { color: rc.text }]}>{rc.label}</Text>
                  {editing ? (
                    <TextInput
                      style={[styles.messageInput, { color: '#e5e7eb' }]}
                      value={m.content}
                      onChangeText={(t) => updateMessage(i, t)}
                      multiline
                      scrollEnabled={false}
                    />
                  ) : (
                    <Text style={styles.messageText}>{m.content}</Text>
                  )}
                </View>
              )
            })
          )}

          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes..."
              placeholderTextColor="#4b5563"
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.editBtn, editing && { backgroundColor: '#374151' }]}
            onPress={() => setEditing(!editing)}
          >
            <Text style={styles.editBtnText}>{editing ? 'Done Editing' : 'Edit'}</Text>
          </Pressable>
          <View style={styles.decisionRow}>
            <Pressable style={[styles.rejectBtn, saving && { opacity: 0.5 }]} onPress={() => decide('rejected')} disabled={saving}>
              <Text style={styles.rejectBtnText}>✕ Reject</Text>
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={skip}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
            <Pressable style={[styles.approveBtn, saving && { opacity: 0.5 }]} onPress={() => decide('approved')} disabled={saving}>
              <Text style={styles.approveBtnText}>✓ Approve</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

function DpoReviewContent({
  payload, editing,
  editedMessages, editedChosen, editedRejected,
  onUpdateMessage, onChosenChange, onRejectedChange,
}: {
  payload: DpoPayload
  editing: boolean
  editedMessages: Message[]
  editedChosen: string
  editedRejected: string
  onUpdateMessage: (i: number, t: string) => void
  onChosenChange: (t: string) => void
  onRejectedChange: (t: string) => void
}) {
  const promptMsgs = editing ? editedMessages : payload.prompt
  const chosen = editing ? editedChosen : payload.chosen
  const rejected = editing ? editedRejected : payload.rejected

  return (
    <>
      <Text style={styles.dpoSectionLabel}>Prompt</Text>
      {promptMsgs.map((m, i) => (
        <View key={i} style={[styles.messageBlock, { backgroundColor: '#1e3a5f' }]}>
          <Text style={[styles.roleLabel, { color: '#93c5fd' }]}>
            {m.role === 'user' ? 'User' : m.role}
          </Text>
          {editing ? (
            <TextInput
              style={[styles.messageInput, { color: '#e5e7eb' }]}
              value={m.content}
              onChangeText={(t) => onUpdateMessage(i, t)}
              multiline scrollEnabled={false}
            />
          ) : (
            <Text style={styles.messageText}>{m.content}</Text>
          )}
        </View>
      ))}

      <Text style={[styles.dpoSectionLabel, { marginTop: 12 }]}>Responses</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={[styles.dpoResponseBlock, { borderColor: '#14532d', flex: 1 }]}>
          <Text style={styles.chosenLabel}>Chosen</Text>
          {editing ? (
            <TextInput
              style={[styles.messageInput, { color: '#86efac', minHeight: 80 }]}
              value={chosen}
              onChangeText={onChosenChange}
              multiline scrollEnabled={false}
            />
          ) : (
            <Text style={[styles.messageText, { color: '#86efac' }]}>{chosen}</Text>
          )}
        </View>
        <View style={[styles.dpoResponseBlock, { borderColor: '#7f1d1d', flex: 1 }]}>
          <Text style={styles.rejectedLabel}>Rejected</Text>
          {editing ? (
            <TextInput
              style={[styles.messageInput, { color: '#fca5a5', minHeight: 80 }]}
              value={rejected}
              onChangeText={onRejectedChange}
              multiline scrollEnabled={false}
            />
          ) : (
            <Text style={[styles.messageText, { color: '#fca5a5' }]}>{rejected}</Text>
          )}
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  progressBar: { height: 3, backgroundColor: '#1f2937' },
  progressFill: { height: 3, backgroundColor: '#2563eb' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  progressText: { color: '#6b7280', fontSize: 12 },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  sourceText: { color: '#4b5563', fontSize: 11, marginLeft: 'auto' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  messageBlock: { borderRadius: 12, padding: 12, marginBottom: 8 },
  roleLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  messageText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  messageInput: { fontSize: 14, lineHeight: 20, padding: 0, minHeight: 60 },
  dpoSectionLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  dpoResponseBlock: { borderRadius: 12, padding: 10, backgroundColor: '#0a0a0a', borderWidth: 1 },
  chosenLabel: { color: '#4ade80', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  rejectedLabel: { color: '#f87171', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  notesSection: { marginTop: 8, marginBottom: 16 },
  notesLabel: { color: '#4b5563', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesInput: { backgroundColor: '#111827', borderRadius: 12, padding: 12, color: '#9ca3af', fontSize: 13, borderWidth: 1, borderColor: '#1f2937', minHeight: 52 },
  actions: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: '#1f2937', gap: 10 },
  editBtn: { backgroundColor: '#1f2937', borderRadius: 10, padding: 10, alignItems: 'center' },
  editBtnText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  decisionRow: { flexDirection: 'row', gap: 8 },
  rejectBtn: { flex: 1, backgroundColor: '#3f0d11', borderRadius: 12, padding: 14, alignItems: 'center' },
  rejectBtnText: { color: '#f87171', fontWeight: '700', fontSize: 15 },
  skipBtn: { backgroundColor: '#1f2937', borderRadius: 12, padding: 14, paddingHorizontal: 16, alignItems: 'center' },
  skipBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  approveBtn: { flex: 1, backgroundColor: '#052e16', borderRadius: 12, padding: 14, alignItems: 'center' },
  approveBtnText: { color: '#4ade80', fontWeight: '700', fontSize: 15 },
  doneTitle: { color: '#f9fafb', fontWeight: '700', fontSize: 22, marginBottom: 6 },
  doneHint: { color: '#6b7280', fontSize: 14, marginBottom: 32 },
  backBtn: { backgroundColor: '#1f2937', borderRadius: 12, padding: 14, paddingHorizontal: 32, alignItems: 'center' },
  backBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 15 },
})
