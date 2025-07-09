import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertTriangle, Eye, Users, Pen, Scale } from "lucide-react"

const LearningPoint = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="text-primary mt-1">{icon}</div>
    <div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  </div>
)

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-4 md:px-8 border-b">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-primary">Become a Better News Detective</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Learn the key signs of misinformation to protect yourself and others.
          </p>
        </div>
      </header>

      <main className="py-8 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Key Strategies for Spotting Fake News</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <LearningPoint icon={<Scale className="w-7 h-7" />} title="Consider the Source">
                Investigate the site's mission and contact info. Lack of transparency is a red flag. Be wary of sources with a history of bias or inaccuracy.
              </LearningPoint>

              <LearningPoint icon={<Pen className="w-7 h-7" />} title="Check the Author">
                Do a quick search on the author. Are they credible? Are they real? A lack of an author or a generic one can be a warning sign.
              </LearningPoint>

              <LearningPoint icon={<CheckCircle2 className="w-7 h-7" />} title="Check the Date">
                Old news stories can be reposted to seem relevant. Always check the publication date to see if it's current.
              </LearningPoint>

              <LearningPoint icon={<AlertTriangle className="w-7 h-7" />} title="Check Your Biases">
                We are all biased. Consider if your own beliefs could affect your judgment of a news story. Critical reading involves self-awareness.
              </LearningPoint>

              <LearningPoint icon={<Users className="w-7 h-7" />} title="Consult the Experts">
                Check with reputable fact-checking websites (like Snopes, PolitiFact, or AP Fact Check) to see if they have already verified or debunked the story.
              </LearningPoint>

              <LearningPoint icon={<Eye className="w-7 h-7" />} title="Look for Supporting Sources">
                Reputable news stories will cite their sources. Click on those links and see if they actually support the story's claims.
              </LearningPoint>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 