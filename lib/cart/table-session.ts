'use client'

import { useState, useEffect } from 'react'

export function useTableSession() {
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const num = localStorage.getItem('kaizen_table_number')
    const tId = localStorage.getItem('kaizen_table_id')
    const sId = localStorage.getItem('kaizen_session_id')
    if (num) setTableNumber(parseInt(num, 10))
    if (tId) setTableId(tId)
    if (sId) setSessionId(sId)
    setLoading(false)
  }, [])

  const startSession = (num: number, tId: string, sId: string) => {
    localStorage.setItem('kaizen_table_number', num.toString())
    localStorage.setItem('kaizen_table_id', tId)
    localStorage.setItem('kaizen_session_id', sId)
    setTableNumber(num)
    setTableId(tId)
    setSessionId(sId)
  }

  const endSession = () => {
    localStorage.removeItem('kaizen_table_number')
    localStorage.removeItem('kaizen_table_id')
    localStorage.removeItem('kaizen_session_id')
    setTableNumber(null)
    setTableId(null)
    setSessionId(null)
  }

  return { tableNumber, tableId, sessionId, startSession, endSession, loading }
}
