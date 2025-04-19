"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Download, ArrowLeft } from "lucide-react"
import ReactToPrint from "react-to-print"
import { load, save } from "@/lib/local"
import { makeGamePlan } from "@/app/actions"

export default function PlanPage() {
  const router = useRouter()
  const componentRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<any>(() => load('plan', null))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function generatePlan() {
      if (!plan) {
        setLoading(true)
        try {
          const result = await makeGamePlan({
            fronts: load('fronts', {}),
            coverages: load('coverages', {}),
            blitz: load('blitz', {}),
            terms: load('terms', [])
          })
          const generatedPlan = JSON.parse(result)
          setPlan(generatedPlan)
          save('plan', generatedPlan)
        } catch (error) {
          console.error('Error generating plan:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    generatePlan()
  }, [plan])

  const handlePrint = () => {
    if (componentRef.current) {
      const printInstance = ReactToPrint({
        content: () => componentRef.current,
        documentTitle: "AI Game Plan",
      })
      printInstance()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-xl font-semibold animate-pulse">Generating Game Plan...</div>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-gray-600">No plan generated yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div ref={componentRef} className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">AI Game Plan</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/scouting')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Run Concepts */}
          <Card className="bg-white rounded shadow">
            <CardHeader>
              <CardTitle>Run Concepts</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.runConcepts.map((concept: any, index: number) => (
                  <li key={index} className={`p-2 ${index % 2 === 0 ? 'bg-gray-50' : ''} rounded`}>
                    {concept}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Pass Concepts */}
          <Card className="bg-white rounded shadow">
            <CardHeader>
              <CardTitle>Pass Concepts</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.passConcepts.map((concept: any, index: number) => (
                  <li key={index} className={`p-2 ${index % 2 === 0 ? 'bg-gray-50' : ''} rounded`}>
                    {concept}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Tendencies */}
          <Card className="bg-white rounded shadow">
            <CardHeader>
              <CardTitle>Key Tendencies</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.tendencies.map((tendency: any, index: number) => (
                  <li key={index} className={`p-2 ${index % 2 === 0 ? 'bg-gray-50' : ''} rounded`}>
                    {tendency}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
