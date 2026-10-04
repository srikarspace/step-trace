import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from 'radix-ui'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded text-sm whitespace-nowrap outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        chip: 'h-5 border border-l-3 bg-background px-[7px] hover:bg-accent aria-pressed:border-primary aria-pressed:bg-chip-active aria-pressed:text-chip-active-foreground',
        link: 'h-auto p-0 text-link underline',
        segment: 'h-full rounded-none border-r border-border-soft px-2.5',
      },
      size: {
        default: 'h-5 px-2',
        icon: 'size-6',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
