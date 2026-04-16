import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { API_BASE_URL } from '../../../config'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface Example {
  id: string
  messages: Message[]
  status: 'pending' | 'approved' | 'rejected'
  source: string
  notes: string | null
  createdAt: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#422006', text: '#fcd34d' },
  approved: { bg: '#052e16', text: '#4ade80' },
  rejected: { bg: '#3f0d11', text: '#f87171' },
}

export default function DatasetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const navigation = useNavigation()

  const [name, setName] = useState('Dataset')
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [examples, setExamples] = useState<Example[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [dsRes, exRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/datasets/${id}`),
        fetch(`${API_BASE_URL}/api/datasets/${id}/examples?limit=100${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`),
      ])
      const ds = await dsRes.json()
      const ex = await exRes.json()
      setName(ds.name)
      setStats(ds.stats)
      navigation.setOptions({ title: ds.name })
      setExamples(ex.examples)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, statusFilter])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  const updateStatus = async (exId: string, status: string) => {
    await fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${exId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const deleteExample = (exId: string) => {
    Alert.alert('Delete Example', 'Remove this example from the dataset?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${exId}`, { method: 'DELETE' })
          load()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#60a5fa" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBadge label="Total" value={stats.total} color="#e5e7eb" />
        <StatBadge label="Pending" value={stats.pending} color="#fcd34d" />
        <StatBadge label="Approved" value={stats.approved} color="#4ade80" />
        <StatBadge label="Rejected" value={stats.rejected} color="#f87171" />
      </View>

      {/* Review CTA */}
      <Pressable style={styles.reviewBtn} onPress={() => router.push(`/dataset/${id}/review`)}>
        <Text style={styles.reviewBtnText}>Review Queue ({stats.pending} pending)</Text>
      </Pressable>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <Pressable
            key={f}
            style={[styles.filterTab, statusFilter === f && styles.filterTabActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterTabText, statusFilter === f && styles.filterTabTextActive]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={examples}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No examples. Import data via the web UI.</Text>
          </View>
        }
        renderItem={({ item: ex }) => {
          const userMsg = ex.messages.find((m) => m.role === 'user')
          const assistantMsg = ex.messages.find((m) => m.role === 'assistant')
          const sc = STATUS_COLORS[ex.status]
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/dataset/${id}/example/${ex.id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{ex.status}</Text>
                </View>
                <Text style={styles.sourceText}>{ex.source}</Text>
              </View>

              {userMsg && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.roleLabel}>User</Text>
                  <Text style={styles.msgPreview} numberOfLines={2}>{userMsg.content}</Text>
                </View>
              )}
              {assistantMsg && (
                <View>
                  <Text style={[styles.roleLabel, { color: '#4ade80' }]}>Assistant</Text>
                  <Text style={[styles.msgPreview, { color: '#9ca3af' }]} numberOfLines={2}>{assistantMsg.content}</Text>
                </View>
              )}

              <View style={styles.cardActions}>
                {ex.status !== 'approved' && (
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#052e16' }]} onPress={() => updateStatus(ex.id, 'approved')}>
                    <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600' }}>Approve</Text>
                  </Pressable>
                )}
                {ex.status !== 'rejected' && (
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#3f0d11' }]} onPress={() => updateStatus(ex.id, 'rejected')}>
                    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>Reject</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actionBtn, { marginLeft: 'auto', backgroundColor: '#1f2937' }]} onPress={() => deleteExample(ex.id)}>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          )
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontWeight: '700', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: '#6b7280', fontSize: 11 }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  reviewBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  filterTabActive: { backgroundColor: '#2563eb' },
  filterTabText: { color: '#6b7280', fontSize: 12, textTransform: 'capitalize' },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  sourceText: { color: '#4b5563', fontSize: 11 },
  roleLabel: { color: '#60a5fa', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  msgPreview: { color: '#d1d5db', fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' },
  actionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#6b7280', fontSize: 14 },
})
