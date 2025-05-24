"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean | "indeterminate") => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked)
      }
    }

    return (
      <div className="relative">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            checked && "bg-primary text-primary-foreground",
            className
          )}
          {...props}
        />
        {checked && (
          <svg
            className="absolute left-0 top-0 h-4 w-4 text-primary-foreground pointer-events-none"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox } 