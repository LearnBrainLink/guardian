import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// Update the AnalysisResult type to match the backend
interface ImageAnalysisResult {
  imageUrl: string;
  finding: string;
}

interface AnalysisResult {
  score: number;
  confidence: number;
  reasoning: string;
  flags: string[];
  verdict: 'TRUSTWORTHY' | 'QUESTIONABLE' | 'FAKE' | 'ERROR';
  sourceCredibility: { score: number; description: string };
  bias: { political: string; ideological: string };
  sentiment: { type: string; score: number };
  claims: Array<{ claim: string; verification: string }>;
  stance: { supports: number; refutes: number; neutral: number };
  evidence: Array<{ title: string; url: string; snippet: string }>;
  aigcScore: number;
  timestamp?: number;
  imageAnalysis: ImageAnalysisResult[];
}

type Verdict = 'TRUSTWORTHY' | 'QUESTIONABLE' | 'FAKE' | 'ERROR';

type NetworkRequest = {
  id: string;
  url: string;
  domain: string;
};

const Popup = () => {
  const [provider, setProvider] = useState('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [isAdBlockerEnabled, setIsAdBlockerEnabled] = useState(true);
  const [hasNetworkPermission, setHasNetworkPermission] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Effect to load initial state and check permissions
  useEffect(() => {
    // Check for webRequest permission
    chrome.permissions.contains({ permissions: ['webRequest'] }, (result) => {
      setHasNetworkPermission(result);
    });

    // Load ad blocker status
    chrome.storage.local.get('isAdBlockerEnabled', (data) => {
        if (data.isAdBlockerEnabled === false) {
            setIsAdBlockerEnabled(false);
        }
    });

    const messageListener = (message: any) => {
      if (message.action === 'adblocker_status_changed') {
        setIsAdBlockerEnabled(message.isEnabled);
      } else if (message.action === 'analysis_result') {
        setIsLoading(false);
        if (message.error) {
          setError(message.error);
          setAnalysisResult(null);
        } else {
          setAnalysisResult(message.result);
          // Check if the result is older than a few seconds to determine if it's from cache
          setIsFromCache((Date.now() - (message.result.timestamp || 0)) > 2000);
        }
      } else if (message.action === 'update_block_count') {
        setBlockedCount(message.count);
      } else if (message.action === 'update_network_log') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                const currentTabId = tabs[0].id;
                const requestsForTab = message.requests[currentTabId] || {};
                const requestsArray = Object.entries(requestsForTab).map(([id, req]: [string, any]) => ({
                    id,
                    url: req.url,
                    domain: new URL(req.url).hostname,
                }));
                setNetworkRequests(requestsArray);
            }
        });
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Request initial data
    chrome.runtime.sendMessage({ action: 'get_block_count' });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.runtime.sendMessage({ action: 'get_network_log', tabId: tabs[0].id });
        }
    });

    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const requestNetworkPermission = () => {
    chrome.permissions.request({ permissions: ['webRequest'] }, (granted) => {
      if (granted) {
        setHasNetworkPermission(true);
        // Maybe send a message to background to start listening if it's not already
      }
    });
  };

  const handleToggleAdBlocker = () => {
    const newState = !isAdBlockerEnabled;
    setIsAdBlockerEnabled(newState);
    chrome.storage.local.set({ isAdBlockerEnabled: newState });
    chrome.runtime.sendMessage({ action: 'toggle_adblocker_globally', isEnabled: newState });
  };

  const handleActivatePicker = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'activate_element_picker' });
        window.close(); // Close the popup
      }
    });
  };

  const handleRuleCreation = (domain: string, action: 'allow' | 'block') => {
    chrome.runtime.sendMessage({
      action: action === 'allow' ? 'allow_domain' : 'block_domain',
      domain: domain
    });
    // Optimistically remove from list for better UX
    setNetworkRequests(prev => prev.filter(req => req.domain !== domain));
  };

  const handleAnalyze = () => {
    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);
    setIsFromCache(false);
    setFeedbackSent(false); // Reset feedback state on new analysis
    
    chrome.runtime.sendMessage({
      action: 'analyze_page',
      provider: provider
    });
  };

  const handleFeedback = async (feedback: 'helpful' | 'not_helpful') => {
    if (!analysisResult || feedbackSent) return;

    setFeedbackSent(true);
    
    try {
      await fetch('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisResult, feedback }),
      });
      // Optionally show a "Thanks!" message to the user
    } catch (error) {
      console.error("Failed to send feedback:", error);
      // Re-enable buttons if sending failed
      setFeedbackSent(false);
    }
  };

  const getVerdictColor = (verdict: AnalysisResult['verdict']) => {
    switch (verdict) {
      case 'TRUSTWORTHY':
        return 'text-green-500';
      case 'QUESTIONABLE':
        return 'text-yellow-500';
      case 'FAKE':
      case 'ERROR':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className={`w-[400px] h-auto bg-background text-foreground p-4 ${!isAdBlockerEnabled ? 'opacity-70' : ''}`}>
      <header className="flex items-center gap-3 pb-3 border-b">
        <Button 
          size="icon" 
          className={`w-16 h-16 rounded-full text-2xl font-bold ${isAdBlockerEnabled ? 'bg-primary' : 'bg-muted'}`}
          onClick={handleToggleAdBlocker}
          title={isAdBlockerEnabled ? "Turn Ad Blocker Off" : "Turn Ad Blocker On"}
        >
          {isAdBlockerEnabled ? 'ON' : 'OFF'}
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Guardian</h1>
          <p className="text-sm text-muted-foreground">The web, protected.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleActivatePicker} title="Pick element to hide">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pipette"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        </Button>
        <Button variant="ghost" size="icon" title="Settings">
          ⚙️
        </Button>
      </header>

      <Tabs defaultValue="news" className="w-full mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>
        <TabsContent value="news" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>News Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="deepseek">Deepseek</SelectItem>
                    <SelectItem value="xai">xAI</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAnalyze} disabled={isLoading}>
                  {isLoading ? 'Analyzing...' : 'Analyze Page'}
                </Button>
              </div>

              {isLoading && <p className="text-center mt-4">Loading...</p>}
              {error && <p className="text-center mt-4 text-red-500">{error}</p>}
              
              {analysisResult && (
                <div className="mt-4 space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-sm text-muted-foreground">Final Verdict</p>
                      {isFromCache && <Badge variant="secondary">Cached</Badge>}
                    </div>
                    <p className={`text-3xl font-bold ${getVerdictColor(analysisResult.verdict)}`}>
                      {analysisResult.verdict}
                    </p>
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="reasoning">
                      <AccordionTrigger>Reasoning</AccordionTrigger>
                      <AccordionContent>{analysisResult.reasoning}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="evidence">
                      <AccordionTrigger>
                        External Evidence ({analysisResult.evidence.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-3">
                          {analysisResult.evidence.map((item, index) => (
                            <li key={index}>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
                                {item.title}
                              </a>
                              <p className="text-xs text-muted-foreground">{item.snippet}</p>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="details">
                      <AccordionTrigger>More Details</AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        <p><strong>Source Credibility:</strong> {analysisResult.sourceCredibility.score}/100</p>
                        <p><strong>Detected Bias:</strong> {analysisResult.bias.political}</p>
                        <p><strong>Stance:</strong> {analysisResult.stance.supports} Supporting, {analysisResult.stance.refutes} Refuting</p>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="image-analysis">
                      <AccordionTrigger>Image Analysis</AccordionTrigger>
                      <AccordionContent>
                        {analysisResult.imageAnalysis && analysisResult.imageAnalysis.length > 0 ? (
                          <ul className="space-y-4">
                            {analysisResult.imageAnalysis.map((img, index) => (
                              <li key={index}>
                                <img src={img.imageUrl} alt="Analyzed image" className="w-full h-auto rounded-md mb-2" />
                                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{img.finding}</p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No significant images were found in this article to analyze.</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="pt-4 border-t text-center">
                      <p className="text-xs text-muted-foreground mb-2">Was this analysis helpful?</p>
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleFeedback('helpful')} disabled={feedbackSent}>
                            👍
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleFeedback('not_helpful')} disabled={feedbackSent}>
                            👎
                        </Button>
                      </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ad Blocker</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-6xl font-bold text-primary">{blockedCount}</p>
              <p className="text-sm text-muted-foreground">requests blocked on this page</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="network" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Log</CardTitle>
            </CardHeader>
            <CardContent>
              {hasNetworkPermission ? (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {networkRequests.length > 0 ? (
                    networkRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <p className="text-sm truncate" title={req.url}>{req.domain}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7" onClick={() => handleRuleCreation(req.domain, 'allow')}>Allow</Button>
                          <Button variant="destructive" size="sm" className="h-7" onClick={() => handleRuleCreation(req.domain, 'block')}>Block</Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm text-center p-4">
                      No requests captured yet. Refresh the page.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center p-4">
                  <p className="mb-4 text-muted-foreground">
                    To use the dynamic network firewall, you need to grant additional permissions.
                  </p>
                  <Button onClick={requestNetworkPermission}>Grant Permission</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Popup; 