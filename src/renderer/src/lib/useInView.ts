import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Returns a ref + whether the element has entered the viewport. `once` keeps it
 * true after the first sighting — used to lazily kick off a section's data the
 * first time it scrolls into view (so the Deployed dashboard doesn't fetch
 * every section's resources + metrics up front).
 */
export function useInView<T extends HTMLElement>(
  rootMargin = '200px',
  once = true
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) obs.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [rootMargin, once])

  return [ref, inView]
}
