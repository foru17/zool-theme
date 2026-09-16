import { Component, type ReactNode } from 'react'

/** Keeps one broken view from blanking the whole page; resets when `resetKey` changes. */
export class ErrorBoundary extends Component<{ resetKey: string; fallback: ReactNode; children: ReactNode }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  componentDidCatch(error: unknown) {
    console.error('[zool-theme]', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
