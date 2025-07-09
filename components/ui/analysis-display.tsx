"use client"

import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Shield, ShieldQuestion, ShieldOff, Scale, Languages, Bot, Link as LinkIcon, Flag } from "lucide-react"

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

const VerdictDisplay = ({ verdict }: { verdict: AnalysisResult["verdict"] }) => {
  const styles = {
    TRUSTWORTHY: {
      bgColor: "bg-green-100 dark:bg-green-900/50",
      textColor: "text-green-800 dark:text-green-300",
      icon: <Shield className="w-6 h-6" />,
    },
    QUESTIONABLE: {
      bgColor: "bg-yellow-100 dark:bg-yellow-900/50",
      textColor: "text-yellow-800 dark:text-yellow-300",
      icon: <ShieldQuestion className="w-6 h-6" />,
    },
    FAKE: {
      bgColor: "bg-red-100 dark:bg-red-900/50",
      textColor: "text-red-800 dark:text-red-300",
      icon: <ShieldOff className="w-6 h-6" />,
    },
  }[verdict]

  return (
    <div className={`p-4 rounded-lg flex items-center gap-4 ${styles.bgColor} ${styles.textColor}`}>
      {styles.icon}
      <span className="text-xl font-bold">{verdict}</span>
    </div>
  )
}

const ScoreMeter = ({ score, label }: { score: number, label: string }) => (
  <div>
    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{label}</h3>
    <div className="flex items-center gap-3">
      <span className="text-lg font-bold">{score}/100</span>
      <Progress value={score} className="w-full" />
    </div>
  </div>
)

export const AnalysisDisplay = ({ result }: { result: AnalysisResult }) => (
  <div className="space-y-6">
    <VerdictDisplay verdict={result.verdict} />
    
    <div className="grid grid-cols-2 gap-4">
      <ScoreMeter score={result.score} label="Authenticity Score" />
      <ScoreMeter score={result.confidence} label="AI Confidence" />
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Detailed Analysis</CardTitle></CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="reasoning">
          <AccordionItem value="reasoning">
            <AccordionTrigger className="text-sm font-semibold">Overall Reasoning</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pt-2">{result.reasoning}</AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="flags">
            <AccordionTrigger className="text-sm font-semibold flex items-center gap-2"><Flag className="w-4 h-4" />Flags</AccordionTrigger>
            <AccordionContent className="pt-2">
              {result.flags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.flags.map((flag, i) => <Badge key={i} variant="destructive">{flag}</Badge>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">No flags raised.</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="source">
            <AccordionTrigger className="text-sm font-semibold flex items-center gap-2"><Scale className="w-4 h-4" />Source & Bias</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 text-sm">
              <ScoreMeter score={result.sourceCredibility.score} label="Source Credibility" />
              <p>{result.sourceCredibility.description}</p>
              <div>
                <h4 className="font-semibold">Political Bias:</h4>
                <p className="text-muted-foreground">{result.bias.political}</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="language">
            <AccordionTrigger className="text-sm font-semibold flex items-center gap-2"><Languages className="w-4 h-4" />Language & Sentiment</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 text-sm">
              <p>The sentiment of this article is largely <span className="font-semibold">{result.sentiment.type}</span>.</p>
              <ScoreMeter score={(result.sentiment.score + 1) * 50} label="Sentiment Score" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="claims">
            <AccordionTrigger className="text-sm font-semibold">Claim Verification</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 text-sm">
              {result.claims.map((c, i) => (
                <div key={i} className="border-l-2 pl-3">
                  <p className="font-semibold italic">"{c.claim}"</p>
                  <p className="text-muted-foreground mt-1">{c.verification}</p>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="aigc">
            <AccordionTrigger className="text-sm font-semibold flex items-center gap-2"><Bot className="w-4 h-4" />AI-Generated Content</AccordionTrigger>
            <AccordionContent className="pt-2 text-sm">
              <ScoreMeter score={result.aigcScore} label="Likelihood of AI Generation" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fact-checkers">
            <AccordionTrigger className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="w-4 h-4" />Fact-Checkers</AccordionTrigger>
            <AccordionContent className="pt-2 text-sm">
              <p className="mb-2">Cross-reference this story with trusted fact-checking organizations:</p>
              <ul className="space-y-1">
                {result.factCheckers.map(fc => (
                  <li key={fc.name}><a href={fc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{fc.name}</a></li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
    </Card>
  </div>
) 