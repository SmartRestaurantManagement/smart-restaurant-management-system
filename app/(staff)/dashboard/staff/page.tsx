'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCallerRestaurantId } from '@/lib/api/restaurant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/staff/empty-state'
import { Users, Shield, RefreshCw } from 'lucide-react'

interface StaffProfile {
  id: string
  full_name: string | null
  role: 'admin' | 'staff'
  created_at: string
}

export default function StaffDashboardPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStaff() {
      setLoading(true)
      
      let rid = await getCallerRestaurantId(supabase)
      if (!rid) {
        const { data } = await supabase.from('restaurants').select('id').limit(1).single()
        rid = data?.id || null
      }

      if (!rid) {
        setError("Could not resolve restaurant ID.")
        setLoading(false)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('restaurant_id', rid)
        .in('role', ['admin', 'staff'])
        .order('full_name')

      if (profileError) {
        setError(profileError.message)
      } else {
        setStaff((data as unknown as StaffProfile[]) || [])
      }
      setLoading(false)
    }

    loadStaff()
  }, [supabase])

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Restaurant Staff Profiles</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Review restaurant staff members and system administrators.
        </p>
      </div>

      {error && <p className="text-sm text-destructive bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          <span>Loading staff catalog...</span>
        </p>
      ) : staff.length === 0 ? (
        <EmptyState message="No staff accounts registered yet." />
      ) : (
        <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100 flex flex-row items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <CardTitle className="text-sm font-bold text-neutral-800">
              Active Members ({staff.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 text-neutral-400 font-semibold border-b border-neutral-100">
                    <th className="p-4">Name</th>
                    <th className="p-4">Account ID</th>
                    <th className="p-4">System Role</th>
                    <th className="p-4">Join Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-neutral-50/30">
                      <td className="p-4 font-bold text-neutral-800 flex items-center gap-2">
                        <div className="bg-neutral-100 h-7 w-7 rounded-full flex items-center justify-center text-neutral-600 font-bold">
                          {member.full_name?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <span>{member.full_name || 'System Member'}</span>
                      </td>
                      <td className="p-4 text-neutral-400 font-mono">{member.id}</td>
                      <td className="p-4">
                        <Badge 
                          className={`border-0 font-medium ${
                            member.role === 'admin' 
                              ? 'bg-red-50 text-red-700 font-bold' 
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {member.role === 'admin' ? (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Administrator
                            </span>
                          ) : (
                            'Restaurant Staff'
                          )}
                        </Badge>
                      </td>
                      <td className="p-4 text-neutral-500">
                        {new Date(member.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
