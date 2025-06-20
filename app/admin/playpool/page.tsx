"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayCircle } from 'lucide-react'

export default function MasterPlayPoolPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-6 w-6" />
          Master Play Pool
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500">
          Coming soon: Master play pool management for standardizing plays across all teams.
        </div>
      </CardContent>
    </Card>
  )
} 