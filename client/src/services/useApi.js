import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// Loads `url` (skipped while it is falsy) and exposes { data, error, loading, reload }.
export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) })

  const load = useCallback(async () => {
    if (!url) return setState({ data: null, error: null, loading: false })
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      setState({ data: await api.get(url), error: null, loading: false })
    } catch (err) {
      setState({ data: null, error: err.message, loading: false })
    }
  }, [url])

  useEffect(() => { load() }, [load])

  return { ...state, reload: load }
}

// Flattens sessions into a list of terms labelled "First Term 2026/2027", current term first.
export function useTerms() {
  const { data } = useApi('/sessions')
  const terms = (data || []).flatMap((s) => s.Terms.map((t) => ({ ...t, label: `${t.name} Term ${s.name}` })))
  const current = terms.find((t) => t.isCurrent) || terms[0] || null
  return { terms, current }
}
