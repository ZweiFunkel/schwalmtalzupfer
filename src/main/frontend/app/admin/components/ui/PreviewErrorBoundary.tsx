'use client'
import React from 'react'

interface State { hasError: boolean }

/** Fängt Render-Fehler der Live-Vorschau ab (z.B. während eine Sektion gerade mit
 *  unvollständigen Pflichtfeldern bearbeitet wird) - React-Error-Boundaries gibt es
 *  nur als Klassenkomponente, kein Hook-Äquivalent. Der Rest des Editors bleibt
 *  bedienbar, auch wenn die Vorschau selbst gerade nicht darstellbar ist. */
export class PreviewErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: { children: React.ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 text-sm text-gray-500 italic">
          Vorschau mit den aktuellen Angaben nicht möglich - Pflichtfelder prüfen.
        </div>
      )
    }
    return this.props.children
  }
}
