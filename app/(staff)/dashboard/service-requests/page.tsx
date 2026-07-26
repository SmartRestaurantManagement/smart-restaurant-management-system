'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCallerRestaurantId } from '@/lib/api/restaurant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/staff/empty-state'
import { PhoneCall, Check, Clock, RefreshCw, AlertCircle } from 'lucide-react'

interface ServiceRequestRow {
  id: string
  type: 'water' | 'server' | 'bill'
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled'
  requested_at: string
  table_id: string
  table: { table_number: number } | null
}

export default function ServiceRequestsDashboard() {
  const supabase = createClient()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [requests, setRequests] = useState<ServiceRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  
  // Timer state to force component re-renders every second for the SLA clocks
  const [time, setTime] = useState(Date.now())

  const loadRequests = useCallback(async (rid: string) => {
    // We only fetch active (pending or in_progress) requests
    const { data, error: reqError } = await supabase
      .from('service_requests')
      .select('*, table:tables(table_number)')
      .eq('restaurant_id', rid)
      .in('status', ['pending', 'in_progress'])
      .order('requested_at', { ascending: true })

    if (reqError) {
      setError(reqError.message)
    } else {
      setRequests((data as unknown as ServiceRequestRow[]) || [])
      setError(null)
    }
  }, [supabase])

  useEffect(() => {
    (async () => {
      setLoading(true)
      
      let rid = await getCallerRestaurantId(supabase)
      if (!rid) {
        // query first restaurant as fallback
        const { data } = await supabase.from('restaurants').select('id').limit(1).single()
        rid = data?.id || null
      }

      if (!rid) {
        setError("Could not resolve restaurant ID.")
        setLoading(false)
        return
      }

      setRestaurantId(rid)
      await loadRequests(rid)
      setLoading(false)

      // Subscribe to service_requests changes for this restaurant
      const channel = supabase
        .channel(`service-calls-${rid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_requests',
            filter: `restaurant_id=eq.${rid}`,
          },
          () => {
            void loadRequests(rid)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })()
  }, [supabase, loadRequests])

  // Update SLA clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleResolve = async (id: string) => {
    if (!restaurantId) return
    setResolvingId(id)
    
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      
      if (res.ok) {
        await loadRequests(restaurantId)
      } else {
        const body = await res.json()
        setError(body.error || 'Failed to resolve request.')
      }
    } catch (e) {
      setError('Connection error. Please try again.')
    } finally {
      setResolvingId(null)
    }
  }

  // Helper to format SLA elapsed duration
  const getSlaDetails = (requestedAt: string) => {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000))
    const mins = Math.floor(elapsedSeconds / 60)
    const secs = elapsedSeconds % 60
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

    let colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200'
    let textLabel = 'Normal SLA'

    if (elapsedSeconds >= 300) {
      // Red: > 5 minutes
      colorClass = 'text-red-600 bg-red-50 border-red-200 animate-pulse'
      textLabel = 'CRITICAL SLA'
    } else if (elapsedSeconds >= 120) {
      // Amber: 2 to 5 minutes
      colorClass = 'text-amber-600 bg-amber-50 border-amber-200'
      textLabel = 'Warning SLA'
    }

    return { formatted, colorClass, textLabel }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Table Service Requests</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Monitor and resolve live dine-in table requests. Timers track active SLA durations.
        </p>
      </div>

      {error && <p className="text-sm text-destructive bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          <span>Listening for service calls...</span>
        </p>
      ) : requests.length === 0 ? (
        <EmptyState message="No active service requests right now. Standing by." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {requests.map((req) => {
            const { formatted, colorClass, textLabel } = getSlaDetails(req.requested_at)
            const typeLabel = req.type === 'bill' ? 'Request Bill' : req.type === 'water' ? 'Need Water' : 'Call Server'

            return (
              <Card 
                key={req.id} 
                className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              >
                <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-100 p-1.5 rounded-lg text-amber-800">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-800">
                        Table {req.table?.table_number ?? '—'}
                      </CardTitle>
                      <span className="text-xxs text-neutral-400 block">Requested: {new Date(req.requested_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <Badge className="bg-neutral-900 text-white font-medium border-0 capitalize">
                    {typeLabel}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  {/* SLA clock */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${colorClass}`}>
                    <Clock className="h-4 w-4" />
                    <span>{formatted}</span>
                    <span className="text-xxs font-normal uppercase hidden sm:inline">({textLabel})</span>
                  </div>

                  {/* Resolve Button */}
                  <Button
                    size="sm"
                    disabled={resolvingId === req.id}
                    onClick={() => handleResolve(req.id)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {resolvingId === req.id ? 'Resolving...' : 'Resolve Call'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
