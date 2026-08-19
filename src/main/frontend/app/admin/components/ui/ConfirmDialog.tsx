'use client'
import React from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Ersetzt native confirm()-Dialoge (z.B. beim Section-/Seiten-Löschen) durch einen
 *  Dialog im Design des restlichen Admin-Bereichs. */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen',
  destructive = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidthClassName="max-w-sm">
      <p className="mb-5 text-sm text-gray-300">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
