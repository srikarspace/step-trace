import {
  Bot,
  Brain,
  CircleCheck,
  CircleHelp,
  CircleX,
  FilePen,
  FilePlus2,
  FileText,
  FolderSearch,
  MessageSquareText,
  ScrollText,
  SquareTerminal,
  TextSearch,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Step } from '../parser/types'

const TOOL_ICONS: Record<string, LucideIcon> = {
  Bash: SquareTerminal,
  Read: FileText,
  Write: FilePlus2,
  Edit: FilePen,
  Grep: TextSearch,
  Glob: FolderSearch,
}

function iconFor(step: Step): LucideIcon {
  switch (step.kind) {
    case 'prompt':
      return User
    case 'llm':
      return Bot
    case 'thinking':
      return Brain
    case 'text':
      return MessageSquareText
    case 'tool':
      return TOOL_ICONS[step.toolName ?? ''] ?? Wrench
    case 'system':
      if (step.id.endsWith('#end')) return step.status === 'error' ? CircleX : CircleCheck
      if (step.label === 'System prompt') return ScrollText
      return CircleHelp
  }
}

/** Line icon tinted by effect; red when the step failed. */
export function StepIcon({ step }: { step: Step }) {
  const Icon = iconFor(step)
  const tone = step.status === 'error' ? 'error' : step.effect
  return <Icon className={`step-icon tone-${tone}`} size={14} strokeWidth={2} aria-hidden />
}
