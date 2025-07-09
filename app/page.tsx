"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AnalysisDisplay } from "@/components/ui/analysis-display"
import { FileText, Bot, AlertCircle, Rss } from "lucide-react"
import Link from "next/link"

type AnalysisResult = {
  score: number
  confidence: number
  reasoning: string
  flags: string[]
  verdict: "TRUSTWORTHY" | "QUESTIONABLE" | "FAKE"
  sourceCredibility: { score: number; description: string }
  bias: { political: string; ideological: string }
  sentiment: { type: string; score: number }
  claims: Array<{ claim: string; verification: string }>
  factCheckers: Array<{ name:string; url: string }>
  aigcScore: number
}

export default function Home() {
  const [text, setText] = useState("")
  const [provider, setProvider] = useState("openai")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!text) {
      setError("Please enter some text to analyze.")
      return
    }
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          articleData: { content: text, title: "User-submitted text", url: "N/A", author: "N/A", publishDate: "N/A", domain: "N/A" },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || "Failed to analyze text.")
      }

      const data: AnalysisResult = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const providers = [
    { value: "openai", label: "OpenAI (GPT-4o Mini)" },
    { value: "gemini", label: "Google (Gemini 1.5 Flash)" },
    { value: "groq", label: "Groq (Llama 3)" },
    { value: "deepseek", label: "Deepseek (Coder)" },
    { value: "xai", label: "xAI (Grok)" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-4 md:px-8 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rss className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold">Fake News Detector</h1>
          </div>
          <nav>
            <Link href="/learn" className="text-sm font-medium hover:text-primary">
              Learn to Spot Fakes
            </Link>
          </nav>
        </div>
      </header>

      <main className="py-8 px-4 md:px-8">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Analyze Article Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste the article text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[400px] text-base"
                disabled={isLoading}
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={provider} onValueChange={setProvider} disabled={isLoading}>
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder="Select AI Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 mr-2" />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAnalyze} disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? "Analyzing..." : "Analyze"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="w-5 h-5" />
                Analysis Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <div className="text-center">
                    <Bot className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg font-semibold">AI is thinking...</p>
                    <p className="text-sm text-muted-foreground">Please wait for the analysis.</p>
                  </div>
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {result && (
                <AnalysisDisplay result={result} />
              )}
              {!isLoading && !result && !error && (
                <div className="text-center text-muted-foreground py-16 min-h-[300px] flex items-center justify-center">
                  <p>Your analysis results will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
