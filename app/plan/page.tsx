"use client"

import { useState, useEffect, useRef, MouseEventHandler } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Download, ArrowLeft } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { load, save } from "@/lib/local"
import { makeGamePlan } from "@/app/actions"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Slider } from "../components/ui/slider"
import { Textarea } from "../components/ui/textarea"

// Define types for our plan structure
interface PlayCall {
  formation: string
  fieldAlignment: "+" | "-"  // + for field, - for boundary
  motion?: string  // optional motion
  play: string
}

interface GamePlan {
  openingScript: PlayCall[]
  basePackage1: PlayCall[]
  basePackage2: PlayCall[]
  basePackage3: PlayCall[]
  firstDowns: PlayCall[]
  secondAndShort: PlayCall[]
  secondAndLong: PlayCall[]
  shortYardage: PlayCall[]
  thirdAndLong: PlayCall[]
  redZone: PlayCall[]
  goalline: PlayCall[]
  backedUp: PlayCall[]
  screens: PlayCall[]
  playAction: PlayCall[]
  deepShots: PlayCall[]
}

// Helper function to format a play call
const formatPlayCall = (play: PlayCall) => {
  return `${play.formation}${play.fieldAlignment}${play.motion ? ` → ${play.motion}` : ''} → ${play.play}`
}

export default function PlanPage() {
  const router = useRouter()
  const componentRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<GamePlan | null>(() => load('plan', null))
  const [loading, setLoading] = useState(false)
  const [motionPercentage, setMotionPercentage] = useState<number>(25)
  const [runPassRatio, setRunPassRatio] = useState<number>(50)
  const [specificConcepts, setSpecificConcepts] = useState<string>("")

  const printRef = useRef<HTMLDivElement>(null)

  const printHandler = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Game Plan',
    onAfterPrint: () => console.log('Print completed')
  })

  const handlePrint: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    printHandler();
  };

  useEffect(() => {
    async function generatePlan() {
      if (!plan) {
        setLoading(true)
        try {
          const result = await makeGamePlan({
            fronts: load('fronts_pct', {}),
            coverages: load('coverages_pct', {}),
            blitz: load('blitz_pct', {}),
            terms: load('terms', []),
            preferences: {
              motionPercentage,
              runPassRatio,
              specificConcepts: specificConcepts.split('\n').filter(Boolean)
            }
          })
          if (result) {
            const generatedPlan = JSON.parse(result) as GamePlan
            setPlan(generatedPlan)
            save('plan', generatedPlan)
          }
        } catch (error) {
          console.error('Error generating plan:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    generatePlan()
  }, [plan, motionPercentage, runPassRatio, specificConcepts])

  // Helper function to render a play list card
  const renderPlayListCard = (
    title: string,
    plays: PlayCall[],
    expectedLength: number,
    bgColor: string = "bg-blue-100"
  ) => (
    <Card className="bg-white rounded shadow">
      <CardHeader className={`${bgColor} border-b`}>
        <CardTitle className="font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: expectedLength }).map((_, index) => (
            <div
              key={index}
              className="px-4 py-2 flex items-center text-sm font-mono"
            >
              <span className="w-8 text-slate-500">{index + 1}.</span>
              <span>{plays?.[index] ? formatPlayCall(plays[index]) : "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Game Plan</h1>
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

        {/* User Preferences Form */}
        <Card className="bg-white">
            <CardHeader>
            <CardTitle>Game Plan Preferences</CardTitle>
            </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Motion Percentage</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[motionPercentage]}
                  onValueChange={(value) => setMotionPercentage(value[0])}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-right">{motionPercentage}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Run/Pass Ratio</Label>
              <div className="flex items-center gap-4">
                <div className="text-sm text-right w-16">
                  <div>Run</div>
                  <div className="font-semibold">{runPassRatio}%</div>
                </div>
                <Slider
                  value={[runPassRatio]}
                  onValueChange={(value) => setRunPassRatio(value[0])}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <div className="text-sm w-16">
                  <div>Pass</div>
                  <div className="font-semibold">{100 - runPassRatio}%</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Specific Concepts/Formations</Label>
              <Textarea
                value={specificConcepts}
                onChange={(e) => setSpecificConcepts(e.target.value)}
                placeholder="Enter specific concepts or formations (one per line)"
                className="min-h-[100px]"
              />
        </div>

            <Button 
              onClick={() => setPlan(null)} 
              className="w-full"
              variant="default"
            >
              Generate Game Plan
            </Button>
            </CardContent>
          </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Opening Script - Special color to stand out */}
          {renderPlayListCard("Opening Script", plan.openingScript, 7, "bg-amber-100")}
          
          {/* Base Packages */}
          {renderPlayListCard("Base Package 1", plan.basePackage1, 10, "bg-green-100")}
          {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100")}
          {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100")}

        {/* Situational */}
          {renderPlayListCard("First Downs", plan.firstDowns, 10, "bg-blue-100")}
          {renderPlayListCard("2nd and Short", plan.secondAndShort, 5, "bg-blue-100")}
          {renderPlayListCard("2nd and Long", plan.secondAndLong, 5, "bg-blue-100")}
          {renderPlayListCard("Short Yardage", plan.shortYardage, 5, "bg-blue-100")}
          {renderPlayListCard("3rd and Long", plan.thirdAndLong, 5, "bg-blue-100")}
          
          {/* Field Position */}
          {renderPlayListCard("Red Zone", plan.redZone, 5, "bg-red-100")}
          {renderPlayListCard("Goalline", plan.goalline, 5, "bg-red-100")}
          {renderPlayListCard("Backed Up", plan.backedUp, 5, "bg-red-100")}
          
          {/* Special Categories */}
          {renderPlayListCard("Screens", plan.screens, 5, "bg-purple-100")}
          {renderPlayListCard("Play Action", plan.playAction, 5, "bg-purple-100")}
          {renderPlayListCard("Deep Shots", plan.deepShots, 5, "bg-purple-100")}
        </div>
      </div>
    </div>
  )
}
