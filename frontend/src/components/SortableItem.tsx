import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className="relative group"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="absolute left-0.5 top-0 flex items-start justify-center opacity-0 group-hover:opacity-100 transition-opacity pt-0.5"
        style={{ width: 12, height: 18, cursor: 'grab', touchAction: 'none' }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="#555">
          <circle cx="2" cy="2"  r="1.2" />
          <circle cx="6" cy="2"  r="1.2" />
          <circle cx="2" cy="6"  r="1.2" />
          <circle cx="6" cy="6"  r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
        </svg>
      </div>
      {children}
    </div>
  )
}
