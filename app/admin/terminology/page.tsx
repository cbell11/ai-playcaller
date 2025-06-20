"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Book } from 'lucide-react'

export default function MasterTerminologyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Book className="h-6 w-6" />
          Master Terminology Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500">
          Coming soon: Master terminology management for formations, tags, concepts, and more.
        </div>
      </CardContent>
    </Card>
  )
} 