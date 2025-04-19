"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check } from "lucide-react"
import { load, save } from "@/lib/local"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TerminologyItem {
  id: string
  key: string
  label: string
  isEditing: boolean
}

interface TermRow {
  key: string
  label: string
  isEditing?: boolean
}

export default function SetupPage() {
  const router = useRouter()
  const [selectedSet, setSelectedSet] = useState("set1")
  const [rows, setRows] = useState<TermRow[]>(() => load('terms', []))

  // Save rows to localStorage whenever they change
  useEffect(() => {
    save('terms', rows)
  }, [rows])

  const terminologySets = {
    set1: [
      { key: "customer", label: "Customer" },
      { key: "product", label: "Product" },
      { key: "order", label: "Order" },
    ],
    set2: [
      { key: "user", label: "User" },
      { key: "account", label: "Account" },
      { key: "profile", label: "Profile" },
    ],
    set3: [
      { key: "project", label: "Project" },
      { key: "task", label: "Task" },
      { key: "milestone", label: "Milestone" },
    ],
    set4: [
      { key: "article", label: "Article" },
      { key: "category", label: "Category" },
      { key: "tag", label: "Tag" },
    ],
    set5: [
      { key: "employee", label: "Employee" },
      { key: "department", label: "Department" },
      { key: "position", label: "Position" },
    ],
  }

  // Convert terminologySet items to rows when set changes
  useEffect(() => {
    const newRows = terminologySets[selectedSet as keyof typeof terminologySets].map(item => ({
      ...item,
      isEditing: false
    }))
    setRows(newRows)
  }, [selectedSet])

  const addRow = () => {
    const newRow: TermRow = {
      key: `custom_${rows.length + 1}`,
      label: '',
      isEditing: true
    }
    setRows([...rows, newRow])
  }

  const toggleEdit = (index: number) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, isEditing: !row.isEditing } : row
    ))
  }

  const updateLabel = (index: number, newLabel: string) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, label: newLabel } : row
    ))
  }

  const saveItem = (index: number) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, isEditing: false } : row
    ))
  }

  const handleContinue = () => {
    // Save current state before navigation
    save('terms', rows)
    router.push('/scouting')
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 rounded shadow bg-white">
      <div className="mb-4">
        <Select value={selectedSet} onValueChange={setSelectedSet}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select terminology set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="set1">Terminology Set 1</SelectItem>
            <SelectItem value="set2">Terminology Set 2</SelectItem>
            <SelectItem value="set3">Terminology Set 3</SelectItem>
            <SelectItem value="set4">Terminology Set 4</SelectItem>
            <SelectItem value="set5">Terminology Set 5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <h1 className="text-2xl font-bold mb-6">Terminology</h1>

      <div className="mb-6">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 font-medium mb-2 px-2">
          <div>Key</div>
          <div>Label</div>
          <div></div>
        </div>

        {rows.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center py-2 border-b">
            <div className="text-gray-600">{row.key}</div>
            <div>
              {row.isEditing ? (
                <Input 
                  value={row.label} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLabel(index, e.target.value)} 
                  className="h-9" 
                />
              ) : (
                <span>{row.label}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (row.isEditing) {
                  saveItem(index)
                } else {
                  toggleEdit(index)
                }
              }}
            >
              {row.isEditing ? <Check className="h-4 w-4 text-green-500" /> : <Pencil className="h-4 w-4" />}
              <span className="sr-only">{row.isEditing ? "Save" : "Edit"}</span>
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
        <Button onClick={handleContinue}>
          Continue <span aria-hidden="true">→</span>
        </Button>
      </div>
    </div>
  )
}
