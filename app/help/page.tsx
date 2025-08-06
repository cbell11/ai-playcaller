"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Help & Documentation</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Basic setup and navigation</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Select your team and opponent from the sidebar</li>
              <li>Build your play pool with opponent-specific plays</li>
              <li>Generate or manually build your game plan</li>
              <li>Print or export your game plan when ready</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Play Pool Management</CardTitle>
            <CardDescription>Working with your play pool</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Add plays to your pool using the "Add Play" button</li>
              <li>Customize plays with specific formations, motions, and concepts</li>
              <li>Star your favorite plays for quick access</li>
              <li>Filter plays by category or search for specific plays</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game Plan Features</CardTitle>
            <CardDescription>Building and managing your game plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Use AI to generate a complete game plan based on your play pool</li>
              <li>Manually add plays from your pool to specific sections</li>
              <li>Lock important plays to prevent accidental changes</li>
              <li>Customize section names and adjust section sizes</li>
              <li>Regenerate individual sections while keeping locked plays</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tips & Tricks</CardTitle>
            <CardDescription>Advanced features and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Use the search function to quickly find specific plays</li>
              <li>Customize the color coding for different play categories</li>
              <li>Lock critical plays before regenerating sections</li>
              <li>Use the visibility settings to hide unused sections</li>
              <li>Adjust print orientation for optimal game plan layout</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 